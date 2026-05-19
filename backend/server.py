import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except ImportError:  # pragma: no cover
    LlmChat = None
    UserMessage = None


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.getenv("DB_NAME", "medusa_saas")]

app = FastAPI(title="Medusa SaaS API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("JWT_SECRET", "medusa-dev-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))
FREE_DAILY_MESSAGE_LIMIT = int(os.getenv("FREE_DAILY_MESSAGE_LIMIT", "20"))
FREE_MEMORY_LIMIT = int(os.getenv("FREE_MEMORY_LIMIT", "30"))
DEFAULT_OPENAI_MODEL = os.getenv("DEFAULT_OPENAI_MODEL", "gpt-5.2")
DEFAULT_ANTHROPIC_MODEL = os.getenv(
    "DEFAULT_ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"
)
DEFAULT_GEMINI_MODEL = os.getenv("DEFAULT_GEMINI_MODEL", "gemini-3-flash-preview")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(raw_password: str) -> str:
    return pwd_context.hash(raw_password)


def verify_password(raw_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(raw_password, hashed_password)


def create_access_token(user_id: str) -> str:
    expires = now_utc() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expires}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_daily_window_start_iso() -> str:
    now = now_utc()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat()


def is_paid_user(user: Dict[str, Any]) -> bool:
    return user.get("plan") == "paid" and user.get("subscription_status") in {
        "active",
        "trialing",
    }


async def log_event(
    user_id: Optional[str],
    event_type: str,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    event_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "event_type": event_type,
        "payload": payload or {},
        "created_at": now_iso(),
    }
    await db.usage_events.insert_one(event_doc)


async def add_admin_log(
    admin_user_id: str,
    action: str,
    target_user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    log_doc = {
        "id": str(uuid.uuid4()),
        "admin_user_id": admin_user_id,
        "action": action,
        "target_user_id": target_user_id,
        "details": details or {},
        "created_at": now_iso(),
    }
    await db.admin_logs.insert_one(log_doc)


def base_user_projection() -> Dict[str, int]:
    return {
        "_id": 0,
        "id": 1,
        "email": 1,
        "name": 1,
        "plan": 1,
        "subscription_status": 1,
        "is_admin": 1,
        "onboarding_completed": 1,
        "created_at": 1,
    }


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    return await db.users.find_one({"id": user_id}, {"_id": 0})


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida. Faça login novamente.",
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError as jwt_error:
        raise HTTPException(status_code=401, detail="Token inválido") from jwt_error

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user


async def get_current_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acesso restrito ao admin")
    return user


def get_model_default(provider: str) -> str:
    if provider == "anthropic":
        return DEFAULT_ANTHROPIC_MODEL
    if provider == "gemini":
        return DEFAULT_GEMINI_MODEL
    return DEFAULT_OPENAI_MODEL


async def call_multimodel_llm(
    user_id: str,
    provider: Literal["openai", "anthropic", "gemini"],
    model: str,
    system_message: str,
    prompt: str,
) -> str:
    api_key = os.getenv("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="EMERGENT_LLM_KEY não configurada no backend.",
        )
    if not LlmChat or not UserMessage:
        raise HTTPException(status_code=503, detail="Biblioteca de LLM indisponível")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"{user_id}:{uuid.uuid4()}",
        system_message=system_message,
    ).with_model(provider, model)

    llm_response = await chat.send_message(UserMessage(text=prompt))
    return str(llm_response).strip()


