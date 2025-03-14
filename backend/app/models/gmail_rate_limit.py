from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class GmailRateLimit(Base):
    """Model for tracking Gmail API rate limits"""

    __tablename__ = "gmail_rate_limits"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    limit_type = Column(String, nullable=False)  # e.g., "send_email", "general"
    retry_after = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Define the relationship back to User
    user = relationship("User", back_populates="rate_limits")

    @classmethod
    def get_active_limit(cls, db, user_id, limit_type="send_email"):
        """Get active rate limit for a user if it exists and is still valid"""
        from datetime import datetime, timezone

        limit = (
            db.query(cls)
            .filter(
                cls.user_id == user_id,
                cls.limit_type == limit_type,
                cls.is_active == True,
                cls.retry_after > datetime.now(timezone.utc),
            )
            .first()
        )

        return limit

    @classmethod
    def add_limit(cls, db, user_id, retry_after, limit_type="send_email"):
        """Add a new rate limit entry and deactivate old ones"""
        # Deactivate old limits
        old_limits = (
            db.query(cls)
            .filter(
                cls.user_id == user_id,
                cls.limit_type == limit_type,
                cls.is_active == True,
            )
            .all()
        )

        for old in old_limits:
            old.is_active = False

        # Create new limit
        new_limit = cls(
            user_id=user_id,
            limit_type=limit_type,
            retry_after=retry_after,
            is_active=True,
        )

        db.add(new_limit)
        db.commit()

        return new_limit
