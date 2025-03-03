from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import re
from dateutil import parser

from app.db.database import get_db
from app.models.user import User
from app.models.gmail_rate_limit import GmailRateLimit
from app.services.auth_service import get_current_user
from app.services.auto_reply_service import AutoReplyManager
from app.schemas.auto_reply import AutoReplyConfig, AutoReplyResponse, AutoReplyStatus
from app.services.email_service import email_service

router = APIRouter(prefix="/auto-reply", tags=["auto-reply"])

# In-memory store for simple configuration persistence
# In a production app, this would be stored in a database
auto_reply_configs = {}


# Helper functions for auto-reply configuration
def get_auto_reply_config(user_id: int, db: Session) -> AutoReplyConfig:
    """Get the auto-reply configuration for the user"""
    # In a real implementation, you would fetch this from a database
    # For this example, we use an in-memory store
    if user_id not in auto_reply_configs:
        auto_reply_configs[user_id] = AutoReplyConfig(
            enabled=True,
            max_threads_per_check=20,
            auto_reply_signature=None,
            is_using_gmail_responder=False,
        )
    return auto_reply_configs[user_id]


def save_auto_reply_config(user_id: int, config: AutoReplyConfig, db: Session):
    """Save the auto-reply configuration for the user"""
    # In a real implementation, you would save this to a database
    # For this example, we use an in-memory store
    auto_reply_configs[user_id] = config


async def get_google_creds(user_id: int, db: Session):
    """Get Google credentials for the user"""
    from app.services.auth_service import get_google_creds as auth_get_google_creds

    # This wraps the synchronous function in case we need to make it async in the future
    return auth_get_google_creds(user_id, db)


