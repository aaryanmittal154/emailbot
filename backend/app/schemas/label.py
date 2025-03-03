from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class LabelCategoryBase(BaseModel):
    """Base schema for label categories"""

    name: str
    description: Optional[str] = None


class LabelCategoryCreate(LabelCategoryBase):
    """Schema for creating a new label category"""

    pass


class LabelCategoryUpdate(BaseModel):
    """Schema for updating an existing label category"""

    name: Optional[str] = None
    description: Optional[str] = None


class LabelCategoryResponse(LabelCategoryBase):
    """Schema for returning a label category"""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True  # For backwards compatibility with older Pydantic
        from_attributes = True


class EmailLabelBase(BaseModel):
    """Base schema for email labels"""

    name: str
    category_id: int
    description: Optional[str] = None
    color: Optional[str] = "#808080"


class EmailLabelCreate(EmailLabelBase):
    """Schema for creating a new email label"""

    pass


class EmailLabelUpdate(BaseModel):
    """Schema for updating an existing email label"""

    name: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    color: Optional[str] = None


class EmailLabelResponse(EmailLabelBase):
    """Schema for returning an email label"""

    id: int
    created_at: datetime
    updated_at: datetime
    category: LabelCategoryResponse

    class Config:
        orm_mode = True  # For backwards compatibility with older Pydantic
        from_attributes = True


class ThreadLabelBase(BaseModel):
    """Base schema for thread labels"""

    thread_id: str
    label_id: int
    confidence: Optional[int] = 0
    is_confirmed: Optional[bool] = False


class ThreadLabelCreate(ThreadLabelBase):
    """Schema for creating a new thread label"""

    pass


class ThreadLabelUpdate(BaseModel):
    """Schema for updating an existing thread label"""

    confidence: Optional[int] = None
    is_confirmed: Optional[bool] = None


class ThreadLabelResponse(ThreadLabelBase):
    """Schema for returning a thread label"""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    label: EmailLabelResponse

    class Config:
        orm_mode = True  # For backwards compatibility with older Pydantic
        from_attributes = True


class LabelSuggestionRequest(BaseModel):
    """Schema for requesting label suggestions"""

    thread_id: str
    max_suggestions: Optional[int] = 3


class LabelSuggestionResponse(BaseModel):
    """Schema for returning label suggestions"""

    thread_id: str
    suggestions: List[Dict[str, Any]]


class LabelFeedbackCreate(BaseModel):
    """Schema for creating label feedback"""

    thread_id: str
    suggested_label_id: int
    correct_label_id: Optional[int] = None
    feedback_text: Optional[str] = None


class LabelFeedbackResponse(BaseModel):
    """Schema for returning label feedback"""

    id: int
    thread_id: str
    user_id: int
    suggested_label_id: int
    correct_label_id: Optional[int] = None
    feedback_text: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True  # For backwards compatibility with older Pydantic
        from_attributes = True


class ThreadClassifyRequest(BaseModel):
    """Schema for classifying a thread"""

    thread_id: str
