import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Route, Routes, Link, Navigate } from "react-router-dom";

import { AdminPanel } from "./components/AdminPanel";
import { AuthScreen } from "./components/AuthScreen";
import { ChatScreen } from "./components/ChatScreen";
import { CheckInScreen } from "./components/CheckInScreen";
import { CrisisPage, PrivacyPage, TermsPage } from "./components/LegalPages";
import { MemoryScreen } from "./components/MemoryScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { PricingScreen } from "./components/PricingScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import { SettingsScreen } from "./components/SettingsScreen";
import { PENDING_CONSENT_KEY, PRIVACY_VERSION, TERMS_VERSION } from "./constants/legal";
import { diasRestantes, isTrialAtivo } from "./lib/trial";
import { supabase } from "./lib/supabase";
import {
  analyzeDocument,
  callClaudeProxy,
  confirmAge,
  createConversation,
  createStripeCheckout,
  createStripePortal,
  deleteUserDocument,
  ensureProfile,
  getLatestAssistantMessage,
  getLatestConversation,
  getPreviousConversation,
  getRecentMessagesByUser,
  getSubscription,
  grantDocumentAnalysisConsent,
  getMemory,
  getMessages,
  insertMessage,
  listUserDocuments,
  needsConsent,
  recordUserConsent,
  resetUserData,
  updateEnergy,
  updateOnboarding,
  uploadUserDocument,
  upsertMemory,
} from "./services/medusa";
import type {
  Conversation,
  EnergyLevel,
  MemoryRow,
  Message,
  Profile,
  SubscriptionRow,
  UserDocument,
} from "./types/medusa";

type AppTab = "chat" | "setup";
type FollowUpAnswer = "sim" | "parcial" | "não";
type CheckoutNoticeType = "success" | "cancel";
type ProductViewMode = "app" | "pricing" | "admin";

const CRISIS_SAFE_FALLBACK =
  "Isso é risco imediato. Eu não vou tentar resolver isso por chat.\n" +
  "Se você está em perigo agora, ligue 188 (CVV), 192 (SAMU) ou 190, ou vá para uma emergência.\n" +
  "Agora: afaste meios de se machucar e chame uma pessoa real para ficar com você.";

const CRISIS_TERMS = [
  "suicidio",
  "me matar",
  "quero morrer",
  "tentativa de suicidio",
  "autolesao",
  "autoagressao",
  "overdose",
  "nao aguento mais viver",
  "vou me machucar",
  "plano para morrer",
  "remedio para morrer",
  "tomar remedio para morrer",
];

const LOOP_NAMES = [
  "MINIONS",
  "MERIDA-RILEY",
  "COIOTE",
  "SÍSIFO",
  "MICHAEL SCOTT",
  "DON QUIXOTE",
  "BURNOUT",
  "ALTA DEMANDA",
] as const;

const LOOP_HINTS: Record<(typeof LOOP_NAMES)[number], string[]> = {
  MINIONS: ["sem direcao", "paralis", "trav", "comando"],
  "MERIDA-RILEY": ["sobrecarga", "muitas tarefas", "travado com muita coisa"],
  COIOTE: ["acao infinita", "sem questionar", "executando sem parar"],
  "SÍSIFO": ["carregando tudo", "peso", "aceitando tudo"],
  "MICHAEL SCOTT": ["feedback", "funcionou", "retorno"],
  "DON QUIXOTE": ["percepcao", "estimativa", "realidade"],
  BURNOUT: ["exaust", "esgot", "energia 1"],
  "ALTA DEMANDA": ["alta demanda", "muitas reunioes", "sensorial"],
};

