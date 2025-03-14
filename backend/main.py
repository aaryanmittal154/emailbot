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
from app.models import user, token, email, gmail_rate_limit, match, background_service
from app.models.email_label import LabelCategory, EmailLabel, ThreadLabel, LabelFeedback

from app.api.routes import auth, emails, auto_reply, labels, analytics, matches
from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler
from app.db.init_db import init_db
# Import route modules, not service modules
from app.routes import semantic_search, background_service as background_service_routes
# Import service for initialization only
from app.services.background_service import initialize_background_service

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
    "app.services.match_service",
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
    # Initialize database
    init_db()
    logger.info("Database initialized")
    
    # Start the scheduler for periodic tasks
    start_scheduler()
    logger.info("Scheduler started")
    
    # Initialize background service
    initialize_background_service()
    logger.info("Background service initialized")
    
    # Start the background tasks for reliable email checking
    from app.services.background_tasks import start_background_tasks
    start_background_tasks()
    logger.info("Reliable email background checking system started")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop the scheduler and background tasks on app shutdown"""
    # Stop the scheduler
    stop_scheduler()
    
    # Stop the background tasks
    from app.services.background_tasks import stop_background_tasks
    stop_background_tasks()
    logger.info("Background tasks stopped")
    
    # Stop background service
    from app.services.background_service import background_service
    background_service.stop()
    logger.info("Background service stopped")


@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "ok", "message": "Service is running"}


# Include routers
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(emails.router, prefix="/api", tags=["Emails"])
app.include_router(auto_reply.router, prefix="/api", tags=["Auto Reply"])
app.include_router(labels.router, prefix="/api", tags=["Email Labels"])
app.include_router(analytics.router, prefix="/api", tags=["Email Analytics"])
app.include_router(
    matches.router, prefix="/api/matches", tags=["Job-Candidate Matching"]
)
# Add new routes
app.include_router(semantic_search.router, tags=["Semantic Search"])
app.include_router(background_service_routes.router, tags=["Background Service"])

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )
