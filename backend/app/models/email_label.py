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


class LabelCategory(Base):
    """Category group for labels (e.g., Job-related, Candidate-related)"""
    __tablename__ = "label_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    labels = relationship("EmailLabel", back_populates="category")


class EmailLabel(Base):
    """Email labels that can be applied to threads"""
    __tablename__ = "email_labels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category_id = Column(Integer, ForeignKey("label_categories.id"))
    description = Column(Text, nullable=True)
    color = Column(String, default="#808080")  # Default gray color in hex
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    category = relationship("LabelCategory", back_populates="labels")
    thread_labels = relationship("ThreadLabel", back_populates="label")


class ThreadLabel(Base):
    """Junction table for thread-label relationships"""
    __tablename__ = "thread_labels"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(String, index=True)
    label_id = Column(Integer, ForeignKey("email_labels.id"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    confidence = Column(Integer, default=0)  # 0-100 confidence score for AI suggestions
    is_confirmed = Column(Boolean, default=False)  # Whether user has confirmed this label
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    label = relationship("EmailLabel", back_populates="thread_labels")
    user = relationship("User", backref="thread_labels")


class LabelFeedback(Base):
    """User feedback on label suggestions for model improvement"""
    __tablename__ = "label_feedback"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    suggested_label_id = Column(Integer, ForeignKey("email_labels.id"))
    correct_label_id = Column(Integer, ForeignKey("email_labels.id", ondelete="SET NULL"), nullable=True)
    feedback_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="label_feedback")
    suggested_label = relationship("EmailLabel", foreign_keys=[suggested_label_id])
    correct_label = relationship("EmailLabel", foreign_keys=[correct_label_id])