function hasCrisisSignal(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return CRISIS_TERMS.some((term) => normalized.includes(term));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectActiveLoop(messages: Message[]): { name: string; since: string | null } {
  const recent = [...messages].reverse().filter((item) => item.role === "assistant" || item.role === "user").slice(0, 10);

  for (const item of recent) {
    const normalized = normalizeText(item.content);

    for (const loop of LOOP_NAMES) {
      const loopNormalized = normalizeText(loop);
      const hints = LOOP_HINTS[loop];
      if (normalized.includes(loopNormalized) || hints.some((hint) => normalized.includes(hint))) {
        return { name: loop, since: item.created_at };
      }
    }
  }

  return { name: "EM OBSERVAÇÃO", since: null };
}

function extractActionFromAssistant(content: string): string | null {
  if (!content || content.includes("188 (CVV)")) return null;

  const lines = content
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const priority =
    lines.find((line) => /^(\d+[\).]|[-•])\s+/.test(line)) ??
    lines.find((line) => normalizeText(line).includes("proximo passo")) ??
    lines[0];

  const normalized = priority.replace(/^(\d+[\).]|[-•])\s+/, "").trim();
  if (normalized.length < 12) return null;
  return normalized.slice(0, 160);
}

function buildMemoryHighlights(memory: MemoryRow | null): string[] {
  if (!memory) return [];

  const highlights = [
    ...memory.patterns.slice(0, 2).map((item) => `Padrão: ${item}`),
    ...memory.triggers.slice(0, 1).map((item) => `Gatilho: ${item}`),
    ...memory.worked.slice(0, 1).map((item) => `Funciona para você: ${item}`),
  ];

  return highlights.filter(Boolean).slice(0, 4);
}

function computeBurnoutSignals(recentMessages: Message[]): {
  isRisk: boolean;
  trackedDays: number;
  lowDays: number;
} {
  const grouped = new Map<string, number[]>();

  recentMessages.forEach((message) => {
    if (message.role !== "user") return;
    if (typeof message.energy !== "number") return;
    const day = message.created_at.slice(0, 10);
    const bucket = grouped.get(day) ?? [];
    bucket.push(message.energy);
    grouped.set(day, bucket);
  });

  const dayAverages = Array.from(grouped.entries())
    .map(([day, energies]) => ({
      day,
      avg: energies.reduce((sum, value) => sum + value, 0) / energies.length,
    }))
    .sort((a, b) => b.day.localeCompare(a.day));

  const lastThree = dayAverages.slice(0, 3);
  const isRisk = lastThree.length >= 3 && lastThree.every((item) => item.avg <= 1.4);
  const lowDays = dayAverages.filter((item) => item.avg <= 1.4).length;

  return {
    isRisk,
    trackedDays: dayAverages.length,
    lowDays,
  };
}