async def maybe_store_memory(user_id: str, message: str) -> None:
    lowered = message.lower()
    trigger_tokens = ["eu ", "prefiro", "gosto", "sempre", "nunca", "objetivo"]
    should_store = any(token in lowered for token in trigger_tokens) and len(message) <= 280
    if not should_store:
        return

    memory_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "memory_type": "insight",
        "content": message.strip(),
        "priority": "medium",
        "source": "chat",
        "relevance_score": 0.75,
        "created_at": now_iso(),
    }
    await db.memory_items.insert_one(memory_doc)

    memory_count = await db.memory_items.count_documents({"user_id": user_id})
    user = await get_user_by_id(user_id)
    if user and user.get("plan") == "free" and memory_count > FREE_MEMORY_LIMIT:
        extra_count = memory_count - FREE_MEMORY_LIMIT
        oldest = (
            await db.memory_items.find(
                {"user_id": user_id},
                {"_id": 0, "id": 1},
            )
            .sort("created_at", 1)
            .to_list(extra_count)
        )
        ids_to_remove = [entry["id"] for entry in oldest]
        if ids_to_remove:
            await db.memory_items.delete_many({"id": {"$in": ids_to_remove}})


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    plan: Literal["free", "paid"]
    subscription_status: str
    is_admin: bool
    onboarding_completed: bool
    created_at: str


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: Optional[str] = Field(default="Usuário Medusa", min_length=2)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8)


class OnboardingSaveRequest(BaseModel):
    answers: Dict[str, str]
    onboarding_version: str = "v1"


class OnboardingProfileResponse(BaseModel):
    user_id: str
    answers: Dict[str, str]
    profile_summary: str
    onboarding_version: str
    updated_at: str


class ChatSendRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    mode: Literal["text", "voice"] = "text"
    provider: Literal["openai", "anthropic", "gemini"] = "openai"
    model: Optional[str] = None
    conversation_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    provider: Optional[str] = None
    model: Optional[str] = None
    mode: Literal["text", "voice"] = "text"
    created_at: str


class ChatSendResponse(BaseModel):
    conversation_id: str
    paywall_required: bool
    paywall_reason: Optional[str] = None
    remaining_messages_today: Optional[int] = None
    assistant_message: Optional[ChatMessageResponse] = None


class MemoryCreateRequest(BaseModel):
    memory_type: Literal["fact", "preference", "goal", "insight"]
    content: str = Field(min_length=2, max_length=400)
    priority: Literal["low", "medium", "high"] = "medium"


class MemoryItemResponse(BaseModel):
    id: str
    user_id: str
    memory_type: str
    content: str
    priority: str
    source: str
    relevance_score: float
    created_at: str


class CheckoutRequest(BaseModel):
    price_id: Optional[str] = None
    return_base_url: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class SubscriptionResponse(BaseModel):
    plan: Literal["free", "paid"]
    subscription_status: str
    provider: str
    renew_at: Optional[str] = None
    stripe_customer_id: Optional[str] = None


class AdminPlanUpdateRequest(BaseModel):
    plan: Literal["free", "paid"]
    subscription_status: Literal[
        "inactive", "active", "trialing", "past_due", "canceled"
    ]


class AdminOverviewResponse(BaseModel):
    users_total: int
    users_paid: int
    users_free: int
    onboarding_completed: int
    chat_messages_today: int
    conversion_rate: float


@api_router.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Medusa SaaS API online"}


@api_router.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "timestamp": now_iso()}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: AuthRequest) -> AuthResponse:
    email = normalize_email(str(payload.email))
    existing_user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
    if existing_user:
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    user_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name or "Usuário Medusa",
        "password_hash": hash_password(payload.password),
        "auth_provider": "email",
        "plan": "free",
        "subscription_status": "inactive",
        "stripe_customer_id": None,
        "is_admin": False,
        "onboarding_completed": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_doc["id"])
    await log_event(user_doc["id"], "auth_register", {"email": email})
    public_user = UserPublic(**{key: user_doc[key] for key in base_user_projection() if key != "_id"})
    return AuthResponse(token=token, user=public_user)


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    email = normalize_email(str(payload.email))
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = create_access_token(user["id"])
    await log_event(user["id"], "auth_login", {"email": email})
    public_user = UserPublic(**{k: user[k] for k in base_user_projection() if k != "_id"})
    return AuthResponse(token=token, user=public_user)


