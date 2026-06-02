from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection. Preview environments may not always provide Mongo
# credentials; keep the API alive so health checks and the frontend can load.
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'medusa_saas')
client = AsyncIOMotorClient(mongo_url) if mongo_url else None
db = client[db_name] if client is not None else None

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str


def get_db():
    if db is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    return db


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World", "status": "ok"}


@api_router.get("/health")
async def health_check():
    return {"status": "ok", "database_configured": db is not None}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    database = get_db()
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await database.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    database = get_db()
    status_checks = await database.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