function formatSinceTime(isoDate: string | null): string {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isSameDay(isoDate: string): boolean {
  const created = new Date(isoDate);
  const now = new Date();

  return (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate()
  );
}

function ensureActiveSession(
  session: Session | null,
  setError: (message: string) => void,
): session is Session {
  if (session) return true;
  setError("Sessão expirada. Faça login novamente para continuar.");
  return false;
}

function ConsentGate({
  loading,
  onAccept,
}: {
  loading: boolean;
  onAccept: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="screen compact" data-testid="consent-gate-screen">
      <p className="eyebrow">Consentimento</p>
      <h2>Confirme os documentos legais para continuar</h2>
      <p className="muted">
        Versões atuais: Termos {TERMS_VERSION} / Privacidade {PRIVACY_VERSION}
      </p>

      <label className="check-row">
        <input
          data-testid="consent-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>
          Li e aceito os <Link to="/terms">Termos de Uso</Link> e a{" "}
          <Link to="/privacy">Política de Privacidade</Link>.
        </span>
      </label>

      <button data-testid="consent-accept-button" className="primary-btn" disabled={!checked || loading} onClick={onAccept}>
        {loading ? "Registrando aceite..." : "Aceitar e continuar"}
      </button>

      <p className="muted">
        Este documento é um modelo inicial e deve ser revisado por profissional jurídico antes do lançamento público.
      </p>
    </div>
  );
}

function AgeGate({
  loading,
  onConfirm,
}: {
  loading: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="screen compact" data-testid="age-gate-screen">
      <p className="eyebrow">Segurança</p>
      <h2>Confirmação obrigatória de idade</h2>
      <p className="muted">A Medusa é destinada apenas para pessoas com 18 anos ou mais.</p>

      <label className="check-row">
        <input
          data-testid="age-confirm-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>Declaro que tenho 18 anos ou mais.</span>
      </label>

      <button data-testid="age-confirm-continue-button" className="primary-btn" disabled={!checked || loading} onClick={onConfirm}>
        {loading ? "Validando..." : "Continuar"}
      </button>
    </div>
  );
}

function ProductApp({ viewMode = "app" }: { viewMode?: ProductViewMode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [memory, setMemory] = useState<MemoryRow | null>(null);
  const [recentSignals, setRecentSignals] = useState<Message[]>([]);
  const [followUpAction, setFollowUpAction] = useState<string | null>(null);
  const [checkInEnergy, setCheckInEnergy] = useState<EnergyLevel | null>(null);
  const [checkInDone, setCheckInDone] = useState(false);
  const [tab, setTab] = useState<AppTab>("chat");
  const [loading, setLoading] = useState(true);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [confirmingAge, setConfirmingAge] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [activeDocumentActionId, setActiveDocumentActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState<{
    type: CheckoutNoticeType;
    message: string;
  } | null>(null);

  const onboardingMissing = useMemo(() => {
    if (!profile?.onboarding) return true;

    const hasArray = (value: unknown) => Array.isArray(value) && value.length > 0;
    const routineDays = profile.onboarding.routine?.days;
    const routinePeriods = profile.onboarding.routine?.periods;

    return (
      !profile.onboarding.education_level ||
      !profile.onboarding.profession_category ||
      !hasArray(profile.onboarding.constraints) ||
      !hasArray(profile.onboarding.blockers) ||
      !hasArray(profile.onboarding.low_energy_works) ||
      !profile.onboarding.guidance_style ||
      !hasArray(profile.onboarding.never_do) ||
      !hasArray(routineDays) ||
      !hasArray(routinePeriods)
    );
  }, [profile]);

  const needsAgeConfirmation = useMemo(() => {
    if (!profile) return true;
    const confirmedViaColumns = Boolean(profile.age_confirmed_at);
    const confirmedViaFallback = Boolean(profile.onboarding?.age_confirmed);
    return !(confirmedViaColumns || confirmedViaFallback);
  }, [profile]);

  const currentEnergy = checkInEnergy ?? profile?.energy_default ?? 2;
  const activeLoop = useMemo(() => detectActiveLoop(messages), [messages]);
  const memoryHighlights = useMemo(() => buildMemoryHighlights(memory), [memory]);
  const burnoutSignals = useMemo(() => computeBurnoutSignals(recentSignals), [recentSignals]);
  const isAdmin = profile?.role === "admin" || session?.user?.email === "admin@medusa.app";
  const trialDaysRemaining = useMemo(() => {
    const source = session?.user?.created_at ?? profile?.created_at ?? null;
    if (!source) return 0;
    return diasRestantes(source);
  }, [profile?.created_at, session?.user?.created_at]);
  const trialActive = useMemo(() => {
    const source = session?.user?.created_at ?? profile?.created_at ?? null;
    if (!source) return false;
    return isTrialAtivo(source);
  }, [profile?.created_at, session?.user?.created_at]);
  const subscriptionActive = useMemo(() => {
    if (!subscription) return false;
    if (subscription.status === "active" || subscription.status === "trialing") return true;
    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end).getTime();
      return Number.isFinite(periodEnd) && periodEnd > Date.now();
    }
    return false;
  }, [subscription]);
  const paywallAllowed = isAdmin || trialActive || subscriptionActive;

  const bootstrap = async (activeSession: Session) => {
    setLoading(true);
    setError("");
    try {
      let ensuredProfile = await ensureProfile(activeSession);
      const pendingConsent = localStorage.getItem(PENDING_CONSENT_KEY) === "true";
      if (needsConsent(ensuredProfile) && pendingConsent) {
        await recordUserConsent({
          userId: activeSession.user.id,
          userAgent: navigator.userAgent,
        });
        localStorage.removeItem(PENDING_CONSENT_KEY);
        ensuredProfile = await ensureProfile(activeSession);
      }

      const latestConversation = await getLatestConversation(activeSession.user.id);
      const canReuseConversation = Boolean(latestConversation?.created_at && isSameDay(latestConversation.created_at));

      const [loadedMemory, loadedDocuments, loadedMessages, loadedRecentSignals, loadedSubscription] = await Promise.all([
        getMemory(activeSession.user.id),
        listUserDocuments(activeSession.user.id),
        canReuseConversation && latestConversation ? getMessages(latestConversation.id) : Promise.resolve([]),
        getRecentMessagesByUser(activeSession.user.id, 7),
        getSubscription(activeSession.user.id),
      ]);

      const followUpSourceConversation = canReuseConversation
        ? await getPreviousConversation(activeSession.user.id, latestConversation?.id ?? null)
        : latestConversation;

      let nextFollowUpAction: string | null = null;
      if (followUpSourceConversation?.id) {
        const latestAssistant = await getLatestAssistantMessage(followUpSourceConversation.id);
        nextFollowUpAction = extractActionFromAssistant(latestAssistant?.content ?? "");
      }

      setProfile(ensuredProfile);
      setConversation(canReuseConversation ? latestConversation : null);
      setMessages(loadedMessages);
      setMemory(loadedMemory);
      setDocuments(loadedDocuments);
      setSubscription(loadedSubscription);
      setRecentSignals(loadedRecentSignals);
      setFollowUpAction(nextFollowUpAction);
      setCheckInEnergy(null);
      setCheckInDone(canReuseConversation);
      setTab("chat");
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const checkoutStatus = params.get("checkout");

      if (checkoutStatus === "success") {
        setCheckoutNotice({
          type: "success",
          message: "✅ Pagamento confirmado. Assinatura ativada.",
        });
      }

      if (checkoutStatus === "cancel") {
        setCheckoutNotice({
          type: "cancel",
          message: "Pagamento cancelado. Você pode tentar novamente quando quiser.",
        });
      }

      if (checkoutStatus) {
        params.delete("checkout");
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
      }
    }

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        await bootstrap(data.session);
      } else {
        setLoading(false);
      }
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);

      if (event === "TOKEN_REFRESHED") {
        return;
      }

      if (nextSession) {
        await bootstrap(nextSession);
      } else {
        setProfile(null);
        setConversation(null);
        setMessages([]);
        setDocuments([]);
        setSubscription(null);
        setMemory(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleOnboardingSave = async (payload: {
    displayName: string;
    onboarding: Profile["onboarding"];
  }) => {
    if (!payload.onboarding) return;
    if (!ensureActiveSession(session, setError)) return;
    setSavingOnboarding(true);
    setError("");
    try {
      const onboardingWithAgeFallback = {
        ...payload.onboarding,
        age_confirmed:
          payload.onboarding.age_confirmed ??
          profile?.onboarding?.age_confirmed ??
          Boolean(profile?.age_confirmed_at),
        age_confirmed_at:
          payload.onboarding.age_confirmed_at ??
          profile?.onboarding?.age_confirmed_at ??
          profile?.age_confirmed_at ??
          undefined,
      };

      const updatedProfile = await updateOnboarding(
        session.user.id,
        payload.displayName,
        onboardingWithAgeFallback,
      );
      setProfile(updatedProfile);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar onboarding");
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handleCheckIn = async (energy: EnergyLevel) => {
    if (!ensureActiveSession(session, setError)) return;
    setSavingCheckIn(true);
    setError("");
    try {
      await updateEnergy(session.user.id, energy);
      const freshConversation = await createConversation(session.user.id);
      setProfile((current) => (current ? { ...current, energy_default: energy } : current));
      setConversation(freshConversation);
      setMessages([]);
      setCheckInEnergy(energy);
      setCheckInDone(true);
      setTab("chat");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar check-in");
    } finally {
      setSavingCheckIn(false);
    }
  };

  const handleConfirmAge = async () => {
    if (!ensureActiveSession(session, setError)) return;
    setConfirmingAge(true);
    setError("");
    try {
      const supportsAgeColumns = Boolean(profile && "age_confirmed_at" in profile);
      const updatedProfile = await confirmAge(session.user.id, supportsAgeColumns);
      setProfile(updatedProfile);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Falha ao confirmar idade");
    } finally {
      setConfirmingAge(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!ensureActiveSession(session, setError)) return;
    setUploadingDocument(true);
    setError("");
    try {
      const createdDocument = await uploadUserDocument(session.user.id, file);
      setDocuments((current) => [createdDocument, ...current]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha no upload do documento");
      throw uploadError;
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleRefreshDocuments = async () => {
    if (!ensureActiveSession(session, setError)) return;
    setLoadingDocuments(true);
    setError("");
    try {
      const freshDocuments = await listUserDocuments(session.user.id);
      setDocuments(freshDocuments);
    } catch (documentsError) {
      setError(documentsError instanceof Error ? documentsError.message : "Falha ao carregar documentos");
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleGrantDocumentConsent = async (documentId: string) => {
    if (!ensureActiveSession(session, setError)) return;
    setActiveDocumentActionId(documentId);
    setError("");
    try {
      const updated = await grantDocumentAnalysisConsent(session.user.id, documentId);
      setDocuments((current) => current.map((doc) => (doc.id === documentId ? updated : doc)));
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "Falha ao salvar consentimento");
    } finally {
      setActiveDocumentActionId(null);
    }
  };

  const handleDeleteDocument = async (document: UserDocument) => {
    if (!ensureActiveSession(session, setError)) return;
    setActiveDocumentActionId(document.id);
    setError("");
    try {
      await deleteUserDocument(session.user.id, document);
      setDocuments((current) => current.filter((doc) => doc.id !== document.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Falha ao excluir documento");
    } finally {
      setActiveDocumentActionId(null);
    }
  };

  const handleAnalyzeDocument = async (documentId: string) => {
    if (!ensureActiveSession(session, setError)) return;
    setActiveDocumentActionId(documentId);
    setError("");
    try {
      const updated = await analyzeDocument(session, documentId);
      setDocuments((current) => current.map((doc) => (doc.id === documentId ? updated : doc)));
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Falha ao analisar documento");
      await handleRefreshDocuments();
    } finally {
      setActiveDocumentActionId(null);
    }
  };

  const handleRefreshSubscription = async () => {
    if (!ensureActiveSession(session, setError)) return;
    setBillingLoading(true);
    setError("");
    try {
      const latest = await getSubscription(session.user.id);
      setSubscription(latest);
    } catch (subscriptionError) {
      setError(subscriptionError instanceof Error ? subscriptionError.message : "Falha ao atualizar assinatura");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleStartCheckout = async () => {
    if (!ensureActiveSession(session, setError)) return;
    setBillingLoading(true);
    setError("");
    try {
      const checkout = await createStripeCheckout(session);
      if (!checkout.checkout_url) {
        throw new Error("Checkout sem URL válida");
      }
      window.location.href = checkout.checkout_url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Falha ao iniciar checkout");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!ensureActiveSession(session, setError)) return;
    setBillingLoading(true);
    setError("");
    try {
      const portal = await createStripePortal(session);
      if (!portal.portal_url) {
        throw new Error("Portal sem URL válida");
      }
      window.location.href = portal.portal_url;
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Falha ao abrir portal");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!ensureActiveSession(session, setError) || !conversation || !profile) return;
    setSendingChat(true);
    setError("");
    const mode = "ACAO";

    try {
      const userMessage = await insertMessage({
        conversation_id: conversation.id,
        user_id: session.user.id,
        role: "user",
        content: text,
        energy: currentEnergy,
        mode,
      });
      setMessages((current) => [...current, userMessage]);

      const historyForModel = [...messages, userMessage]
        .filter((item) => item.role === "user" || item.role === "assistant")
        .slice(-12)
        .map((item) => ({
          role: item.role as "user" | "assistant",
          content: item.content,
        }));

      const proxyResponse = await callClaudeProxy(session, {
        messages: historyForModel,
        energy: currentEnergy,
        mode,
        onboarding: profile.onboarding ? { ...profile.onboarding, display_name: profile.display_name } : null,
        memory,
      });

      const assistantMessage = await insertMessage({
        conversation_id: conversation.id,
        user_id: session.user.id,
        role: "assistant",
        content: proxyResponse.reply,
        energy: currentEnergy,
        mode,
      });

      setMessages((current) => [...current, assistantMessage]);
    } catch (chatError) {
      if (hasCrisisSignal(text)) {
        try {
          const fallbackAssistantMessage = await insertMessage({
            conversation_id: conversation.id,
            user_id: session.user.id,
            role: "assistant",
            content: CRISIS_SAFE_FALLBACK,
            energy: currentEnergy,
            mode,
          });
          setMessages((current) => [...current, fallbackAssistantMessage]);
        } catch {
          const fallbackLocal: Message = {
            id: `local-crisis-${Date.now()}`,
            conversation_id: conversation.id,
            user_id: session.user.id,
            role: "assistant",
            content: CRISIS_SAFE_FALLBACK,
            energy: currentEnergy,
            mode,
            created_at: new Date().toISOString(),
          };
          setMessages((current) => [...current, fallbackLocal]);
        }
        setError("");
      } else {
        setError(chatError instanceof Error ? chatError.message : "Erro ao enviar mensagem");
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handleFollowUpAnswer = async (answer: FollowUpAnswer) => {
    if (!followUpAction) return;

    const payload = `Follow-up de evidência: ${answer}.\nAção combinada: ${followUpAction}`;
    await handleSendMessage(payload);
    setFollowUpAction(null);
  };

  const handleSaveMemory = async (payload: {
    patterns: string[];
    triggers: string[];
    worked: string[];
    didnt_work: string[];
    context: string[];
  }) => {
    if (!ensureActiveSession(session, setError)) return;
    setSavingMemory(true);
    setError("");
    try {
      const updated = await upsertMemory(session.user.id, payload);
      setMemory(updated);
    } catch (memoryError) {
      setError(memoryError instanceof Error ? memoryError.message : "Erro ao salvar memória");
    } finally {
      setSavingMemory(false);
    }
  };

  const handleReset = async () => {
    if (!ensureActiveSession(session, setError)) return;
    setResetting(true);
    setError("");
    try {
      await resetUserData(session.user.id);
      setDocuments([]);
      await bootstrap(session);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Erro ao resetar dados");
    } finally {
      setResetting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleAcceptConsent = async () => {
    if (!ensureActiveSession(session, setError)) return;
    setSavingConsent(true);
    setError("");
    try {
      await recordUserConsent({ userId: session.user.id, userAgent: navigator.userAgent });
      localStorage.removeItem(PENDING_CONSENT_KEY);
      const refreshed = await ensureProfile(session);
      setProfile(refreshed);
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "Falha ao registrar consentimento");
    } finally {
      setSavingConsent(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted" data-testid="app-loading-state">Carregando dados...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthDone={async () => undefined} />;
  }

  if (!profile) {
    return (
      <div className="app-shell">
        <p className="muted" data-testid="profile-loading-state">Carregando perfil...</p>
      </div>
    );
  }

  if (viewMode === "admin") {
    if (!isAdmin) {
      return <Navigate to="/" replace />;
    }

    return (
      <div className="app-shell">
        <header className="top-bar">
          <div className="brand-block">
            <p className="eyebrow">Medusa</p>
            <h1 className="app-title">Admin</h1>
            <p className="muted" data-testid="admin-header-role">Acesso administrativo</p>
          </div>
          <nav className="top-tabs">
            <Link to="/" className="ghost-btn" data-testid="admin-back-to-app-link">Voltar ao app</Link>
          </nav>
        </header>
        <AdminPanel session={session} />
      </div>
    );
  }

  if (!isAdmin && needsAgeConfirmation) {
    return (
      <div className="app-shell">
        <AgeGate loading={confirmingAge} onConfirm={handleConfirmAge} />
        {error ? <p className="status-error" data-testid="age-gate-error">{error}</p> : null}
      </div>
    );
  }

  if (!isAdmin && needsConsent(profile)) {
    return (
      <div className="app-shell">
        <ConsentGate loading={savingConsent} onAccept={handleAcceptConsent} />
        {error ? <p className="status-error" data-testid="consent-gate-error">{error}</p> : null}
      </div>
    );
  }

  if (!isAdmin && onboardingMissing) {
    return (
      <div className="app-shell">
        <OnboardingScreen
          loading={savingOnboarding}
          billingLoading={billingLoading}
          uploadingDocument={uploadingDocument}
          defaultName={session.user.email?.split("@")[0] ?? "usuário"}
          onUploadDocument={handleUploadDocument}
          onStartCheckout={handleStartCheckout}
          onSave={handleOnboardingSave}
        />
        {error ? <p className="status-error" data-testid="onboarding-flow-error">{error}</p> : null}
      </div>
    );
  }

  if (viewMode === "pricing" || (!isAdmin && !paywallAllowed)) {
    return (
      <div className="app-shell">
        <PricingScreen
          trialDaysRemaining={trialDaysRemaining}
          billingLoading={billingLoading}
          onStartCheckout={handleStartCheckout}
        />
        {error ? <p className="status-error" data-testid="pricing-flow-error">{error}</p> : null}
      </div>
    );
  }

  if (!isAdmin && !checkInDone) {
    return (
      <div className="app-shell">
        <CheckInScreen
          loading={savingCheckIn}
          defaultEnergy={profile.energy_default}
          onConfirm={handleCheckIn}
        />
        {error ? <p className="status-error" data-testid="checkin-flow-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <p className="eyebrow">Medusa</p>
          <h1 className="app-title">Medusa</h1>
          <p className="muted" data-testid="current-energy-indicator">Energia atual: {currentEnergy}</p>
          <p className="muted" data-testid="active-loop-indicator">
            Estado atual: {activeLoop.name}
            {activeLoop.since ? ` · desde ${formatSinceTime(activeLoop.since)}` : ""}
          </p>
        </div>
        <nav className="top-tabs">
          {isAdmin ? (
            <Link to="/admin" className="ghost-btn" data-testid="top-tab-admin-link">Admin</Link>
          ) : null}
          {!isAdmin && trialActive ? (
            <Link to="/pricing" className="ghost-btn" data-testid="top-tab-pricing-link">Planos</Link>
          ) : null}
          <button
            data-testid="top-tab-chat-button"
            className={`ghost-btn ${tab === "chat" ? "active-tab" : ""}`}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            data-testid="top-tab-setup-button"
            className={`ghost-btn ${tab === "setup" ? "active-tab" : ""}`}
            onClick={() => setTab("setup")}
          >
            Setup
          </button>
        </nav>
      </header>

      {error ? <p className="status-error" data-testid="product-app-error">{error}</p> : null}
      {!isAdmin && trialActive ? (
        <div className="status-ok" data-testid="trial-banner">
          <div className="status-inline-row">
            <span data-testid="trial-banner-text">
              ⏳ Você tem {trialDaysRemaining} dia(s) gratuitos restantes.
            </span>
            <Link to="/pricing" className="ghost-btn" data-testid="trial-banner-subscribe-link">
              Assinar agora
            </Link>
          </div>
        </div>
      ) : null}
      {checkoutNotice ? (
        <div
          className={checkoutNotice.type === "success" ? "status-ok" : "status-error"}
          data-testid="checkout-status-toast"
        >
          <div className="status-inline-row">
            <span data-testid="checkout-status-toast-text">{checkoutNotice.message}</span>
            <button
              className="ghost-btn"
              data-testid="checkout-status-toast-close-button"
              onClick={() => setCheckoutNotice(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {tab === "chat" ? (
        <>
          <section className="chat-signals" data-testid="chat-signals-panel">
            {burnoutSignals.isRisk ? (
              <div className="signal-card signal-risk" data-testid="burnout-risk-card">
                <p className="signal-title">Risco de pré-BURNOUT detectado</p>
                <p className="signal-copy">
                  Últimos 3 dias com energia baixa. Hoje a recomendação é proteção: nenhuma nova tarefa crítica.
                </p>
              </div>
            ) : null}

            {followUpAction ? (
              <div className="signal-card signal-followup" data-testid="followup-card">
                <p className="signal-title">Follow-up automático</p>
                <p className="signal-copy">Ontem você combinou: “{followUpAction}”</p>
                <div className="followup-actions">
                  <button
                    data-testid="followup-answer-yes-button"
                    className="ghost-btn"
                    onClick={() => handleFollowUpAnswer("sim")}
                    disabled={sendingChat}
                  >
                    Sim
                  </button>
                  <button
                    data-testid="followup-answer-partial-button"
                    className="ghost-btn"
                    onClick={() => handleFollowUpAnswer("parcial")}
                    disabled={sendingChat}
                  >
                    Parcial
                  </button>
                  <button
                    data-testid="followup-answer-no-button"
                    className="ghost-btn"
                    onClick={() => handleFollowUpAnswer("não")}
                    disabled={sendingChat}
                  >
                    Não
                  </button>
                </div>
              </div>
            ) : null}

            {memoryHighlights.length > 0 ? (
              <div className="signal-card signal-memory" data-testid="memory-visible-card">
                <p className="signal-title">Memória visível da Medusa</p>
                <ul className="signal-list" data-testid="memory-visible-list">
                  {memoryHighlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="muted" data-testid="weekly-load-summary">
              Carga da semana: {burnoutSignals.lowDays} dia(s) de energia baixa em {burnoutSignals.trackedDays} dia(s) com registro.
            </p>
          </section>

          <ChatScreen
            messages={messages}
            sending={sendingChat}
            energy={currentEnergy}
            onSend={handleSendMessage}
          />
        </>
      ) : null}
      {tab === "setup" ? (
        <div className="setup-column">
          <SettingsScreen
            session={session}
            documents={documents}
            subscription={subscription}
            billingLoading={billingLoading}
            loadingDocuments={loadingDocuments}
            activeDocumentActionId={activeDocumentActionId}
            onGrantDocumentConsent={handleGrantDocumentConsent}
            onAnalyzeDocument={handleAnalyzeDocument}
            onDeleteDocument={handleDeleteDocument}
            onRefreshDocuments={handleRefreshDocuments}
            onStartCheckout={handleStartCheckout}
            onOpenPortal={handleOpenPortal}
            onRefreshSubscription={handleRefreshSubscription}
            resetting={resetting}
            onReset={handleReset}
            onSignOut={handleSignOut}
          />
          <MemoryScreen memory={memory} saving={savingMemory} onSave={handleSaveMemory} />
        </div>
      ) : null}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductApp viewMode="app" />} />
      <Route
        path="/pricing"
        element={
          <ProtectedRoute>
            <ProductApp viewMode="pricing" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <ProductApp viewMode="admin" />
          </ProtectedRoute>
        }
      />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/crisis" element={<CrisisPage />} />
      <Route path="*" element={<ProductApp viewMode="app" />} />
    </Routes>
  );
}

export default App;
