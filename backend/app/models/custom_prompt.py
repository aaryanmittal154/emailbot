"""Database model for storing custom prompts for different email categories"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class CustomPrompt(Base):
    """Custom prompts for email classification and auto-reply generation"""

    __tablename__ = "custom_prompts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    category = Column(
        String(50), nullable=False
    )  # Job Posting, Candidate, Questions, etc.
    prompt_type = Column(String(20), nullable=False)  # 'classification' or 'auto_reply'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship to user
    user = relationship("User", back_populates="custom_prompts")