@api_router.post("/auth/request-password-reset")
async def request_password_reset(payload: PasswordResetRequest) -> Dict[str, str]:
    email = normalize_email(str(payload.email))
    user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
    if not user:
        return {"message": "Se o e-mail existir, enviaremos o código."}

    code = str(secrets.randbelow(900000) + 100000)
    reset_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "user_id": user["id"],
        "code": code,
        "used": False,
        "expires_at": (now_utc() + timedelta(minutes=20)).isoformat(),
        "created_at": now_iso(),
    }
    await db.password_resets.insert_one(reset_doc)
    await log_event(user["id"], "password_reset_requested", {})
    return {
        "message": "Código de recuperação gerado.",
        "reset_code": code,
    }


@api_router.post("/auth/reset-password")
async def reset_password(payload: PasswordResetConfirmRequest) -> Dict[str, str]:
    email = normalize_email(str(payload.email))
    reset_entry = await db.password_resets.find_one(
        {
            "email": email,
            "code": payload.code,
            "used": False,
            "expires_at": {"$gte": now_iso()},
        },
        {"_id": 0},
    )
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    await db.users.update_one(
        {"id": reset_entry["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    await db.password_resets.update_one(
        {"id": reset_entry["id"]},
        {"$set": {"used": True, "used_at": now_iso()}},
    )
    await log_event(reset_entry["user_id"], "password_reset_completed", {})
    return {"message": "Senha atualizada com sucesso"}


@api_router.get("/auth/me", response_model=UserPublic)
async def auth_me(user: Dict[str, Any] = Depends(get_current_user)) -> UserPublic:
    public_user = UserPublic(**{k: user[k] for k in base_user_projection() if k != "_id"})
    return public_user


@api_router.post("/auth/logout")
async def logout(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    await log_event(user["id"], "auth_logout", {})
    return {"message": "Sessão encerrada"}


@api_router.get("/onboarding/questions")
async def onboarding_questions() -> Dict[str, List[Dict[str, str]]]:
    return {
        "questions": [
            {
                "key": "goal",
                "question": "Qual objetivo principal você quer atingir com o Medusa?",
            },
            {
                "key": "challenge",
                "question": "Qual é sua maior dificuldade hoje na organização mental?",
            },
            {
                "key": "decision_style",
                "question": "Você prefere decisões rápidas ou análises profundas?",
            },
            {
                "key": "routine",
                "question": "Como é sua rotina ideal de foco durante a semana?",
            },
        ]
    }


@api_router.post("/onboarding/profile", response_model=OnboardingProfileResponse)
async def save_onboarding(
    payload: OnboardingSaveRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> OnboardingProfileResponse:
    profile_summary = " | ".join([f"{k}: {v}" for k, v in payload.answers.items()])
    profile_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "answers": payload.answers,
        "profile_summary": profile_summary,
        "onboarding_version": payload.onboarding_version,
        "updated_at": now_iso(),
    }
    await db.onboarding_profiles.update_one(
        {"user_id": user["id"]},
        {"$set": profile_doc},
        upsert=True,
    )
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"onboarding_completed": True}},
    )
    await log_event(user["id"], "onboarding_completed", {"answers_count": len(payload.answers)})
    return OnboardingProfileResponse(
        user_id=user["id"],
        answers=payload.answers,
        profile_summary=profile_summary,
        onboarding_version=payload.onboarding_version,
        updated_at=profile_doc["updated_at"],
    )


