from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_at: Optional[datetime] = None


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None


class GoogleAuthRequest(BaseModel):
    """Request for Google authentication URL"""

    redirect_uri: Optional[str] = None


class GoogleAuthResponse(BaseModel):
    """Response with Google authentication URL"""

    auth_url: str


class GoogleCallbackRequest(BaseModel):
    """Request for Google OAuth callback"""

    code: str
    state: Optional[str] = None


class TokenResponse(BaseModel):
    """Response with authentication tokens"""

    access_token: str
    token_type: str
    user: Dict[str, Any]