@router.post("/check-new-emails", response_model=AutoReplyResponse)
async def check_new_emails(
    background_tasks: BackgroundTasks,
    max_results: Optional[int] = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check for new emails and process them for auto-reply.
    This endpoint launches the check process in the background and returns immediately
    """
    # Schedule the task to run in the background
    background_tasks.add_task(
        AutoReplyManager.check_and_process_new_emails,
        user=user,
        db=db,
        max_results=max_results,
    )

    return {
        "success": True,
        "message": f"Started background task to check for new emails (max: {max_results})",
        "processed_count": 0,
        "replied_count": 0,
    }


@router.post("/check-new-emails-sync", response_model=AutoReplyResponse)
async def check_new_emails_sync(
    max_results: Optional[int] = 20,
    use_html: Optional[bool] = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check for new emails and process them for auto-reply synchronously.
    This endpoint processes the emails and waits for completion before returning
    """
    # Process emails synchronously
    result = await AutoReplyManager.check_and_process_new_emails(
        user=user,
        db=db,
        max_results=max_results,
        use_html=use_html,
    )

    return result


@router.get("/config", response_model=AutoReplyConfig)
async def get_auto_reply_config(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get the auto-reply configuration for the current user"""
    # For now, return default config
    # In a real implementation, you would fetch this from a database
    return {"enabled": True, "max_threads_per_check": 20, "auto_reply_signature": None}


@router.put("/config", response_model=AutoReplyConfig)
async def update_auto_reply_config(
    config: AutoReplyConfig,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the auto-reply configuration for the current user"""
    # In a real implementation, you would update this in a database
    # For this example, we just return the provided config
    return config


@router.get("/rate-limit-status")
async def get_rate_limit_status(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Check if the user is currently rate limited by the Gmail API"""
    active_limit = GmailRateLimit.get_active_limit(db, user.id)

    if active_limit:
        # Ensure retry_after has timezone info
        retry_after = active_limit.retry_after
        if retry_after.tzinfo is None:
            retry_after = retry_after.replace(tzinfo=timezone.utc)

        # Calculate seconds remaining
        now = datetime.now(timezone.utc)
        seconds_remaining = (retry_after - now).total_seconds()

        return {
            "is_rate_limited": True,
            "retry_after": retry_after.isoformat(),
            "limit_type": active_limit.limit_type,
            "seconds_remaining": seconds_remaining,
        }
    else:
        return {"is_rate_limited": False}


@router.get("/status", response_model=AutoReplyStatus)
async def get_auto_reply_status(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get the status of the auto-reply system"""
    # Check for active rate limits
    rate_limit_info = None
    active_limit = GmailRateLimit.get_active_limit(db, user.id)
    if active_limit:
        rate_limit_info = {
            "status": "rate_limited",
            "retry_after": active_limit.retry_after.isoformat(),
        }

    # In a real implementation, you would fetch stats from the database
    # For this example, we return a mock status
    status = {"enabled": True, "total_replies_sent": 0, "last_check_time": None}

    if rate_limit_info:
        status["rate_limit"] = rate_limit_info

    return status


@router.post("/rate-limit-status")
async def check_rate_limit_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the user is currently rate limited for sending emails"""
    limit = GmailRateLimit.get_active_limit(db, user.id, "send_email")

    if limit:
        return {
            "is_rate_limited": True,
            "retry_after": limit.retry_after.isoformat(),
            "limit_type": limit.limit_type,
        }

    return {"is_rate_limited": False}


@router.post("/enable-gmail-vacation-responder")
async def enable_gmail_vacation_responder(
    response_subject: str,
    response_body_html: str,
    restrict_to_domain: bool = False,
    restrict_to_contacts: bool = False,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enable Gmail's built-in vacation auto-responder via the Gmail API.
    This uses the official Gmail API settings.updateVacation method instead of custom email processing.

    - If start_time is not provided, auto-replies start immediately
    - If end_time is not provided, auto-replies continue indefinitely until manually disabled
    - restrict_to_domain: Only send responses to people in your organization (domain)
    - restrict_to_contacts: Only send responses to contacts
    """
    try:
        # Get the user's Google credentials
        creds = await get_google_creds(user.id, db)

        # If start_time not provided, use current time
        start_time = start_time or datetime.now(timezone.utc)

        # Convert to milliseconds since epoch for Gmail API
        epoch = datetime.utcfromtimestamp(0).replace(tzinfo=timezone.utc)
        start_time_ms = int((start_time - epoch).total_seconds() * 1000)

        # Build vacation settings
        vacation_settings = {
            "enableAutoReply": True,
            "responseSubject": response_subject,
            "responseBodyHtml": response_body_html,
            "restrictToContacts": restrict_to_contacts,
            "restrictToDomain": restrict_to_domain,
            "startTime": start_time_ms,
        }

        # Add end_time if provided
        if end_time:
            end_time_ms = int((end_time - epoch).total_seconds() * 1000)
            vacation_settings["endTime"] = end_time_ms

        # Build the Gmail API service
        service = email_service["build_gmail_service"](creds)

        # Update vacation settings
        response = (
            service.users()
            .settings()
            .updateVacation(userId="me", body=vacation_settings)
            .execute()
        )

        # Update auto-reply config to indicate we're using Gmail's native responder
        auto_reply_config = get_auto_reply_config(user.id, db)
        auto_reply_config.is_using_gmail_responder = True
        auto_reply_config.enabled = True
        save_auto_reply_config(user.id, auto_reply_config, db)

        return {
            "success": True,
            "message": "Gmail vacation responder enabled successfully",
            "settings": response,
        }

    except Exception as e:
        # Handle errors
        error_message = str(e)
        if "rate limit exceeded" in error_message.lower():
            # Track the rate limit in the database
            match = re.search(
                r"until (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)", error_message
            )
            if match:
                retry_after_str = match.group(1)
                retry_after = parser.parse(retry_after_str)
                GmailRateLimit.add_limit(db, user.id, retry_after)

                return {
                    "success": False,
                    "error": "Gmail API rate limit exceeded",
                    "retry_after": retry_after.isoformat(),
                    "details": {
                        "rate_limit": {
                            "status": "rate_limited",
                            "retry_after": retry_after.isoformat(),
                        }
                    },
                }

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable Gmail vacation responder: {error_message}",
        )


@router.post("/disable-gmail-vacation-responder")
async def disable_gmail_vacation_responder(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Disable Gmail's built-in vacation auto-responder via the Gmail API.
    """
    try:
        # Get the user's Google credentials
        creds = await get_google_creds(user.id, db)

        # Build vacation settings
        vacation_settings = {
            "enableAutoReply": False,
        }

        # Build the Gmail API service
        service = email_service["build_gmail_service"](creds)

        # Update vacation settings
        response = (
            service.users()
            .settings()
            .updateVacation(userId="me", body=vacation_settings)
            .execute()
        )

        # Update auto-reply config to indicate we're not using Gmail's native responder
        auto_reply_config = get_auto_reply_config(user.id, db)
        auto_reply_config.is_using_gmail_responder = False
        save_auto_reply_config(user.id, auto_reply_config, db)

        return {
            "success": True,
            "message": "Gmail vacation responder disabled successfully",
            "settings": response,
        }

    except Exception as e:
        # Handle errors
        error_message = str(e)
        if "rate limit exceeded" in error_message.lower():
            # Handle rate limit similarly to the enable endpoint
            match = re.search(
                r"until (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)", error_message
            )
            if match:
                retry_after_str = match.group(1)
                retry_after = parser.parse(retry_after_str)
                GmailRateLimit.add_limit(db, user.id, retry_after)

                return {
                    "success": False,
                    "error": "Gmail API rate limit exceeded",
                    "retry_after": retry_after.isoformat(),
                }

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable Gmail vacation responder: {error_message}",
        )


@router.get("/gmail-vacation-settings")
async def get_gmail_vacation_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the current Gmail vacation responder settings.
    """
    try:
        # Get the user's Google credentials
        creds = await get_google_creds(user.id, db)

        # Build the Gmail API service
        service = email_service["build_gmail_service"](creds)

        try:
            # Get current vacation settings
            print(f"Attempting to get vacation settings for user: {user.email}")
            response = service.users().settings().getVacation(userId="me").execute()
            print(f"Successfully retrieved vacation settings: {response}")

            # Format the timestamps for better readability
            if "startTime" in response:
                start_time_ms = int(response["startTime"])
                response["startTimeFormatted"] = datetime.fromtimestamp(
                    start_time_ms / 1000, timezone.utc
                ).isoformat()

            if "endTime" in response:
                end_time_ms = int(response["endTime"])
                response["endTimeFormatted"] = datetime.fromtimestamp(
                    end_time_ms / 1000, timezone.utc
                ).isoformat()

            return response
        except Exception as api_error:
            print(f"Gmail API error: {str(api_error)}")
            # Check if this is a 'Method not found' error
            if (
                "not found" in str(api_error).lower()
                or "invalid" in str(api_error).lower()
            ):
                # Return a default structure if the API method isn't available
                return {
                    "enableAutoReply": False,
                    "responseSubject": "",
                    "responseBodyHtml": "",
                    "restrictToContacts": False,
                    "restrictToDomain": False,
                    "apiError": str(api_error),
                }
            else:
                # Re-raise other errors
                raise api_error

    except Exception as e:
        # Handle errors
        error_message = str(e)
        print(f"Error in get_gmail_vacation_settings: {error_message}")

        # Check for rate limit errors
        if "rate limit exceeded" in error_message.lower():
            match = re.search(
                r"until (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)", error_message
            )
            if match:
                retry_after_str = match.group(1)
                retry_after = parser.parse(retry_after_str)
                GmailRateLimit.add_limit(db, user.id, retry_after)

                return {
                    "success": False,
                    "error": "Gmail API rate limit exceeded",
                    "retry_after": retry_after.isoformat(),
                }

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Gmail vacation settings: {error_message}",
        )


@router.post("/reset-rate-limits")
async def reset_rate_limits(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Reset any active rate limits for the current user"""
    from app.models.gmail_rate_limit import GmailRateLimit

    # Get all active rate limits for this user
    active_limits = (
        db.query(GmailRateLimit)
        .filter(GmailRateLimit.user_id == user.id, GmailRateLimit.is_active == True)
        .all()
    )

    # Deactivate them
    for limit in active_limits:
        limit.is_active = False

    db.commit()

    return {
        "success": True,
        "message": f"Reset {len(active_limits)} active rate limits",
    }