@api_router.get("/onboarding/profile", response_model=Optional[OnboardingProfileResponse])
async def get_onboarding_profile(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Optional[OnboardingProfileResponse]:
    profile = await db.onboarding_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not profile:
        return None
    return OnboardingProfileResponse(**profile)


@api_router.post("/chat/send", response_model=ChatSendResponse)
async def send_chat_message(
    payload: ChatSendRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> ChatSendResponse:
    clean_message = payload.message.strip()
    if not clean_message:
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    daily_count = await db.usage_events.count_documents(
        {
            "user_id": user["id"],
            "event_type": "chat_message",
            "created_at": {"$gte": get_daily_window_start_iso()},
        }
    )
    is_paid = is_paid_user(user)

    if payload.mode == "voice" and not is_paid:
        return ChatSendResponse(
            conversation_id=payload.conversation_id or str(uuid.uuid4()),
            paywall_required=True,
            paywall_reason="voice_premium",
            remaining_messages_today=max(FREE_DAILY_MESSAGE_LIMIT - daily_count, 0),
        )

    if not is_paid and daily_count >= FREE_DAILY_MESSAGE_LIMIT:
        return ChatSendResponse(
            conversation_id=payload.conversation_id or str(uuid.uuid4()),
            paywall_required=True,
            paywall_reason="free_limit_reached",
            remaining_messages_today=0,
        )

    onboarding = await db.onboarding_profiles.find_one(
        {"user_id": user["id"]},
        {"_id": 0, "profile_summary": 1},
    )
    memory_items = (
        await db.memory_items.find(
            {"user_id": user["id"]},
            {"_id": 0, "content": 1},
        )
        .sort("created_at", -1)
        .to_list(6)
    )
    history = (
        await db.conversations.find(
            {"user_id": user["id"]},
            {
                "_id": 0,
                "role": 1,
                "content": 1,
                "created_at": 1,
            },
        )
        .sort("created_at", -1)
        .to_list(6)
    )

    memory_context = "\n".join([f"- {item['content']}" for item in memory_items])
    history_context = "\n".join(
        [f"{msg['role']}: {msg['content']}" for msg in reversed(history)]
    )
    profile_summary = onboarding.get("profile_summary") if onboarding else "Sem onboarding ainda"

    system_message = (
        "Você é o Medusa, um copiloto cognitivo premium. "
        "Responda em português brasileiro, de forma clara e útil. "
        "Aplique o contexto do usuário abaixo sem expor dados sensíveis.\n\n"
        f"Perfil cognitivo: {profile_summary}\n"
        f"Memória recente:\n{memory_context or '- Nenhuma memória'}\n"
        f"Histórico recente:\n{history_context or '- Sem histórico'}"
    )

    provider = payload.provider
    model = payload.model or get_model_default(provider)
    conversation_id = payload.conversation_id or str(uuid.uuid4())

    user_message_doc = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "user_id": user["id"],
        "role": "user",
        "content": clean_message,
        "provider": provider,
        "model": model,
        "mode": payload.mode,
        "created_at": now_iso(),
    }
    await db.conversations.insert_one(user_message_doc)

    try:
        llm_text = await call_multimodel_llm(
            user_id=user["id"],
            provider=provider,
            model=model,
            system_message=system_message,
            prompt=clean_message,
        )
    except HTTPException:
        raise
    except Exception as llm_error:
        logger.exception("Falha ao chamar modelo: %s", llm_error)
        raise HTTPException(status_code=502, detail="Falha no provedor de IA") from llm_error

    assistant_message_doc = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "user_id": user["id"],
        "role": "assistant",
        "content": llm_text,
        "provider": provider,
        "model": model,
        "mode": payload.mode,
        "created_at": now_iso(),
    }
    await db.conversations.insert_one(assistant_message_doc)
    await maybe_store_memory(user["id"], clean_message)
    await log_event(
        user["id"],
        "chat_message",
        {"provider": provider, "model": model, "mode": payload.mode},
    )

    remaining = None
    if not is_paid:
        remaining = max(FREE_DAILY_MESSAGE_LIMIT - (daily_count + 1), 0)

    return ChatSendResponse(
        conversation_id=conversation_id,
        paywall_required=False,
        remaining_messages_today=remaining,
        assistant_message=ChatMessageResponse(**assistant_message_doc),
    )


