import asyncio
import threading
import time
from datetime import datetime
import os
from typing import Dict, Any, Optional
import requests

# How often to check for new emails (in seconds)
CHECK_INTERVAL = int(
    os.getenv("AUTO_REPLY_CHECK_INTERVAL", "300")
)  # Default: 5 minutes


class EmailScheduler:
    """Scheduler for periodic email checking tasks"""

    def __init__(self):
        self.running = False
        self.thread = None
        self.api_base_url = os.getenv(
            "API_BASE_URL", "https://emailbot-k8s7.onrender.com"
        )
        self.admin_token = os.getenv("ADMIN_API_TOKEN", "")

    def start(self):
        """Start the scheduler in a background thread"""
        if self.thread is not None and self.thread.is_alive():
            print("Scheduler is already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._run_schedule, daemon=True)
        self.thread.start()
        print(f"Email scheduler started, checking every {CHECK_INTERVAL} seconds")

    def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=1.0)
            print("Email scheduler stopped")

    def _run_schedule(self):
        """Main scheduler loop"""
        while self.running:
            try:
                # Only attempt to trigger the auto-reply check if we have an admin token
                if self.admin_token:
                    # Trigger the auto-reply check endpoint
                    self._trigger_auto_reply_check()

                # Sleep until next check time
                for _ in range(CHECK_INTERVAL):
                    if not self.running:
                        break
                    time.sleep(1)

            except Exception as e:
                print(f"Error in scheduler: {str(e)}")
                # Sleep before retrying
                time.sleep(60)

    def _trigger_auto_reply_check(self):
        """Call the auto-reply check endpoint"""
        try:
            headers = {
                "Authorization": f"Bearer {self.admin_token}",
                "Content-Type": "application/json",
            }

            url = f"{self.api_base_url}/api/auto-reply/check-new-emails"
            response = requests.post(url, headers=headers)

            if response.status_code == 200:
                print(f"[{datetime.now()}] Auto-reply check triggered successfully")
            else:
                print(
                    f"[{datetime.now()}] Failed to trigger auto-reply check: {response.status_code} {response.text}"
                )

        except Exception as e:
            print(f"[{datetime.now()}] Error triggering auto-reply check: {str(e)}")


# Create a global instance of the scheduler
scheduler = EmailScheduler()


def start_scheduler():
    """Start the email scheduler"""
    scheduler.start()


def stop_scheduler():
    """Stop the email scheduler"""
    scheduler.stop()
