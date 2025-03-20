from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    google_token = Column(Text)
    refresh_token = Column(String)
    token_expiry = Column(DateTime(timezone=True))
    token_uri = Column(String)
    client_id = Column(String)
    client_secret = Column(String)
    scopes = Column(String)
    full_name = Column(String, nullable=True)
    picture = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_onboarded = Column(Boolean, default=False)
    max_emails_to_index = Column(Integer, default=100)

    # Relationships
    matches = relationship(
        "JobCandidateMatch", back_populates="user", cascade="all, delete-orphan"
    )
    rate_limits = relationship(
        "GmailRateLimit", back_populates="user", cascade="all, delete-orphan"
    )
    custom_prompts = relationship(
        "CustomPrompt", back_populates="user", cascade="all, delete-orphan"
    )
