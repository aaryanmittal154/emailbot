from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import os
import requests
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.models.token import Token as TokenModel
from app.schemas.token import TokenResponse, GoogleAuthResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/login", response_model=GoogleAuthResponse)
async def login():
    """Generate Google OAuth login URL"""
    # Create flow instance to manage the OAuth 2.0 Authorization Grant Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=settings.GOOGLE_SCOPES,
    )

    # Set the redirect URI
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI

    # Generate the authorization URL
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    return {"auth_url": authorization_url}


@router.get("/callback")
async def callback(
    code: str, state: Optional[str] = None, db: Session = Depends(get_db)
):
    """Handle Google OAuth callback"""
    try:
        # Instead of using flow.fetch_token which checks scopes, we'll manually exchange the code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }

        # Log the token request data for debugging (excluding secret)
        print(
            f"Token request: client_id={settings.GOOGLE_CLIENT_ID}, redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        )

        response = requests.post(token_url, data=token_data)
        if not response.ok:
            error_detail = f"Failed to get token: {response.text}"
            print(f"Token error: {error_detail}")
            raise Exception(error_detail)

        token_json = response.json()
        print(f"Token response received with keys: {', '.join(token_json.keys())}")

        # Create credentials from token response
        credentials = Credentials(
            token=token_json.get("access_token"),
            refresh_token=token_json.get("refresh_token"),
            token_uri=token_url,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=token_json.get("scope", "").split(" "),
        )

        # Get user info from Google
        service = build("oauth2", "v2", credentials=credentials)
        user_info = service.userinfo().get().execute()

        # Check if user exists
        user = db.query(User).filter(User.email == user_info["email"]).first()

        # If not, create a new user
        if not user:
            user = User(
                email=user_info["email"],
                full_name=user_info.get("name"),
                picture=user_info.get("picture"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Save the tokens in the database
        # Check if token exists for this user
        token = db.query(TokenModel).filter(TokenModel.user_id == user.id).first()

        # Calculate token expiry (default to 1 hour if not provided)
        expires_in = token_json.get("expires_in", 3600)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        if token:
            # Update existing token
            token.access_token = credentials.token
            token.refresh_token = credentials.refresh_token or token.refresh_token
            token.expires_at = expires_at
        else:
            # Create new token
            token = TokenModel(
                user_id=user.id,
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                expires_at=expires_at,
            )
            db.add(token)

        db.commit()

        # Generate app JWT token
        access_token = auth_service.create_access_token(
            data={"sub": user.email, "user_id": user.id}
        )

        # Redirect to frontend with token
        redirect_url = f"{settings.CORS_ORIGINS[0]}/auth/callback?token={access_token}&user_id={user.id}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_message = f"Error processing OAuth callback: {str(e)}"
        print(f"OAuth callback error: {error_message}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message,
        )


@router.get("/me", response_model=Dict[str, Any])
async def get_current_user(current_user: User = Depends(auth_service.get_current_user)):
    """Get current authenticated user"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "picture": current_user.picture,
    }
