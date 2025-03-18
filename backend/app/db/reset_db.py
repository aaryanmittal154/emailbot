"""Database reset script to drop and recreate all tables"""

import logging
from sqlalchemy.orm import Session
from app.db.database import Base, engine
from sqlalchemy import inspect, text

# Import all models to ensure they're properly registered
from app.models.user import User
from app.models.token import Token
from app.models.email import EmailMetadata
from app.models.gmail_rate_limit import GmailRateLimit
from app.models.email_label import LabelCategory, EmailLabel, ThreadLabel, LabelFeedback
from app.models.match import JobCandidateMatch

logger = logging.getLogger(__name__)


def reset_db():
    """Drop all tables and recreate them"""
    logger.info("Dropping all tables...")

    # Updated to use drop_all with cascade to handle dependent objects
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    with engine.begin() as conn:
        # Create a raw SQL statement to drop all tables with CASCADE
        for table in tables:
            logger.info(f"Dropping table {table} with CASCADE...")
            conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))

    logger.info("Creating all tables...")
    Base.metadata.create_all(bind=engine)

    logger.info("Database reset complete!")


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    reset_db()
    print("Database has been reset successfully!")
