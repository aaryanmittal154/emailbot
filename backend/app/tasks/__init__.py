"""
Background tasks and scheduled jobs.
"""

from app.tasks.notification_scheduler import start_scheduler

__all__ = ["start_scheduler"]
