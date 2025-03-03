from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Boolean,
    JSON,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class EmailMetadata(Base):
    __tablename__ = "email_metadata"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    gmail_id = Column(String, index=True)  # Gmail message ID
    thread_id = Column(String, index=True)  # Gmail thread ID
    sender = Column(String)
    recipients = Column(JSON)  # List of recipients
    subject = Column(String)
    snippet = Column(Text)
    date = Column(DateTime(timezone=True))
    labels = Column(JSON)  # Gmail labels
    has_attachment = Column(Boolean, default=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", backref="emails")
