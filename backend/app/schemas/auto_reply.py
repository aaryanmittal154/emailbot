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

    class Config:
        json_schema_extra = {
            "example": {
                "enabled": True,
                "max_threads_per_check": 20,
                "auto_reply_signature": "Best regards,\nJohn",
                "is_using_gmail_responder": False,
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
