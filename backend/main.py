import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import logging
import sys
import uvicorn

# Import models to ensure they are registered with SQLAlchemy
from app.models import user, token, email, gmail_rate_limit
from app.models.email_label import LabelCategory, EmailLabel, ThreadLabel, LabelFeedback

from app.api.routes import auth, emails, auto_reply, labels, analytics
from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler
from app.db.init_db import init_db

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Set specific loggers to debug level
for logger_name in [
    "app.services.auto_reply_service",
    "app.services.email_service",
    "app.services.embedding_service",
]:
    module_logger = logging.getLogger(logger_name)
    module_logger.setLevel(logging.DEBUG)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info("Starting up...")
    init_db()
    logger.info("Database initialized")
    start_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    """Stop the scheduler on app shutdown"""
    stop_scheduler()


@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "ok", "message": "Service is running"}


# Include routers
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(emails.router, prefix="/api", tags=["Emails"])
app.include_router(auto_reply.router, prefix="/api", tags=["Auto Reply"])
app.include_router(labels.router, prefix="/api", tags=["Email Labels"])
app.include_router(analytics.router, prefix="/api", tags=["Email Analytics"])

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG_MODE,
    )
