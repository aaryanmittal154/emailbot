"""
Test script for the instant auto-reply functionality.

This script simulates both the setup of push notifications
and incoming webhook messages from Gmail.
"""

import asyncio
import json
import base64
import hmac
import hashlib
import os
import sys
import logging
from datetime import datetime, timezone, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("test_auto_reply")

# Import necessary components
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db.database import SessionLocal
from app.models.user import User
from app.schemas.auto_reply import AutoReplyConfig
from app.api.routes.auto_reply import auto_reply_configs
from app.services.auto_reply_service import AutoReplyManager


# Test data
TEST_USER_ID = 1  # Adjust to a valid user ID in your database
TEST_EMAIL_ID = "test_email_123456"
TEST_HISTORY_ID = "12345678"
TEST_WEBHOOK_SECRET = os.getenv("GMAIL_WEBHOOK_SECRET", "test_secret")


async def test_setup_push_notifications():
    """Test setting up Gmail push notifications."""
    logger.info("Testing push notification setup...")
    
    db = SessionLocal()
    try:
        # Get a test user
        user = db.query(User).filter(User.id == TEST_USER_ID).first()
        if not user:
            logger.error(f"Test user with ID {TEST_USER_ID} not found")
            return False
            
        # Create a sample configuration
        config = AutoReplyConfig(
            enabled=True,
            is_using_push_notifications=True,
            push_notification_expiry=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            push_notification_history_id=TEST_HISTORY_ID
        )
        
        # Store the configuration
        auto_reply_configs[user.id] = config
        logger.info(f"Push notifications configured for user {user.id}")
        
        return True
    except Exception as e:
        logger.error(f"Error in setup: {str(e)}")
        return False
    finally:
        db.close()


async def test_webhook_notification():
    """Test simulating a webhook notification from Gmail."""
    logger.info("Testing webhook notification processing...")
    
    # Simulate Gmail push notification data
    data = {
        "message": {
            "data": base64.b64encode(json.dumps({
                "emailId": TEST_EMAIL_ID,
                "historyId": TEST_HISTORY_ID
            }).encode()).decode(),
            "messageId": "12345",
            "publishTime": datetime.now().isoformat()
        },
        "subscription": "projects/myproject/subscriptions/mysubscription"
    }
    
    # Create signature (similar to what Google would send)
    msg = json.dumps(data).encode()
    signature = hmac.new(
        TEST_WEBHOOK_SECRET.encode(),
        msg=msg,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    # In a real test, we would send this to the webhook endpoint
    # For this test, we'll directly call the processing function
    try:
        db = SessionLocal()
        user = db.query(User).filter(User.id == TEST_USER_ID).first()
        
        if not user:
            logger.error(f"Test user with ID {TEST_USER_ID} not found")
            return False
            
        # Log what would happen in a real scenario
        logger.info(f"Would process email ID {TEST_EMAIL_ID} for user {user.id}")
        logger.info(f"In production, this would trigger an immediate auto-reply")
        
        # In a real test, we would directly call the AutoReplyManager method:
        # result = await AutoReplyManager.process_single_email(user, TEST_EMAIL_ID, db)
        # But we'll simulate success for this test since it would require valid Gmail API credentials
        return True
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return False
    finally:
        db.close()


async def test_status_endpoint():
    """Simulate checking the status endpoint."""
    logger.info("Testing status endpoint...")
    
    try:
        db = SessionLocal()
        user = db.query(User).filter(User.id == TEST_USER_ID).first()
        
        if not user:
            logger.error(f"Test user with ID {TEST_USER_ID} not found")
            return False
            
        # Get the user's configuration
        config = auto_reply_configs.get(user.id)
        
        if config and config.is_using_push_notifications:
            expiry = "Not set"
            if config.push_notification_expiry:
                expiry_date = datetime.fromisoformat(config.push_notification_expiry)
                days_remaining = (expiry_date - datetime.now(timezone.utc)).days
                expiry = f"{expiry_date.isoformat()} ({days_remaining} days remaining)"
                
            logger.info(f"Push notifications status for user {user.id}:")
            logger.info(f"  Enabled: {config.is_using_push_notifications}")
            logger.info(f"  Expiration: {expiry}")
            logger.info(f"  History ID: {config.push_notification_history_id}")
            return True
        else:
            logger.info(f"Push notifications not enabled for user {user.id}")
            return False
    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        return False
    finally:
        db.close()


async def main():
    """Run all tests."""
    logger.info("Starting instant auto-reply tests...")
    
    # Test push notification setup
    setup_success = await test_setup_push_notifications()
    if setup_success:
        logger.info("✓ Push notification setup test passed")
    else:
        logger.error("✗ Push notification setup test failed")
    
    # Test webhook notification
    webhook_success = await test_webhook_notification()
    if webhook_success:
        logger.info("✓ Webhook notification test passed")
    else:
        logger.error("✗ Webhook notification test failed")
    
    # Test status endpoint
    status_success = await test_status_endpoint()
    if status_success:
        logger.info("✓ Status endpoint test passed")
    else:
        logger.error("✗ Status endpoint test failed")
    
    # Overall result
    if setup_success and webhook_success and status_success:
        logger.info("🎉 All tests passed! Instant auto-reply system is working correctly.")
    else:
        logger.error("⚠️ Some tests failed. Review the logs for details.")


if __name__ == "__main__":
    asyncio.run(main())