@api_router.get("/chat/history", response_model=List[ChatMessageResponse])
async def chat_history(
    limit: int = 60,
    user: Dict[str, Any] = Depends(get_current_user),
) -> List[ChatMessageResponse]:
    normalized_limit = max(1, min(limit, 200))
    messages = (
        await db.conversations.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(normalized_limit)
    )
    return [ChatMessageResponse(**message) for message in messages]


@api_router.get("/memory", response_model=List[MemoryItemResponse])
async def list_memory(user: Dict[str, Any] = Depends(get_current_user)) -> List[MemoryItemResponse]:
    memory = (
        await db.memory_items.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    return [MemoryItemResponse(**entry) for entry in memory]


@api_router.post("/memory", response_model=MemoryItemResponse)
async def create_memory(
    payload: MemoryCreateRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> MemoryItemResponse:
    memory_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "memory_type": payload.memory_type,
        "content": payload.content.strip(),
        "priority": payload.priority,
        "source": "manual",
        "relevance_score": 0.8 if payload.priority == "high" else 0.6,
        "created_at": now_iso(),
    }
    await db.memory_items.insert_one(memory_doc)
    await log_event(user["id"], "memory_created", {"type": payload.memory_type})
    return MemoryItemResponse(**memory_doc)


@api_router.get("/subscription/me", response_model=SubscriptionResponse)
async def subscription_me(
    user: Dict[str, Any] = Depends(get_current_user),
) -> SubscriptionResponse:
    subscription = await db.subscriptions.find_one({"user_id": user["id"]}, {"_id": 0})
    renew_at = subscription.get("renew_at") if subscription else None
    return SubscriptionResponse(
        plan=user.get("plan", "free"),
        subscription_status=user.get("subscription_status", "inactive"),
        provider="stripe",
        renew_at=renew_at,
        stripe_customer_id=user.get("stripe_customer_id"),
    )


@api_router.post("/subscription/checkout", response_model=CheckoutResponse)
async def create_checkout(
    payload: CheckoutRequest,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
) -> CheckoutResponse:
    if not os.getenv("STRIPE_SECRET_KEY"):
        raise HTTPException(status_code=503, detail="Stripe não configurado no backend")

    price_id = payload.price_id or os.getenv("STRIPE_PRICE_PAID", "")
    if not price_id:
        raise HTTPException(status_code=400, detail="Preço Stripe não configurado")

    stripe_customer_id = user.get("stripe_customer_id")
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            email=user["email"],
            name=user["name"],
            metadata={"user_id": user["id"]},
        )
        stripe_customer_id = customer["id"]
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"stripe_customer_id": stripe_customer_id}},
        )

    base_url = (
        payload.return_base_url
        or os.getenv("FRONTEND_BASE_URL")
        or request.headers.get("origin")
        or "https://example.com"
    )
    success_url = f"{base_url}?checkout=success"
    cancel_url = f"{base_url}?checkout=cancel"

    checkout_session = stripe.checkout.Session.create(
        mode="subscription",
        customer=stripe_customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user["id"]},
    )

    subscription_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "provider": "stripe",
        "provider_customer_id": stripe_customer_id,
        "provider_subscription_id": None,
        "plan": "paid",
        "status": "checkout_created",
        "checkout_session_id": checkout_session["id"],
        "renew_at": None,
        "updated_at": now_iso(),
    }
    await db.subscriptions.update_one(
        {"user_id": user["id"]},
        {"$set": subscription_doc},
        upsert=True,
    )
    await log_event(user["id"], "checkout_created", {"session_id": checkout_session["id"]})
    return CheckoutResponse(
        checkout_url=checkout_session.url,
        session_id=checkout_session["id"],
    )


