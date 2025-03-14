from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class AutoReplyConfig(BaseModel):
    """Configuration for auto-reply functionality"""

    enabled: bool = Field(default=True, description="Whether auto-reply is enabled")
    max_threads_per_check: int = Field(
        default=20, description="Maximum number of threads to check per execution"
    )
    auto_reply_signature: Optional[str] = Field(
        default=None, description="Custom signature for auto-replies"
    )
    is_using_gmail_responder: bool = Field(
        default=False,
        description="Whether to use Gmail's built-in vacation responder instead of custom auto-replies",
    )
    is_using_push_notifications: bool = Field(
        default=False,
        description="Whether to use Gmail push notifications for instant auto-replies",
    )
    push_notification_expiry: Optional[str] = Field(
        default=None,
        description="ISO timestamp for when the push notification subscription expires",
    )
    push_notification_history_id: Optional[str] = Field(
        default=None,
        description="Gmail history ID for tracking changes since push notification setup",
    )
    push_notification_topic: Optional[str] = Field(
        default=None,
        description="Google Cloud Pub/Sub topic for receiving Gmail notifications",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "enabled": True,
                "max_threads_per_check": 20,
                "auto_reply_signature": "Best regards,\nJohn",
                "is_using_gmail_responder": False,
                "is_using_push_notifications": True,
                "push_notification_expiry": "2025-03-17T16:34:35+00:00",
                "push_notification_history_id": "12345",
                "push_notification_topic": "projects/my-project/topics/gmail-notifications-user-1"
            }
        }


class RateLimitInfo(BaseModel):
    """Information about a rate limit"""

    status: str = Field(
        ..., description="Status of the rate limit (e.g., 'rate_limited')"
    )
    retry_after: str = Field(
        ..., description="ISO timestamp for when the rate limit will be lifted"
    )


class AutoReplyResponse(BaseModel):
    """Response for auto-reply operations"""

    success: bool
    processed_count: int = Field(default=0, description="Number of threads processed")
    replied_count: int = Field(default=0, description="Number of replies sent")
    message: str
    details: Optional[Dict[str, Any]] = None


class AutoReplyStatus(BaseModel):
    """Status of the auto-reply system"""

    enabled: bool
    last_check_time: Optional[datetime] = None
    total_replies_sent: int = 0
    rate_limit: Optional[RateLimitInfo] = None
    push_notifications: Dict[str, Any] = Field(
        default_factory=lambda: {
            "enabled": False,
            "expiration": None,
            "last_renewed": None,
        },
        description="Status of push notifications setup",
    )
