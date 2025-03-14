from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.db.database import Base


class UserBackgroundPreferences(Base):
    """User preferences for background email processing service"""
    __tablename__ = "user_background_preferences"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    background_enabled = Column(Boolean, default=False)
    schedule_start_time = Column(String)  # Store as HH:MM format
    schedule_end_time = Column(String)    # Store as HH:MM format
    active_days = Column(String)          # Comma-separated day numbers (e.g., "1,2,3,4,5")
    max_daily_emails = Column(Integer, default=50)
    send_summary = Column(Boolean, default=True)
    notify_important = Column(Boolean, default=True)
    auto_pause_days = Column(Integer, default=7)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", backref="background_preferences")


class OAuthToken(Base):
    """OAuth tokens for background service access"""
    __tablename__ = "oauth_tokens"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    refresh_token = Column(String(1024))
    access_token = Column(String(1024))
    token_expiry = Column(DateTime(timezone=True))
    refresh_token_encrypted = Column(Boolean, default=True)
    scope = Column(String(1024))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", backref="oauth_tokens")


class BackgroundServiceLog(Base):
    """Logs for background service activity"""
    __tablename__ = "background_service_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    event_type = Column(String)  # e.g., "token_refresh", "email_check", "auto_reply"
    status = Column(String)      # e.g., "success", "error"
    details = Column(JSONB)      # JSON data for additional details
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="background_logs")
