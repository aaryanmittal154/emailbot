from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import re
from dateutil import parser
import base64
import json
import logging
import asyncio
import os

# Set up logging
logger = logging.getLogger(__name__)

from app.db.database import get_db
from app.models.user import User
from app.models.gmail_rate_limit import GmailRateLimit
from app.services.auth_service import get_current_user
from app.services.auto_reply_service import AutoReplyManager
from app.schemas.auto_reply import AutoReplyConfig, AutoReplyResponse, AutoReplyStatus
from app.services.email_service import build_gmail_service

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
async def get_user_auto_reply_config(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get the auto-reply configuration for the current user"""
    # Instead of returning a dict, we use the helper function to get a proper config object
    config = get_auto_reply_config(user.id, db)
    return config


@router.post("/config", response_model=AutoReplyConfig)
async def update_auto_reply_config(
    config: AutoReplyConfig,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the auto-reply configuration for the current user"""
    # Save the config using the helper function
    save_auto_reply_config(user.id, config, db)
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
    # Import background tracking data - needs to be inside function to avoid circular import
    from app.services.background_tasks import last_check_times, reply_statistics
    
    # Get user's auto-reply config
    config = get_auto_reply_config(user.id, db)
    
    # Check for active rate limits
    rate_limit_info = None
    active_limit = GmailRateLimit.get_active_limit(db, user.id)
    if active_limit:
        rate_limit_info = {
            "status": "rate_limited",
            "retry_after": active_limit.retry_after.isoformat(),
        }

    # Get reply statistics from background task tracking
    total_replies = 0
    if user.id in reply_statistics:
        total_replies = reply_statistics[user.id].get("total_replies_sent", 0)
    
    # Get last check time from background task tracking
    last_check_time = None
    if user.id in last_check_times:
        last_check_time = last_check_times[user.id].isoformat()

    # Create the status response
    status = {
        "enabled": config.enabled,
        "total_replies_sent": total_replies,
        "last_check_time": last_check_time,
    }

    # Add rate limit info if present
    if rate_limit_info:
        status["rate_limit"] = rate_limit_info
        
    # Add push notification status
    push_status = {"enabled": config.is_using_push_notifications}
    
    if config.is_using_push_notifications:
        # Parse expiry time if available
        if config.push_notification_expiry:
            try:
                expiry_date = datetime.fromisoformat(config.push_notification_expiry)
                now = datetime.now(timezone.utc)
                days_remaining = (expiry_date - now).days
                
                push_status.update({
                    "expiration": config.push_notification_expiry,
                    "days_remaining": days_remaining,
                    "history_id": config.push_notification_history_id,
                })
            except (ValueError, TypeError):
                # Handle invalid date format
                push_status["expiration"] = None
    
    status["push_notifications"] = push_status

    return status


@router.post("/renew-push-notifications", response_model=Dict[str, Any])
async def renew_push_notifications(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Manually renew Gmail push notifications.
    
    This endpoint allows users to manually refresh their push notification registration
    before it expires, ensuring uninterrupted instant auto-replies.
    """
    try:
        # Check if push notifications are already set up
        config = get_auto_reply_config(user.id, db)
        
        # Set up push notifications again using the existing function
        result = await setup_realtime_notifications(user=user, db=db)
        
        if result.get("success"):
            return {
                "success": True,
                "message": "Gmail push notifications renewed successfully",
                "details": result.get("details"),
            }
        else:
            return {
                "success": False,
                "message": f"Failed to renew push notifications: {result.get('message')}",
            }
            
    except Exception as e:
        logger.error(f"Error renewing push notifications for user {user.id}: {str(e)}")
        return {
            "success": False,
            "message": f"Error renewing push notifications: {str(e)}",
        }


@router.post("/enable-instant-auto-reply")
async def enable_instant_auto_reply(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enable fully automatic instant auto-replies that work without manual intervention.
    
    This comprehensive endpoint configures everything needed for a true instant auto-reply system:
    1. Enables auto-replies for the user
    2. Sets up reliable background polling using the Gmail History API
    3. Performs immediate initial check to establish baseline
    
    This approach is more reliable than webhooks and doesn't depend on Pub/Sub,
    ensuring emails will be automatically replied to without manual intervention.
    """
    try:
        logger.info(f"Setting up fully automatic instant auto-replies for user {user.id}")
        
        # Step 1: Make sure auto-reply is enabled
        config = get_auto_reply_config(user.id, db)
        config.enabled = True
        save_auto_reply_config(user.id, config, db)
        
        # Step 2: Initialize background tasks if not already running
        from app.services.background_tasks import start_background_tasks, check_emails_for_user
        
        # Start the background tasks if not already running
        start_background_tasks()
        
        # Step 3: Run an immediate check to initialize history tracking
        initial_check = await check_emails_for_user(user, db)
        
        # Step 4: Return success with clear instructions
        return {
            "success": True,
            "message": "Instant auto-reply system is now fully operational! New emails will be automatically replied to immediately without any manual intervention.",
            "details": "Using reliable background polling (checking every minute) for maximum reliability"
        }
        
    except Exception as e:
        logger.error(f"Error setting up instant auto-replies for user {user.id}: {str(e)}")
        return {
            "success": False,
            "message": f"Error setting up instant auto-replies: {str(e)}"
        }


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
        service = build_gmail_service(creds)

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
        service = build_gmail_service(creds)

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
        service = build_gmail_service(creds)

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


@router.post("/receive-gmail-push-notification")
async def receive_gmail_push_notification(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Receive a Gmail push notification and trigger immediate auto-replies.
    """
    try:
        # Extract the notification data from the request
        notification_data = await request.json()

        # Process the notification
        await AutoReplyManager.process_gmail_push_notification(
            user=user,
            db=db,
            notification_data=notification_data,
        )

        return {
            "success": True,
            "message": "Gmail push notification processed successfully",
        }

    except Exception as e:
        # Handle errors
        error_message = str(e)
        print(f"Error in receive_gmail_push_notification: {error_message}")

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
            detail=f"Failed to process Gmail push notification: {error_message}",
        )


@router.post("/setup-realtime-notifications", response_model=Dict[str, Any])
async def setup_realtime_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Set up Gmail push notifications to receive real-time email notifications.

    This provides instant auto-replies by eliminating the polling delay.
    """
    try:
        logger.info(f"Setting up Gmail push notifications for user ID: {user.id}")
        
        # Get Google credentials
        credentials = await get_google_creds(user.id, db)
        service = build_gmail_service(credentials)

        # Create a user-specific topic name
        # This ensures each user has their own notification channel
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT', 'default')
        topic = f"projects/{project_id}/topics/gmail-notifications-user-{user.id}"

        # Register for notifications from Gmail with improved filter
        # Using UNREAD filter ensures we only get notifications for new emails
        watch_request = {
            "topicName": topic,
            "labelIds": ["INBOX", "UNREAD"],
            "labelFilterAction": "include",
        }

        try:
            # Call the Gmail API to watch the user's inbox
            watch_response = (
                service.users().watch(userId="me", body=watch_request).execute()
            )
            
            # Get expiration time (in milliseconds since epoch) and convert to datetime
            expiration_ms = int(watch_response.get("expiration", 0))
            expiration_date = datetime.fromtimestamp(expiration_ms / 1000, timezone.utc)
            
            # Store the watch details in the user's auto-reply config
            config = get_auto_reply_config(user.id, db)
            config.is_using_push_notifications = True
            config.push_notification_expiry = expiration_date.isoformat()
            config.push_notification_history_id = watch_response.get("historyId")
            save_auto_reply_config(user.id, config, db)
            
            # Log success
            logger.info(
                f"Gmail push notifications set up for user {user.id}. "
                f"Expires: {expiration_date.isoformat()}"
            )

            # Calculate days until expiration for user feedback
            days_valid = (expiration_date - datetime.now(timezone.utc)).days

            # Return success with the watch details
            return {
                "success": True,
                "message": f"Gmail push notifications set up successfully. Valid for {days_valid} days.",
                "details": {
                    "historyId": watch_response.get("historyId"),
                    "expiration": expiration_date.isoformat(),
                    "topic": topic,
                },
            }

        except Exception as gmail_error:
            logger.error(f"Gmail API error for user {user.id}: {str(gmail_error)}")
            return {
                "success": False,
                "message": f"Gmail API error: {str(gmail_error)}",
            }

    except Exception as e:
        logger.error(f"Error setting up real-time notifications for user {user.id}: {str(e)}")
        return {
            "success": False,
            "message": f"Error setting up notifications: {str(e)}",
        }


@router.post("/webhook", include_in_schema=False)
async def gmail_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Webhook endpoint for Gmail to notify about new messages.
    This endpoint is called by Google's servers when new emails arrive.

    Note: This endpoint doesn't use standard authentication since it's called by Google.
    Instead, it validates the request using a shared secret or token.
    """
    try:
        # Log the webhook call for monitoring purposes
        logger.info("Gmail webhook triggered")
        
        # Get the request data
        payload = await request.json()
        
        # Immediately acknowledge receipt to prevent Google from retrying
        # This is critical for webhook reliability
        acknowledge_response = {"success": True, "message": "Webhook received"}
        
        # Validate the request
        webhook_secret = os.getenv("GMAIL_WEBHOOK_SECRET")
        if webhook_secret and request.headers.get("X-Webhook-Secret") != webhook_secret:
            logger.warning("Webhook called with invalid secret")
            # Still return success to avoid exposing internal validation
            return acknowledge_response
            
        # Extract message data
        if "subscription" not in payload:
            logger.error("Invalid webhook payload - missing subscription")
            return acknowledge_response

        # Extract the user ID from the subscription name
        # Format should be: <topic-name>-user-<user_id>
        subscription = payload.get("subscription", "")
        user_id_match = re.search(r"user-(\d+)$", subscription)

        if not user_id_match:
            logger.error(f"Could not extract user ID from subscription: {subscription}")
            return acknowledge_response

        user_id = int(user_id_match.group(1))
        logger.info(f"Processing webhook for user ID: {user_id}")

        # Get the user from the database
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User not found with ID: {user_id}")
            return acknowledge_response

        # Process the message asynchronously to avoid blocking the webhook response
        # This is critical for webhook reliability and performance
        background_tasks.add_task(
            _process_webhook_message,
            user=user,
            db=db,
            payload=payload,
        )

        # Return success immediately without waiting for processing to complete
        return acknowledge_response

    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        # Always return success to Google to prevent retry loops
        # We'll handle errors internally in the background process
        return {"success": True, "message": "Webhook received, processing internally"}


async def _process_webhook_message(user: User, db: Session, payload: Dict[str, Any]):
    """Process a webhook message asynchronously to generate instant auto-replies"""
    try:
        logger.info(f"Processing Gmail notification for user {user.id}")
        
        # Check if auto-reply is enabled for this user - use the non-async version
        config = get_auto_reply_config(user.id, db)
        if not config.enabled:
            logger.info(f"Auto-reply disabled for user {user.id}, skipping notification processing")
            return

        # Get the message ID from the payload
        if "message" not in payload or "data" not in payload["message"]:
            logger.error("Invalid webhook payload - missing message data")
            return

        # Decode the base64 data
        try:
            data_encoded = payload["message"]["data"]
            data_decoded = base64.b64decode(data_encoded).decode("utf-8")
            data = json.loads(data_decoded)
            
            # Log the notification data for debugging (excluding sensitive info)
            logger.debug(f"Received Gmail notification: {json.dumps({k: v for k, v in data.items() if k != 'email'})}")            
        except Exception as decode_error:
            logger.error(f"Error decoding webhook data: {str(decode_error)}")
            return

        # Extract the email ID or history ID from the notification
        email_id = data.get("emailId")
        history_id = data.get("historyId")
        
        # Create a new database session for the background task
        # This is important to avoid session conflicts in async environment
        from app.db.database import SessionLocal
        db_session = SessionLocal()
        
        try:
            # Refetch user with the new session to avoid session conflicts
            refreshed_user = db_session.query(User).filter(User.id == user.id).first()
            if not refreshed_user:
                logger.error(f"Failed to refetch user {user.id} with new session")
                return
                
            # Check if we're rate limited before proceeding
            active_limit = GmailRateLimit.get_active_limit(db_session, refreshed_user.id, "send_email")
            if active_limit:
                logger.warning(f"User {refreshed_user.id} is rate limited until {active_limit.retry_after}, skipping auto-reply")
                return
            
            if email_id:
                # Direct email ID processing - fastest path
                logger.info(f"Processing single email with ID: {email_id}")
                await AutoReplyManager.process_single_email(
                    user=refreshed_user,
                    db=db_session,
                    email_id=email_id,
                    use_html=False,  # Stick with text for reliability
                )
            elif history_id:
                # History ID processing - for changes since last check
                logger.info(f"Processing history changes since ID: {history_id}")
                # Get timestamp for when we only need emails from the last hour to avoid processing old ones
                time_threshold = datetime.now(timezone.utc) - timedelta(hours=1)
                
                # Process using history ID
                await AutoReplyManager.process_history_updates(
                    user=refreshed_user,
                    db=db_session,
                    history_id=history_id,
                    time_threshold=time_threshold
                )
            else:
                logger.warning("No email ID or history ID in webhook data")
                
        except Exception as process_error:
            logger.error(f"Error processing email for user {user.id}: {str(process_error)}")
            # Consider adding a retry mechanism here for transient errors
        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Unhandled error in webhook processing for user {user.id}: {str(e)}")
        # In a production system, you might want to report this to an error tracking service
