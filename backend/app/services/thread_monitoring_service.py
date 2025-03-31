from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import logging

from app.db.database import get_db
from app.models.user import User
from app.services.email_service import get_thread, get_gmail_service
from app.services.auth_service import get_google_creds
from app.services.embedding_service import create_thread_embedding
from app.services.vector_db_service import vector_db

# Initialize logger
logger = logging.getLogger(__name__)


class ThreadMonitoringService:
    """Monitors threads where an autoreply was sent and updates the vector database with new responses"""

    # Track threads we've already sent autoreplies to
    monitored_threads = set()

    @staticmethod
    def register_thread_for_monitoring(thread_id: str, user_id: int):
        """Register a thread for monitoring after an autoreply is sent"""
        thread_key = f"{user_id}:{thread_id}"
        ThreadMonitoringService.monitored_threads.add(thread_key)
        logger.info(f"Registered thread {thread_id} for monitoring (user {user_id})")

    @staticmethod
    async def check_for_thread_updates(
        user: User,
        db: Session,
        max_results: int = 50,
    ) -> Dict[str, Any]:
        """
        Check monitored threads for new messages and update the vector database
        """
        try:
            # Get list of monitored threads for this user
            user_monitored_threads = [
                thread_id.split(":", 1)[1]
                for thread_id in ThreadMonitoringService.monitored_threads
                if thread_id.startswith(f"{user.id}:")
            ]

            if not user_monitored_threads:
                return {
                    "success": True,
                    "message": "No monitored threads found for this user",
                    "threads_checked": 0,
                    "threads_updated": 0,
                }

            # Get credentials and build service
            credentials = get_google_creds(user.id, db)
            service = get_gmail_service(credentials)

            # Limit the number of threads to check
            threads_to_check = user_monitored_threads[:max_results]
            threads_updated = 0

            for thread_id in threads_to_check:
                try:
                    # Get current thread data
                    current_thread = get_thread(
                        thread_id=thread_id,
                        user=user,
                        db=db,
                        store_embedding=False,  # Don't store yet, we'll do it manually if needed
                    )

                    # Query the vector DB to see if we have an older version
                    thread_in_vector = vector_db.get_thread_by_id(user.id, thread_id)

                    # If thread exists and has a different message count, it needs updating
                    if thread_in_vector and len(
                        current_thread["messages"]
                    ) > thread_in_vector.get("message_count", 0):
                        # Update the thread in vector storage
                        logger.info(
                            f"Updating thread {thread_id} in vector database - new messages detected"
                        )

                        # Store updated thread in vector DB
                        updated_thread = get_thread(
                            thread_id=thread_id,
                            user=user,
                            db=db,
                            store_embedding=True,  # Store the updated thread embedding
                        )

                        threads_updated += 1
                        logger.info(f"Thread {thread_id} updated in vector database")

                except Exception as e:
                    logger.error(f"Error checking thread {thread_id}: {str(e)}")
                    continue

            return {
                "success": True,
                "message": f"Checked {len(threads_to_check)} monitored threads, updated {threads_updated}",
                "threads_checked": len(threads_to_check),
                "threads_updated": threads_updated,
            }

        except Exception as e:
            logger.error(f"Error in thread monitoring service: {str(e)}")
            return {
                "success": False,
                "message": f"Error monitoring threads: {str(e)}",
                "threads_checked": 0,
                "threads_updated": 0,
            }

    @staticmethod
    async def process_gmail_push_notification(
        user: User, db: Session, notification_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a Gmail push notification.
        If the thread exists in the vector DB (indicating prior interaction),
        update it with the latest message.
        """
        try:
            logger.info(
                f"Processing Gmail push notification for thread monitoring (user {user.id})"
            )

            # Extract message ID from notification
            message_info = notification_data.get("message", {})
            message_id = message_info.get("data", {}).get("emailMessageId")
            if not message_id:
                logger.error("No message ID in notification")
                return {"success": False, "message": "No message ID in notification"}

            # Get thread ID
            credentials = get_google_creds(user.id, db)
            service = get_gmail_service(credentials)
            message = (
                service.users().messages().get(userId="me", id=message_id).execute()
            )
            thread_id = message.get("threadId")
            if not thread_id:
                logger.error(f"No thread ID found for message {message_id}")
                return {
                    "success": False,
                    "message": f"No thread ID found for message {message_id}",
                }

            # Check if this thread exists in our vector database
            has_prior_response = False
            try:
                thread_in_vector = vector_db.get_thread_by_id(user.id, thread_id)
                has_prior_response = thread_in_vector is not None
            except Exception as e:
                logger.warning(
                    f"Error checking vector DB for thread {thread_id}: {str(e)}"
                )
                # Proceed cautiously - we don't know if it *should* be monitored

            # If the thread exists in the vector DB, update it
            if has_prior_response:
                logger.info(
                    f"Thread {thread_id} has prior interaction, updating vector DB"
                )

                # Ensure thread is registered for future explicit checks
                thread_key = f"{user.id}:{thread_id}"
                explicitly_monitored = (
                    thread_key in ThreadMonitoringService.monitored_threads
                )
                if not explicitly_monitored:
                    ThreadMonitoringService.register_thread_for_monitoring(
                        thread_id, user.id
                    )
                    logger.info(f"Thread {thread_id} added to explicit monitoring list")

                # Get the full, latest thread data and store its embedding
                try:
                    updated_thread = get_thread(
                        thread_id=thread_id,
                        user=user,
                        db=db,
                        store_embedding=True,  # This triggers the upsert in vector_db
                    )
                    logger.info(
                        f"Thread {thread_id} successfully updated in vector database"
                    )
                    return {
                        "success": True,
                        "message": f"Thread {thread_id} updated in vector database",
                        "thread_id": thread_id,
                        "is_monitored": True,  # Indicates processing occurred
                        "explicitly_monitored": explicitly_monitored,
                        "had_prior_response": True,
                    }
                except Exception as update_error:
                    logger.error(
                        f"Error updating thread {thread_id} in vector DB: {str(update_error)}"
                    )
                    return {
                        "success": False,
                        "message": f"Error updating thread {thread_id}: {str(update_error)}",
                    }
            else:
                # Thread not found in vector DB, means no prior interaction/autoreply
                logger.info(
                    f"Thread {thread_id} has no prior interactions, skipping monitoring update"
                )
                return {
                    "success": True,
                    "message": "Thread not monitored (no prior interaction)",
                    "thread_id": thread_id,
                    "is_monitored": False,
                }

        except Exception as e:
            logger.error(
                f"Error processing notification for thread monitoring: {str(e)}"
            )
            return {
                "success": False,
                "message": f"Error processing notification: {str(e)}",
            }
