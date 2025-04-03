"""
Background Service API Routes
Handles API endpoints for managing the 24/7 background auto-reply service
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy import text
from datetime import datetime, timezone
import requests
from google_auth_oauthlib.flow import Flow

from app.core.config import settings
from app.db.database import get_db
from app.services.auth_service import (
    get_current_user,
    store_refresh_token,
    enable_background_service,
    update_background_preferences,
    get_background_preferences
)
from app.services.background_service import background_service, log_background_service_event
import logging

logger = logging.getLogger(__name__)

# Define API router
router = APIRouter(prefix="/api/background-service", tags=["background-service"])

# Request and response models
class BackgroundPreferencesUpdate(BaseModel):
    background_enabled: Optional[bool] = None
    schedule_start_time: Optional[str] = None
    schedule_end_time: Optional[str] = None
    active_days: Optional[str] = None
    max_daily_emails: Optional[int] = None
    send_summary: Optional[bool] = None
    notify_important: Optional[bool] = None
    auto_pause_days: Optional[int] = None

class BackgroundServiceStatus(BaseModel):
    is_enabled: bool
    has_refresh_token: bool
    preferences: Dict[str, Any]
    today_email_count: int

# Routes

@router.post("/enable")
async def enable_service(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Enable background service for the current user

    This endpoint is called after the user has granted offline access
    and we have received a refresh token from Google.
    """
    user_id = current_user.id

    # Get the refresh token from the session
    refresh_token = request.session.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No refresh token available. Please authenticate with Google first."
        )

    # Store the refresh token
    try:
        store_refresh_token(user_id, refresh_token, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store refresh token: {str(e)}"
        )

    # Enable background service
    success = enable_background_service(user_id, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enable background service"
        )

    # Return success
    return {"success": True, "message": "Background service enabled successfully"}


@router.post("/preferences")
async def update_preferences(
    preferences: BackgroundPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update background service preferences for the current user"""
    user_id = current_user.id

    # Update preferences
    success = update_background_preferences(
        user_id=user_id,
        background_enabled=preferences.background_enabled,
        schedule_start_time=preferences.schedule_start_time,
        schedule_end_time=preferences.schedule_end_time,
        active_days=preferences.active_days,
        max_daily_emails=preferences.max_daily_emails,
        send_summary=preferences.send_summary,
        notify_important=preferences.notify_important,
        auto_pause_days=preferences.auto_pause_days,
        db=db
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update preferences"
        )

    # Get updated preferences
    updated_prefs = get_background_preferences(user_id, db)

    return updated_prefs


@router.get("/preferences")
async def get_preferences(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get background service preferences for the current user"""
    user_id = current_user.id

    # Get preferences
    preferences = get_background_preferences(user_id, db)
    if not preferences:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get preferences"
        )

    return preferences


