from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
    Response,
    BackgroundTasks,
)
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import os
import requests
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ValidationError
from fastapi.security import OAuth2PasswordBearer

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.models.token import Token as TokenModel
from app.schemas.token import TokenResponse, GoogleAuthResponse
from app.services import auth_service
from app.services.email_service import email_service
from jose import jwt, JWTError

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Define oauth2_scheme instance
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


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

        # Check if this is a background service flow (from state parameter)
        if state == "background_service_enable":
            print(f"Processing background service OAuth flow for user {user.id}")

            # Enable background service
            success = auth_service.enable_background_service(user.id, db)

            if success:
                print(f"Successfully enabled background service for user {user.id}")
                # Redirect to background service settings with success flag
                redirect_url = f"{settings.CORS_ORIGINS[0]}/settings/background-service?enabled=true"
            else:
                print(f"Failed to enable background service for user {user.id}")
                # Redirect to background service settings with error flag
                redirect_url = (
                    f"{settings.CORS_ORIGINS[0]}/settings/background-service?error=true"
                )

            return RedirectResponse(url=redirect_url)
        else:
            # Regular login flow - redirect to frontend with token
            redirect_url = f"{settings.CORS_ORIGINS[0]}/auth/callback?token={access_token}&user_id={user.id}"
            return RedirectResponse(url=redirect_url)

    except Exception as e:
        error_message = f"Error processing OAuth callback: {str(e)}"
        print(f"OAuth callback error: {error_message}")

        # Determine where to redirect based on state parameter
        if state == "background_service_enable":
            # Background service flow error - redirect to background service settings
            error_redirect = (
                f"{settings.CORS_ORIGINS[0]}/settings/background-service?error=true"
            )
            return RedirectResponse(url=error_redirect)
        else:
            # Regular flow error - throw HTTP exception
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
        "is_onboarded": current_user.is_onboarded,
        "max_emails_to_index": current_user.max_emails_to_index,
    }


class OnboardingPreferences(BaseModel):
    """Model for user onboarding preferences"""

    max_emails_to_index: int = 100


@router.post("/onboarding", response_model=Dict[str, Any])
async def set_onboarding_preferences(
    preferences: OnboardingPreferences,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    access_token: str = Depends(oauth2_scheme),
):
    """Set user onboarding preferences including max emails to index"""
    try:
        # Log the received preferences for debugging
        print(f"Received onboarding preferences: {preferences.max_emails_to_index}")

        # Manually decode the token to get user_id
        try:
            payload = jwt.decode(
                access_token, settings.SECRET_KEY, algorithms=["HS256"]
            )
            user_id = payload.get("user_id")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token - missing user_id",
                )
            print(f"Decoded user_id from token: {user_id}")
        except JWTError as jwt_error:
            print(f"JWT decode error: {str(jwt_error)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

        # Get the value from the request
        max_emails = preferences.max_emails_to_index

        # Process the value with simpler logic to avoid potential errors
        if max_emails == -1:
            # "All" emails
            max_emails = 10000
        elif max_emails < 0:
            # Invalid negative value
            max_emails = 0
        elif max_emails > 1000:
            # Cap at 1000
            max_emails = 1000

        print(f"Processed max_emails value: {max_emails}")

        # Find the user in the database to update
        db_user = db.query(User).filter(User.id == user_id).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User not found with ID: {user_id}",
            )

        # Update user record
        try:
            db_user.max_emails_to_index = max_emails
            db_user.is_onboarded = True
            db.commit()
            print(f"Database commit successful for user {db_user.email}")
        except Exception as db_error:
            print(f"Database error: {str(db_error)}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(db_error)}",
            )

        # Format response message
        message = f"Onboarding preferences saved. Indexing up to {'all' if max_emails == 10000 else max_emails} emails."
        if max_emails == 0:
            message = "Onboarding preferences saved. Email indexing disabled."

        # Trigger immediate indexing in the background if max_emails > 0
        if max_emails > 0:
            # Add a background task to index all threads
            background_tasks.add_task(
                email_service["index_all_threads"],
                user=db_user,
                db=db,
                max_threads=max_emails,
                is_initial_indexing=True,  # Flag this as initial indexing during onboarding
            )
            print(
                f"Started indexing {max_emails} threads in background for user {db_user.email}"
            )

        # Return success response
        return {
            "success": True,
            "message": message,
        }

    except ValidationError as ve:
        print(f"Validation error: {str(ve)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid preferences: {str(ve)}",
        )
    except Exception as e:
        print(f"ERROR in onboarding: {str(e)}")
        import traceback

        traceback.print_exc()  # Print detailed error stack trace
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error setting onboarding preferences: {str(e)}",
        )


@router.post("/update-email-preferences", response_model=Dict[str, Any])
async def update_email_preferences(
    preferences: OnboardingPreferences,
    db: Session = Depends(get_db),
    access_token: str = Depends(oauth2_scheme),
):
    """Update user's email access preferences after onboarding"""
    try:
        # Manually decode the token to get user_id
        try:
            payload = jwt.decode(
                access_token, settings.SECRET_KEY, algorithms=["HS256"]
            )
            user_id = payload.get("user_id")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token - missing user_id",
                )
            print(f"Decoded user_id from token: {user_id}")
        except JWTError as jwt_error:
            print(f"JWT decode error: {str(jwt_error)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

        # Similar validation as in onboarding
        if preferences.max_emails_to_index == -1:
            # Handle "All emails" case
            preferences.max_emails_to_index = 10000
        elif preferences.max_emails_to_index < 0:
            preferences.max_emails_to_index = 0
        elif (
            preferences.max_emails_to_index > 1000
            and preferences.max_emails_to_index != 10000
        ):
            preferences.max_emails_to_index = 1000

        # Find the user in the database
        db_user = db.query(User).filter(User.id == user_id).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User not found with ID: {user_id}",
            )

        # Get the old value for comparison
        old_value = db_user.max_emails_to_index

        # Update user preference
        db_user.max_emails_to_index = preferences.max_emails_to_index
        db.commit()

        # Format message based on changes
        message_count = (
            "all"
            if preferences.max_emails_to_index == 10000
            else preferences.max_emails_to_index
        )

        # If increasing access, we might need to fetch more emails
        if preferences.max_emails_to_index > old_value:
            return {
                "success": True,
                "message": f"Email access increased to {message_count} emails. You may need to sync your emails to access newly available messages.",
                "action_required": "sync",
            }
        elif preferences.max_emails_to_index < old_value:
            return {
                "success": True,
                "message": f"Email access reduced to {message_count} emails.",
                "action_required": None,
            }
        else:
            return {
                "success": True,
                "message": f"Email access preference confirmed ({message_count} emails).",
                "action_required": None,
            }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating email preferences: {str(e)}",
        )


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh-token", response_model=TokenResponse)
async def refresh_access_token(data: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh an access token using a refresh token"""
    try:
        return auth_service.refresh_token(data.refresh_token, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/logout")
async def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(auth_service.get_current_user),
):
    # For now, logout is client-side (removing token).
    # Optionally, add server-side token invalidation here if needed.
    return {"message": "Logout successful"}
