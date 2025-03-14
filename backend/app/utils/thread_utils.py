"""
Utility functions for working with email threads that are used across multiple services.
This module helps prevent circular imports by providing common functionality.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session


def get_thread_category(thread_id: str, user_id: int, db: Session) -> str:
    """
    Get the category of a thread based on its labels

    Args:
        thread_id: The ID of the thread
        user_id: The ID of the user
        db: Database session

    Returns:
        String with the thread category (Job Posting, Candidate, etc.) or empty string if not found
    """
    try:
        from app.models.email_label import ThreadLabel, EmailLabel

        # Get thread labels
        thread_label = (
            db.query(ThreadLabel)
            .join(EmailLabel, ThreadLabel.label_id == EmailLabel.id)
            .filter(
                ThreadLabel.thread_id == thread_id,
                ThreadLabel.user_id == user_id,
                EmailLabel.name.in_(["Job Posting", "Candidate", "Event"]),
            )
            .order_by(ThreadLabel.confidence.desc())
            .first()
        )

        if thread_label and hasattr(thread_label, "label") and thread_label.label:
            return thread_label.label.name

        return ""
    except Exception as e:
        print(f"Error getting thread category: {str(e)}")
        return ""


def extract_thread_content(thread_data: Dict[str, Any]) -> str:
    """
    Extract text content from a thread for processing

    Args:
        thread_data: Thread data with messages

    Returns:
        Plain text content of the thread
    """
    text_content = f"Subject: {thread_data.get('subject', 'No Subject')}\n\n"

    for message in thread_data.get("messages", []):
        sender = message.get("sender", "Unknown")
        text_content += f"From: {sender}\n"

        # Get message content - prefer body if available, otherwise snippet
        content = message.get("body", message.get("snippet", ""))

        # Remove HTML if present (basic approach)
        import re

        if content and "<" in content and ">" in content:
            content = re.sub(r"<[^>]*>", " ", content)

        text_content += f"{content}\n\n"

    return text_content