@router.get("/status")
async def get_status(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get background service status for the current user"""
    user_id = current_user.id

    try:
        # Get preferences
        preferences = get_background_preferences(user_id, db)
        if not preferences:
            # Return default preferences if none found instead of throwing an error
            preferences = {
                "background_enabled": False,
                "schedule_start_time": "09:00",
                "schedule_end_time": "17:00",
                "active_days": "1,2,3,4,5",
                "max_daily_emails": 20,
                "send_summary": True,
                "notify_important": True,
                "auto_pause_days": 7
            }

        # Check if user has refresh token
        has_token = False
        try:
            # Check in the Token table instead of oauth_tokens
            query = text("SELECT 1 FROM tokens WHERE user_id = :user_id AND refresh_token IS NOT NULL")
            token_result = db.execute(query, {"user_id": user_id}).fetchone()
            has_token = token_result is not None

            if not has_token:
                # For legacy compatibility, also check the oauth_tokens table
                query = text("SELECT 1 FROM oauth_tokens WHERE user_id = :user_id AND refresh_token IS NOT NULL")
                token_result = db.execute(query, {"user_id": user_id}).fetchone()
                has_token = token_result is not None

            logger.info(f"User {user_id} refresh token check: {has_token}")
        except Exception as e:
            logger.error(f"Error checking refresh token: {str(e)}")
            # Continue with has_token = False

        # Get today's email count
        today_count = 0
        try:
            query = text("""
            SELECT COUNT(*) as email_count
            FROM background_service_logs
            WHERE user_id = :user_id
            AND event_type = 'auto_reply'
            AND status = 'success'
            AND DATE(created_at) = CURRENT_DATE
            """)

            result = db.execute(query, {"user_id": user_id}).fetchone()
            today_count = result[0] if result else 0
        except Exception as e:
            logger.error(f"Error getting today's email count: {str(e)}")
            # Continue with today_count = 0

        # Return status
        return BackgroundServiceStatus(
            is_enabled=preferences.get('background_enabled', False),
            has_refresh_token=has_token,
            preferences=preferences,
            today_email_count=today_count
        )

    except Exception as e:
        logger.error(f"Error getting background service status: {str(e)}")
        # Return a default status instead of throwing an error
        return BackgroundServiceStatus(
            is_enabled=False,
            has_refresh_token=False,
            preferences={
                "background_enabled": False,
                "schedule_start_time": "09:00",
                "schedule_end_time": "17:00",
                "active_days": "1,2,3,4,5",
                "max_daily_emails": 20,
                "send_summary": True,
                "notify_important": True,
                "auto_pause_days": 7
            },
            today_email_count=0
        )


@router.get("/logs")
async def get_logs(
    limit: int = 100,
    offset: int = 0,
    event_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get background service logs for the current user"""
    user_id = current_user.id

    # Construct query
    query = """
    SELECT id, event_type, status, details, created_at
    FROM background_service_logs
    WHERE user_id = %s
    """

    params = [user_id]

    # Add event type filter if provided
    if event_type:
        query += " AND event_type = %s"
        params.append(event_type)

    # Add order by and limit
    query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    # Execute query
    logs = db.execute(query, params).fetchall()

    # Convert to list of dicts
    result = []
    for log in logs:
        result.append(dict(log))

    return result


@router.post("/pause")
async def pause_service(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Pause background service for the current user"""
    user_id = current_user.id

    # Update preferences in database
    success = update_background_preferences(
        user_id=user_id,
        background_enabled=False,
        db=db
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to pause background service"
        )

    try:
        # Log this action
        log_background_service_event(
            user_id=user_id,
            event_type="pause",
            status="success",
            details={"timestamp": datetime.now().isoformat()},
            db=db
        )
    except Exception as e:
        logger.error(f"Error logging pause event: {str(e)}")

    return {"success": True, "message": "Background service paused successfully"}


@router.post("/resume")
async def resume_service(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Resume background service for the current user"""
    user_id = current_user.id

    # Check if we have a refresh token for this user
    try:
        query = text("SELECT 1 FROM oauth_tokens WHERE user_id = :user_id AND refresh_token IS NOT NULL")
        token_result = db.execute(query, {"user_id": user_id}).fetchone()
        has_token = token_result is not None

        if not has_token:
            return {
                "success": False,
                "message": "Authentication required to use background service",
                "auth_required": True
            }
    except Exception as e:
        logger.error(f"Error checking refresh token: {str(e)}")
        # Continue anyway, but log the error

    # Update preferences in database
    success = update_background_preferences(
        user_id=user_id,
        background_enabled=True,
        db=db
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume background service"
        )

    try:
        # Log this action
        log_background_service_event(
            user_id=user_id,
            event_type="resume",
            status="success",
            details={"timestamp": datetime.now().isoformat()},
            db=db
        )
    except Exception as e:
        logger.error(f"Error logging resume event: {str(e)}")

    return {"success": True, "message": "Background service resumed successfully"}


@router.post("/toggle")
async def toggle_background_service(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Directly toggle the background service on/off

    This endpoint checks the current status and toggles it,
    handling authentication requirements automatically.
    """
    user_id = current_user.id
    logger.info(f"Toggle background service requested for user {user_id}")

    try:
        # First get current status
        query = text("SELECT background_enabled FROM user_background_preferences WHERE user_id = :user_id")
        result = db.execute(query, {"user_id": user_id}).fetchone()

        if result:
            current_status = result[0]
        else:
            # If no preferences exist yet, it's not enabled
            current_status = False

        # Check if user has refresh token (needed for enabling)
        if not current_status:  # If we're enabling the service
            # Check in both Token and oauth_tokens tables for maximum compatibility
            has_token = False

            # First check in the Token table
            query = text("SELECT refresh_token FROM tokens WHERE user_id = :user_id")
            token_result = db.execute(query, {"user_id": user_id}).fetchone()
            has_token = token_result is not None and token_result[0] is not None

            # If not found, check in oauth_tokens table as a fallback
            if not has_token:
                query = text("SELECT refresh_token FROM oauth_tokens WHERE user_id = :user_id")
                token_result = db.execute(query, {"user_id": user_id}).fetchone()
                has_token = token_result is not None and token_result[0] is not None

            if not has_token:
                return {
                    "success": False,
                    "needs_auth": True,
                    "message": "Authentication required to enable background service"
                }

        # Toggle the status
        new_status = not current_status

        # Update the preferences
        success = update_background_preferences(
            user_id=user_id,
            background_enabled=new_status,
            db=db
        )

        if not success:
            logger.error(f"Failed to toggle background service for user {user_id}")
            return {
                "success": False,
                "message": "Failed to update service status"
            }

        action = "enabled" if new_status else "disabled"
        logger.info(f"Background service {action} for user {user_id}")

        # Log the event
        log_background_service_event(
            user_id=user_id,
            event_type="toggle",
            status="success",
            details={"new_status": new_status, "timestamp": datetime.now().isoformat()},
            db=db
        )

        # Get fresh status
        fresh_status = db.execute(
            text("SELECT background_enabled FROM user_background_preferences WHERE user_id = :user_id"),
            {"user_id": user_id}
        ).fetchone()

        return {
            "success": True,
            "is_enabled": fresh_status[0] if fresh_status else new_status,
            "message": f"Background service {action} successfully"
        }

    except Exception as e:
        logger.error(f"Error toggling background service: {str(e)}")
        return {
            "success": False,
            "message": f"Error toggling service: {str(e)}"
        }


@router.get("/auth-url")
async def get_background_auth_url():
    """Generate Google OAuth URL for background service access"""
    try:
        # Use the already registered redirect URI from settings
        redirect_uri = settings.GOOGLE_REDIRECT_URI
        logger.info(f"Using registered redirect URI: {redirect_uri}")

        # Create flow instance to manage the OAuth 2.0 Authorization Grant Flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri],
                }
            },
            scopes=settings.GOOGLE_SCOPES,
        )

        # Set the redirect URI to the registered URI
        flow.redirect_uri = redirect_uri

        # Generate the authorization URL with offline access for refresh token
        # Add a special state parameter to identify this is for background service
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",  # Force consent screen to ensure refresh token
            state="background_service_enable",  # Mark this as background service flow
        )

        logger.info(f"Generated background service auth URL: {authorization_url}")
        return {"auth_url": authorization_url}

    except Exception as e:
        logger.error(f"Error generating background service auth URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating auth URL: {str(e)}"
        )


@router.get("/oauth-callback")
async def background_service_oauth_callback(
    code: str,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    OAuth callback for background service access.
    This is called after the user grants offline access to their Google account.
    """
    user_id = current_user.id
    logger.info(f"Processing background service OAuth callback for user {user_id}")

    try:
        # Use backend URL instead of CORS origins (which points to frontend)
        backend_url = "http://emailbot-k8s7.onrender.com"
        redirect_uri = f"{backend_url}/api/background-service/oauth-callback"

        # Exchange code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }

        response = requests.post(token_url, data=token_data)
        if not response.ok:
            error_detail = f"Failed to get token: {response.text}"
            logger.error(error_detail)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail
            )

        token_json = response.json()
        refresh_token = token_json.get("refresh_token")

        if not refresh_token:
            logger.error("No refresh token received in OAuth callback")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No refresh token received. Please try again."
            )

        # Store the refresh token
        store_refresh_token(user_id, refresh_token, db)

        # Enable background service
        success = enable_background_service(user_id, db)
        if not success:
            logger.error(f"Failed to enable background service for user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to enable background service"
            )

        # Log successful enable
        log_background_service_event(
            user_id=user_id,
            event_type="oauth_callback",
            status="success",
            details={"timestamp": datetime.now().isoformat()},
            db=db
        )

        # Redirect to frontend settings page with success flag
        frontend_url = f"{settings.CORS_ORIGINS[0]}/settings/background-service?enabled=true"
        logger.info(f"Redirecting to frontend: {frontend_url}")
        return RedirectResponse(url=frontend_url)

    except Exception as e:
        logger.error(f"Error in background service OAuth callback: {str(e)}")
        # Log the error
        log_background_service_event(
            user_id=user_id,
            event_type="oauth_callback",
            status="error",
            details={"error": str(e)},
            db=db
        )

        # Redirect to frontend with error flag
        frontend_url = f"{settings.CORS_ORIGINS[0]}/settings/background-service?error=true"
        logger.info(f"Redirecting to frontend with error: {frontend_url}")
        return RedirectResponse(url=frontend_url)


@router.get("/oauth-test")
async def test_oauth_flow():
    """
    Debug endpoint to test OAuth flow with the main app's redirect URI
    This helps verify the redirect URI configuration is consistent
    """
    try:
        # Show all redirect URIs from settings for debugging
        logger.info(f"Registered redirect URIs in settings: {settings.GOOGLE_REDIRECT_URI}")

        # Use the main app's redirect URI which is already registered with Google
        redirect_uri = settings.GOOGLE_REDIRECT_URI

        # Create flow instance to manage the OAuth 2.0 Authorization Grant Flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri],
                }
            },
            scopes=settings.GOOGLE_SCOPES,
        )

        # Set the redirect URI to the main app's registered URI
        flow.redirect_uri = redirect_uri

        # Generate the authorization URL with offline access for refresh token
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",  # Force consent screen to ensure refresh token
        )

        logger.info(f"Using registered redirect URI: {redirect_uri}")
        logger.info(f"Generated test auth URL: {authorization_url}")

        # For testing only - return both URLs to help debugging
        return {
            "registered_redirect_uri": redirect_uri,
            "auth_url": authorization_url,
            "test_note": "This endpoint uses the main app's registered redirect URI. The background service needs the same URI registered."
        }

    except Exception as e:
        logger.error(f"Error in OAuth test endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth test error: {str(e)}"
        )


@router.post("/disable-completely")
async def disable_service_completely(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Completely disable the background service and clean up all tokens

    This ensures the service will not run for this user even if they
    have existing refresh tokens.
    """
    user_id = current_user.id
    logger.info(f"Completely disabling background service for user {user_id}")

    try:
        # Update preferences to disable background service
        query = text("""
        INSERT INTO user_background_preferences
        (user_id, background_enabled, created_at, updated_at)
        VALUES (:user_id, FALSE, NOW(), NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
            background_enabled = FALSE,
            updated_at = NOW()
        """)
        db.execute(query, {"user_id": user_id})

        # Delete all tokens to ensure service cannot run
        query = text("DELETE FROM tokens WHERE user_id = :user_id")
        db.execute(query, {"user_id": user_id})

        # Delete all oauth tokens too
        query = text("DELETE FROM oauth_tokens WHERE user_id = :user_id")
        db.execute(query, {"user_id": user_id})

        db.commit()

        # Log this action
        log_background_service_event(
            user_id=user_id,
            event_type="disable_completely",
            status="success",
            details={"timestamp": datetime.now().isoformat()},
            db=db
        )

        return {"success": True, "message": "Background service completely disabled"}

    except Exception as e:
        logger.error(f"Error completely disabling background service: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}