@api_router.post("/subscription/portal")
async def create_billing_portal(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    if not os.getenv("STRIPE_SECRET_KEY"):
        raise HTTPException(status_code=503, detail="Stripe não configurado")
    if not user.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="Usuário sem customer Stripe")

    return_url = (
        request.headers.get("origin")
        or os.getenv("FRONTEND_BASE_URL")
        or "https://example.com"
    )
    portal_session = stripe.billing_portal.Session.create(
        customer=user["stripe_customer_id"],
        return_url=return_url,
    )
    return {"portal_url": portal_session.url}


async def upsert_subscription_from_stripe(stripe_subscription: Dict[str, Any]) -> None:
    customer_id = stripe_subscription.get("customer")
    if not customer_id:
        return

    user = await db.users.find_one({"stripe_customer_id": customer_id}, {"_id": 0})
    if not user:
        return

    status_value = stripe_subscription.get("status", "inactive")
    subscription_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "provider": "stripe",
        "provider_customer_id": customer_id,
        "provider_subscription_id": stripe_subscription.get("id"),
        "plan": "paid",
        "status": status_value,
        "trial_end": stripe_subscription.get("trial_end"),
        "renew_at": stripe_subscription.get("current_period_end"),
        "updated_at": now_iso(),
    }
    await db.subscriptions.update_one(
        {"user_id": user["id"]},
        {"$set": subscription_doc},
        upsert=True,
    )

    mapped_plan = "paid" if status_value in {"active", "trialing"} else "free"
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "plan": mapped_plan,
                "subscription_status": status_value,
            }
        },
    )
    await log_event(user["id"], "subscription_sync", {"status": status_value})


@api_router.post("/subscription/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(default="", alias="stripe-signature"),
) -> Dict[str, bool]:
    if not os.getenv("STRIPE_SECRET_KEY") or not os.getenv("STRIPE_WEBHOOK_SECRET"):
        raise HTTPException(status_code=503, detail="Stripe webhook não configurado")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=os.getenv("STRIPE_WEBHOOK_SECRET", ""),
        )
    except ValueError as payload_error:
        raise HTTPException(status_code=400, detail="Payload inválido") from payload_error
    except stripe.error.SignatureVerificationError as signature_error:
        raise HTTPException(status_code=400, detail="Assinatura inválida") from signature_error

    event_type = event.get("type", "")
    data_obj = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        subscription_id = data_obj.get("subscription")
        if subscription_id:
            stripe_subscription = stripe.Subscription.retrieve(subscription_id)
            await upsert_subscription_from_stripe(stripe_subscription)

    if event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        await upsert_subscription_from_stripe(data_obj)

    return {"received": True}


@api_router.get("/admin/overview", response_model=AdminOverviewResponse)
async def admin_overview(
    admin: Dict[str, Any] = Depends(get_current_admin),
) -> AdminOverviewResponse:
    users_total = await db.users.count_documents({})
    users_paid = await db.users.count_documents({"plan": "paid"})
    users_free = await db.users.count_documents({"plan": "free"})
    onboarding_completed = await db.users.count_documents({"onboarding_completed": True})
    chat_messages_today = await db.usage_events.count_documents(
        {
            "event_type": "chat_message",
            "created_at": {"$gte": get_daily_window_start_iso()},
        }
    )
    conversion_rate = (users_paid / users_total * 100) if users_total else 0

    await add_admin_log(admin["id"], "view_admin_overview")
    return AdminOverviewResponse(
        users_total=users_total,
        users_paid=users_paid,
        users_free=users_free,
        onboarding_completed=onboarding_completed,
        chat_messages_today=chat_messages_today,
        conversion_rate=round(conversion_rate, 2),
    )


@api_router.get("/admin/users")
async def admin_users(
    admin: Dict[str, Any] = Depends(get_current_admin),
) -> List[Dict[str, Any]]:
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(300)
    await add_admin_log(admin["id"], "view_admin_users")
    return users


