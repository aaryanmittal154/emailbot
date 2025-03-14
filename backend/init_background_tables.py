"""
Database initialization script for background service tables
Run this script to create the necessary tables for the background service
"""

import logging
import os
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables
load_dotenv()

# Import database modules
from app.db.database import engine, SessionLocal
from app.models.background_service import UserBackgroundPreferences, OAuthToken, BackgroundServiceLog

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

def init_background_tables():
    """Initialize background service database tables"""
    from app.db.database import Base
    from app.models.background_service import UserBackgroundPreferences, OAuthToken, BackgroundServiceLog
    
    logger.info("Creating background service tables...")
    
    # Create all tables from models
    Base.metadata.create_all(bind=engine, tables=[
        UserBackgroundPreferences.__table__,
        OAuthToken.__table__,
        BackgroundServiceLog.__table__
    ])
    
    # Create indices for better query performance
    db = SessionLocal()
    try:
        # Index for querying logs by user and date
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_logs_user_date ON background_service_logs (user_id, DATE(created_at))"
        ))
        
        # Index for querying logs by event type
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_logs_event_type ON background_service_logs (event_type)"
        ))
        
        db.commit()
        logger.info("Created indices for background service tables")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating indices: {str(e)}")
    finally:
        db.close()
    
    logger.info("Background service tables initialized successfully")

if __name__ == "__main__":
    init_background_tables()
    print("Background service tables initialized successfully")
