from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime


class EmailBase(BaseModel):
    gmail_id: str
    thread_id: str
    sender: str
    recipients: List[str]
    subject: Optional[str] = None
    snippet: Optional[str] = None
    date: datetime
    labels: List[str] = []
    has_attachment: bool = False
    is_read: bool = False


class EmailCreate(EmailBase):
    user_id: int


class EmailUpdate(BaseModel):
    is_read: Optional[bool] = None
    labels: Optional[List[str]] = None


class EmailResponse(EmailBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ThreadResponse(BaseModel):
    thread_id: str
    messages: List[EmailResponse]
    subject: str
    participants: List[str]
    message_count: int
    last_updated: datetime


class SendEmailRequest(BaseModel):
    to: List[str]
    subject: str
    body: str
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    thread_id: Optional[str] = None
    html: Optional[bool] = False
    in_reply_to: Optional[str] = None
    references: Optional[List[str]] = None


class SendEmailResponse(BaseModel):
    message_id: str
    thread_id: str
    success: bool