@api_router.get("/admin/logs")
async def admin_logs(
    admin: Dict[str, Any] = Depends(get_current_admin),
) -> List[Dict[str, Any]]:
    logs = await db.admin_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
    await add_admin_log(admin["id"], "view_admin_logs")
    return logs


@api_router.get("/admin/events")
async def admin_events(
    admin: Dict[str, Any] = Depends(get_current_admin),
) -> List[Dict[str, Any]]:
    events = await db.usage_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
    await add_admin_log(admin["id"], "view_usage_events")
    return events


@api_router.patch("/admin/users/{target_user_id}/plan")
async def admin_update_plan(
    target_user_id: str,
    payload: AdminPlanUpdateRequest,
    admin: Dict[str, Any] = Depends(get_current_admin),
) -> Dict[str, str]:
    target_user = await db.users.find_one({"id": target_user_id}, {"_id": 0, "id": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    await db.users.update_one(
        {"id": target_user_id},
        {
            "$set": {
                "plan": payload.plan,
                "subscription_status": payload.subscription_status,
            }
        },
    )
    await db.subscriptions.update_one(
        {"user_id": target_user_id},
        {
            "$set": {
                "id": str(uuid.uuid4()),
                "user_id": target_user_id,
                "provider": "manual_admin",
                "provider_customer_id": None,
                "provider_subscription_id": None,
                "plan": payload.plan,
                "status": payload.subscription_status,
                "renew_at": None,
                "updated_at": now_iso(),
            }
        },
        upsert=True,
    )
    await add_admin_log(
        admin_user_id=admin["id"],
        action="admin_update_plan",
        target_user_id=target_user_id,
        details={
            "plan": payload.plan,
            "subscription_status": payload.subscription_status,
        },
    )
    return {"message": "Plano atualizado"}


@api_router.get("/account/export")
async def export_account_data(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    onboarding_profile = await db.onboarding_profiles.find_one(
        {"user_id": user["id"]},
        {"_id": 0},
    )
    memory_items = await db.memory_items.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    conversations = await db.conversations.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    subscription = await db.subscriptions.find_one({"user_id": user["id"]}, {"_id": 0})
    await log_event(user["id"], "account_export", {})

    return {
        "user": {k: user.get(k) for k in base_user_projection() if k != "_id"},
        "onboarding_profile": onboarding_profile,
        "memory_items": memory_items,
        "conversations": conversations,
        "subscription": subscription,
        "exported_at": now_iso(),
    }


@api_router.delete("/account/delete")
async def delete_account(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    user_id = user["id"]
    await db.users.delete_one({"id": user_id})
    await db.onboarding_profiles.delete_many({"user_id": user_id})
    await db.memory_items.delete_many({"user_id": user_id})
    await db.conversations.delete_many({"user_id": user_id})
    await db.subscriptions.delete_many({"user_id": user_id})
    await db.usage_events.delete_many({"user_id": user_id})
    await db.password_resets.delete_many({"user_id": user_id})
    return {"message": "Conta removida com sucesso"}


@app.on_event("startup")
async def startup_tasks() -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.onboarding_profiles.create_index("user_id", unique=True)
    await db.subscriptions.create_index("user_id", unique=True)
    await db.conversations.create_index("user_id")
    await db.memory_items.create_index("user_id")
    await db.usage_events.create_index("user_id")

    admin_email = normalize_email(os.getenv("ADMIN_EMAIL", "admin@medusa.app"))
    admin_password = os.getenv("ADMIN_PASSWORD", "MedusaAdmin!123")
    existing_admin = await db.users.find_one({"email": admin_email}, {"_id": 0, "id": 1})
    if not existing_admin:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Medusa Admin",
            "password_hash": hash_password(admin_password),
            "auth_provider": "email",
            "plan": "paid",
            "subscription_status": "active",
            "stripe_customer_id": None,
            "is_admin": True,
            "onboarding_completed": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(admin_doc)
        logger.info("Admin seed criado: %s", admin_email)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
