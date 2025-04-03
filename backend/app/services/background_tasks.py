"""
Background task scheduler for the EmailBot application.
Handles periodic checks for new emails and other background processes.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import os
import time
import threading
import traceback

from app.db.database import SessionLocal
from app.models.user import User
from app.models.gmail_rate_limit import GmailRateLimit
from app.services.auth_service import get_google_creds
from app.services.email_service import build_gmail_service
from app.services.thread_monitoring_service import ThreadMonitoringService

# Import AutoReplyManager at runtime to avoid circular imports

# Set up logging
logger = logging.getLogger(__name__)

# Interval between email checks in seconds (1 minute by default)
CHECK_INTERVAL = int(os.getenv("EMAIL_CHECK_INTERVAL_SECONDS", "60"))

# The maximum number of users to process in a single batch
BATCH_SIZE = int(os.getenv("EMAIL_CHECK_BATCH_SIZE", "10"))

# Store the last history ID processed for each user
last_history_ids: Dict[int, str] = {}

# Store the last check time and reply stats for each user
last_check_times: Dict[int, datetime] = {}
reply_statistics: Dict[int, Dict[str, int]] = {}

# Flag to control the background task loop
should_continue = True
task_thread = None


def get_last_history_id(user_id: int) -> Optional[str]:
    """
    Get the last Gmail history ID processed for a user.
    This is used to only fetch changes since the last check.
    """
    return last_history_ids.get(user_id)


def save_last_history_id(user_id: int, history_id: str):
    """
    Save the last Gmail history ID processed for a user.
    """
    last_history_ids[user_id] = history_id


def update_user_check_stats(user_id: int, replied_count: int = 0):
    """
    Update the statistics for a user's auto-reply check.
    """
    # Update the last check time
    last_check_times[user_id] = datetime.now(timezone.utc)

    # Initialize stats dictionary if it doesn't exist
    if user_id not in reply_statistics:
        reply_statistics[user_id] = {"total_replies_sent": 0}

    # Update the total replies sent
    if replied_count > 0:
        reply_statistics[user_id]["total_replies_sent"] = (
            reply_statistics[user_id].get("total_replies_sent", 0) + replied_count
        )


async def check_emails_for_user(user: User, db: Session) -> Dict[str, Any]:
    """
    Check for new emails for a single user using the Gmail History API.
    This is more reliable than webhooks as it ensures we don't miss any emails.
    """
    try:
        # Skip if user has an active rate limit
        active_limit = GmailRateLimit.get_active_limit(db, user.id)
        if active_limit:
            logger.info(
                f"Skipping email check for user {user.id} due to rate limit until {active_limit.retry_after}"
            )
            # Still update the check time even if rate limited
            update_user_check_stats(user.id, 0)
            return {"success": False, "rate_limited": True}

        # Get Google credentials
        credentials = get_google_creds(user.id, db)
        service = build_gmail_service(credentials)

        # Get the last history ID we processed
        last_history_id = get_last_history_id(user.id)

        if not last_history_id:
            # If we don't have a history ID yet, get the current one
            # This avoids processing existing emails on first run
            profile = service.users().getProfile(userId="me").execute()
            last_history_id = profile.get("historyId")
            save_last_history_id(user.id, last_history_id)
            return {"success": True, "message": "Initialized history ID tracking"}

        # Get all changes since the last history ID
        time_threshold = datetime.now(timezone.utc) - timedelta(hours=1)

        # Use the AutoReplyManager to process the history (runtime import to avoid circular imports)
        from app.services.auto_reply_service import AutoReplyManager

        result = await AutoReplyManager.process_history_updates(
            user=user, db=db, history_id=last_history_id, time_threshold=time_threshold
        )

        # Get the latest history ID from the result and save it
        if result.get("success") and "latest_history_id" in result:
            save_last_history_id(user.id, result["latest_history_id"])

        # Update the user's statistics
        replied_count = result.get("replied_count", 0)
        update_user_check_stats(user.id, replied_count)

        return result

    except Exception as e:
        logger.error(f"Error checking emails for user {user.id}: {str(e)}")
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def periodic_email_check():
    """
    Periodically check for new emails for all users with auto-reply enabled.
    This runs in the background and processes users in batches.
    """
    while should_continue:
        try:
            # Get a new database session for this check
            db = SessionLocal()

            try:
                # Get all users with auto-reply enabled
                from app.api.routes.auto_reply import get_auto_reply_config

                # Query all users
                users = db.query(User).all()
                auto_reply_users = []

                # Filter to those with auto-reply enabled
                for user in users:
                    try:
                        config = get_auto_reply_config(user.id, db)
                        if config.enabled:
                            auto_reply_users.append(user)
                    except Exception as user_error:
                        logger.error(
                            f"Error checking auto-reply config for user {user.id}: {str(user_error)}"
                        )

                # Process users in batches
                for i in range(0, len(auto_reply_users), BATCH_SIZE):
                    batch = auto_reply_users[i : i + BATCH_SIZE]

                    # Check emails for each user in the batch
                    for user in batch:
                        logger.info(f"Checking emails for user {user.id}")
                        await check_emails_for_user(user, db)

                    # Add a small delay between batches to avoid API rate limits
                    if i + BATCH_SIZE < len(auto_reply_users):
                        await asyncio.sleep(2)

            finally:
                # Always close the database session
                db.close()

            # Wait until the next check interval
            await asyncio.sleep(CHECK_INTERVAL)

        except Exception as e:
            logger.error(f"Error in periodic email check: {str(e)}")
            traceback.print_exc()
            # Wait a bit before retrying after an error
            await asyncio.sleep(10)


def _run_background_tasks():
    """
    Run the background tasks in a separate thread.
    This is called when the application starts.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Start the periodic email check
    loop.run_until_complete(periodic_email_check())
    loop.close()


def start_background_tasks():
    """
    Start the background tasks in a separate thread.
    This should be called when the application starts.
    """
    global task_thread, should_continue

    # Don't start if already running
    if task_thread and task_thread.is_alive():
        return

    # Set the flag to allow the loop to run
    should_continue = True

    # Start the background thread
    task_thread = threading.Thread(target=_run_background_tasks, daemon=True)
    task_thread.start()

    logger.info("Started background tasks for email checking")


def stop_background_tasks():
    """
    Stop the background tasks.
    This should be called when the application shuts down.
    """
    global should_continue
    should_continue = False
    logger.info("Stopping background tasks")


async def run_background_checks(user_id: int):
    """Run periodic background checks for a specific user"""
    # ...existing code...

    # Add thread monitoring check
    try:
        logger.info(f"Checking monitored threads for user {user_id}")
        # Get user and db session
        db = SessionLocal()
        user = db.query(User).filter(User.id == user_id).first()

        if user:
            # Check for updates in monitored threads
            thread_result = await ThreadMonitoringService.check_for_thread_updates(
                user=user, db=db, max_results=50  # Limit to 50 threads per check
            )

            logger.info(f"Thread monitoring check complete: {thread_result['message']}")

    except Exception as e:
        logger.error(f"Error in thread monitoring background check: {str(e)}")
    finally:
        db.close()

    # ...rest of the function...
