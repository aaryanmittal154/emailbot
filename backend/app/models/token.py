from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class Token(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    token_type = Column(String, default="Bearer")
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", backref="tokens")

    def is_expired(self):
        """Check if the token is expired"""
        from datetime import datetime, timezone

        # Make expires_at timezone-aware if it's naive
        if self.expires_at is None:
            return True

        if self.expires_at.tzinfo is None:
            # Convert naive datetime to aware (assume it's in UTC)
            aware_expires_at = self.expires_at.replace(tzinfo=timezone.utc)
        else:
            aware_expires_at = self.expires_at

        return aware_expires_at < datetime.now(timezone.utc)
