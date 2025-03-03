"""Database initialization script"""

from sqlalchemy.orm import Session
from app.db.database import Base, engine

# Import all models to ensure they're properly registered
from app.models.user import User
from app.models.token import Token
from app.models.email import EmailMetadata
from app.models.gmail_rate_limit import GmailRateLimit
from app.models.email_label import LabelCategory, EmailLabel, ThreadLabel, LabelFeedback


def init_db():
    """Initialize database tables"""
    # Create all tables
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully")
