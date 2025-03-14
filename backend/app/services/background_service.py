"""
Background Service Module for 24/7 Email Auto-Replies
This module handles scheduling and processing emails in the background,
even when users are not actively logged into the application.
"""

import time
import threading
import schedule
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy import text

from app.db.db import Database
from app.services.email_service import EmailService
from app.services.auth_service import get_google_creds, refresh_token, get_background_preferences
from app.services.vector_store import VectorStore

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("background_service.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("background_service")

def log_background_service_event(user_id, event_type, status, details=None, db=None):
    """Log a background service event to the database"""
    if db is None:
        from app.db.database import SessionLocal
        db = SessionLocal()
        local_db = True
    else:
        local_db = False
    
    try:
        query = text("""
            INSERT INTO background_service_logs
            (user_id, event_type, status, details)
            VALUES (:user_id, :event_type, :status, :details)
        """)
        
        db.execute(query, {
            "user_id": user_id,
            "event_type": event_type,
            "status": status,
            "details": details or {}
        })
        
        if local_db:
            db.commit()
    except Exception as e:
        logger.error(f"Error logging background service event: {str(e)}")
        if local_db:
            db.rollback()
    finally:
        if local_db:
            db.close()

class BackgroundService:
    """Service to handle background email processing and auto-replies"""
    
    def __init__(self):
        self.db = Database()
        self.email_service = EmailService()
        self.vector_store = VectorStore()
        self.is_running = False
        self.thread = None
    
    def start(self):
        """Start the background service"""
        if self.is_running:
            logger.info("Background service is already running")
            return
            
        logger.info("Starting background service")
        self.is_running = True
        
        # Set up the schedule for checking emails
        # Check every 10 minutes by default
        schedule.every(10).minutes.do(self.process_all_users)
        
        # Add an additional check every minute to see if any users are enabled
        # This allows the service to quickly respond when users enable the service
        schedule.every(1).minutes.do(self.check_service_status)
        
        # Start the scheduler in a separate thread
        self.thread = threading.Thread(target=self._run_scheduler)
        self.thread.daemon = True
        self.thread.start()
        
        logger.info("Background service started successfully")
        
    def stop(self):
        """Stop the background service"""
        if not self.is_running:
            logger.info("Background service is not running")
            return
            
        logger.info("Stopping background service")
        self.is_running = False
        
        # Clear all scheduled jobs
        schedule.clear()
        
        # Wait for the thread to finish if it's running
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
            
        logger.info("Background service stopped successfully")
        
    def _run_scheduler(self):
        """Run the scheduler in a loop"""
        logger.info("Scheduler thread started")
        
        while self.is_running:
            schedule.run_pending()
            time.sleep(1)
            
        logger.info("Scheduler thread stopped")
        
    def process_all_users(self):
        """Process all users with background service enabled"""
        logger.info("Processing all users with background service enabled")
        
        try:
            # First check if we have any users with background service enabled
            # If not, don't proceed further
            active_count = self.count_enabled_users()
            if active_count == 0:
                logger.info("No users with background service enabled, skipping processing cycle")
                return
                
            # Get all users with background service enabled
            users = self.get_enabled_users()
            logger.info(f"Found {len(users)} users with background service enabled")
            
            for user in users:
                try:
                    # Double-check the enabled status again in case it changed during processing
                    if not self.verify_user_service_eligibility(user['id']):
                        logger.info(f"User {user['id']} does not meet service eligibility, skipping")
                        continue
                        
                    self.process_user(user)
                except Exception as e:
                    logger.error(f"Error processing user {user['id']}: {str(e)}")
                    log_background_service_event(
                        user_id=user['id'],
                        event_type="process_user",
                        status="error",
                        details={"error": str(e)},
                        db=self.db
                    )
        except Exception as e:
            logger.error(f"Error in process_all_users: {str(e)}")
            
        logger.info("Finished processing all users")
        
    def get_enabled_users(self) -> List[Dict[str, Any]]:
        """Get all users with background service enabled"""
        query = """
            SELECT 
                u.id, 
                u.email, 
                t.refresh_token,
                p.schedule_start_time,
                p.schedule_end_time,
                p.active_days,
                p.max_daily_emails
            FROM users u
            JOIN oauth_tokens t ON u.id = t.user_id
            JOIN user_background_preferences p ON u.id = p.user_id
            WHERE p.background_enabled = TRUE
        """
        
        return self.db.query(query)
        
    def process_user(self, user: Dict[str, Any]):
        """Process a single user's emails"""
        user_id = user['id']
        logger.info(f"Processing user {user_id}")
        
        # Double-check eligibility right before processing to catch any changes
        if not self.verify_user_service_eligibility(user_id):
            logger.info(f"User {user_id} is no longer eligible for background service, skipping")
            return
            
        # Check if user is within active schedule
        if not self.is_within_active_schedule(user):
            logger.info(f"User {user_id} is outside active schedule, skipping")
            return
            
        # Check daily email limit
        if self.has_reached_daily_limit(user_id, user['max_daily_emails']):
            logger.info(f"User {user_id} has reached daily email limit, skipping")
            return
            
        try:
            # Refresh the access token
            access_token = refresh_token(user['refresh_token'])
            
            # Check for new emails using the refreshed token
            new_emails = self.email_service.get_unreplied_emails(
                user_id=user_id,
                access_token=access_token,
                max_results=20
            )
            
            logger.info(f"Found {len(new_emails)} new emails for user {user_id}")
            
            # Generate and send auto-replies
            replied_count = 0
            for email in new_emails:
                try:
                    # Check if we've hit the daily limit
                    if self.has_reached_daily_limit(user_id, user['max_daily_emails']):
                        logger.info(f"User {user_id} reached daily limit during processing, stopping")
                        break
                        
                    # Process the email
                    result = self.process_email(user_id, email, access_token)
                    
                    if result['reply_sent']:
                        replied_count += 1
                        
                except Exception as e:
                    logger.error(f"Error processing email {email['thread_id']} for user {user_id}: {str(e)}")
                    
            # Log successful activity
            log_background_service_event(
                user_id=user_id,
                event_type="auto_reply_check",
                status="success",
                details={
                    "emails_processed": len(new_emails),
                    "emails_replied": replied_count
                },
                db=self.db
            )
            
        except Exception as e:
            logger.error(f"Error in process_user for {user_id}: {str(e)}")
            log_background_service_event(
                user_id=user_id,
                event_type="process_user",
                status="error",
                details={"error": str(e)},
                db=self.db
            )
            
    def process_email(self, user_id: str, email: Dict[str, Any], access_token: str) -> Dict[str, Any]:
        """Process a single email with auto-reply"""
        thread_id = email['thread_id']
        logger.info(f"Processing email {thread_id} for user {user_id}")
        
        try:
            # Classify the email
            classification = self.email_service.classify_thread(thread_id)
            primary_category = classification['primary_label']
            
            # Get context based on classification
            context = self.gather_cross_category_context(thread_id, primary_category)
            
            # Generate the auto-reply
            reply = self.email_service.generate_auto_reply(
                thread_id=thread_id,
                context=context,
                user_id=user_id
            )
            
            # Send the reply
            send_result = self.email_service.send_reply(
                thread_id=thread_id,
                reply=reply,
                access_token=access_token,
                user_id=user_id
            )
            
            # Mark as replied
            self.email_service.mark_as_replied(thread_id, user_id)
            
            # Log the auto-reply
            log_background_service_event(
                user_id=user_id,
                event_type="auto_reply",
                status="success",
                details={
                    "thread_id": thread_id,
                    "category": primary_category
                },
                db=self.db
            )
            
            return {
                "thread_id": thread_id,
                "category": primary_category,
                "reply_sent": True
            }
            
        except Exception as e:
            logger.error(f"Error processing email {thread_id}: {str(e)}")
            
            # Log the error
            log_background_service_event(
                user_id=user_id,
                event_type="auto_reply",
                status="error",
                details={
                    "thread_id": thread_id,
                    "error": str(e)
                },
                db=self.db
            )
            
            return {
                "thread_id": thread_id,
                "reply_sent": False,
                "error": str(e)
            }
            
    def gather_cross_category_context(self, thread_id: str, primary_category: str) -> List[Dict[str, Any]]:
        """Gather cross-category context for auto-reply"""
        # Specialized categories
        specialized_categories = ['Job Posting', 'Candidate']
        general_categories = ['Questions', 'Discussion Topics', 'Events', 'Other']
        
        # For job postings, find matching candidates
        if primary_category == 'Job Posting':
            return self.email_service.get_matching_candidates(thread_id)
            
        # For candidates, find matching jobs
        elif primary_category == 'Candidate':
            return self.email_service.get_matching_jobs(thread_id)
            
        # For general categories, use cross-category context
        elif primary_category in general_categories:
            # Get thread content
            thread = self.email_service.get_thread(thread_id)
            
            # Prepare query text
            query_text = self._prepare_query_text(thread)
            
            # Perform cross-category search
            return self.vector_store.search_vectors(
                query_text=query_text,
                include_labels=general_categories,
                exclude_labels=specialized_categories,
                exclude_thread_ids=[thread_id],
                limit=10
            )
        
        # Default: just find similar emails in the same category
        else:
            # Get thread content
            thread = self.email_service.get_thread(thread_id)
            
            # Prepare query text
            query_text = self._prepare_query_text(thread)
            
            # Perform single-category search
            return self.vector_store.search_vectors(
                query_text=query_text,
                include_labels=[primary_category],
                exclude_thread_ids=[thread_id],
                limit=5
            )
            
    def _prepare_query_text(self, thread: Dict[str, Any]) -> str:
        """Prepare query text from thread content"""
        parts = []
        
        if thread.get('subject'):
            parts.append(thread['subject'])
            
        if thread.get('snippet'):
            parts.append(thread['snippet'])
            
        return ' '.join(parts)
            
    def is_within_active_schedule(self, user: Dict[str, Any]) -> bool:
        """Check if current time is within user's active schedule"""
        # Get current time and day
        now = datetime.now()
        current_time = now.time()
        current_day = str(now.weekday() + 1)  # 1-7 for Monday-Sunday
        
        # Check if today is an active day
        active_days = user.get('active_days', '1,2,3,4,5,6,7')  # Default to all days
        if active_days and current_day not in active_days.split(','):
            return False
            
        # Check if current time is within active hours
        start_time = user.get('schedule_start_time')
        end_time = user.get('schedule_end_time')
        
        # If no specific times, assume 24/7
        if not start_time or not end_time:
            return True
            
        # Parse times from string if needed
        if isinstance(start_time, str):
            start_time = datetime.strptime(start_time, '%H:%M:%S').time()
        if isinstance(end_time, str):
            end_time = datetime.strptime(end_time, '%H:%M:%S').time()
            
        # Check if current time is within range
        if start_time <= end_time:
            # Normal case: start < end (e.g., 9:00 to 17:00)
            return start_time <= current_time <= end_time
        else:
            # Overnight case: start > end (e.g., 22:00 to 06:00)
            return current_time >= start_time or current_time <= end_time
            
    def has_reached_daily_limit(self, user_id: str, max_daily_emails: int) -> bool:
        """Check if user has reached their daily email limit"""
        query = """
            SELECT COUNT(*) as reply_count
            FROM background_service_logs
            WHERE user_id = %s
            AND event_type = 'auto_reply'
            AND status = 'success'
            AND DATE(created_at) = CURRENT_DATE
        """
        
        result = self.db.query_one(query, [user_id])
        reply_count = result['reply_count'] if result else 0
        
        return reply_count >= max_daily_emails
            
    def check_service_status(self):
        """Check if any users have background service enabled"""
        try:
            active_count = self.count_enabled_users()
            logger.info(f"Background service status check: {active_count} active users")
            
            # Log the status check
            log_background_service_event(
                user_id=0,  # System user ID
                event_type="status_check", 
                status="success",
                details={"active_users": active_count},
                db=self.db
            )
            
            return active_count > 0
        except Exception as e:
            logger.error(f"Error checking service status: {str(e)}")
            return False
        
    def count_enabled_users(self) -> int:
        """Count users with background service enabled"""
        query = """
            SELECT COUNT(*)
            FROM user_background_preferences
            WHERE background_enabled = TRUE
        """
        
        result = self.db.query_one(query)
        return result['count'] if result and 'count' in result else 0
        
    def is_user_enabled(self, user_id: int) -> bool:
        """Check if a specific user has background service enabled"""
        query = """
            SELECT background_enabled 
            FROM user_background_preferences 
            WHERE user_id = %s
        """
        
        result = self.db.query_one(query, [user_id])
        return result['background_enabled'] if result and 'background_enabled' in result else False
        
    def verify_user_service_eligibility(self, user_id: int) -> bool:
        """
        Comprehensive verification if a user's background service should run.
        Checks both if service is enabled AND if user has valid tokens.
        
        Args:
            user_id: User ID to check
            
        Returns:
            bool: True if service should run for user, False otherwise
        """
        # First check if the service is enabled in preferences
        if not self.is_user_enabled(user_id):
            return False
            
        # Then verify the user has valid refresh tokens
        query = """
            SELECT 1 
            FROM tokens 
            WHERE user_id = %s AND refresh_token IS NOT NULL
            UNION
            SELECT 1 
            FROM oauth_tokens 
            WHERE user_id = %s AND refresh_token IS NOT NULL
        """
        
        result = self.db.query_one(query, [user_id, user_id])
        return result is not None


# Singleton instance
background_service = BackgroundService()

def initialize_background_service():
    """Initialize and start the background service"""
    background_service.start()
    return background_service
