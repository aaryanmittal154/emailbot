import json
import os
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import logging
from openai import OpenAI

from app.models.user import User
from app.models.email_label import EmailLabel, LabelCategory, ThreadLabel
from app.services.label_service import label_service

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize logger
logger = logging.getLogger(__name__)


class EmailClassifierService:
    """Service for automatic email classification using GPT-4o-mini"""

    @staticmethod
    async def classify_email(
        thread_data: Dict[str, Any], user: User, db: Session
    ) -> Dict[str, Any]:
        """
        Classify an email thread using GPT-4o-mini and apply the appropriate label.
        Also extract structured fields based on the email type.

        Args:
            thread_data: The complete thread data
            user: The current user
            db: Database session

        Returns:
            Dictionary with classification results and extracted fields
        """
        try:
            # Get the email category and its labels
            email_category = (
                db.query(LabelCategory)
                .filter(LabelCategory.name == "Email Types")
                .first()
            )
            if not email_category:
                logger.warning("Email Types category not found, initializing labels")
                label_service.initialize_default_labels(db)
                email_category = (
                    db.query(LabelCategory)
                    .filter(LabelCategory.name == "Email Types")
                    .first()
                )

            email_type_labels = (
                db.query(EmailLabel)
                .filter(EmailLabel.category_id == email_category.id)
                .all()
            )

            # Get email content to analyze
            email_content = EmailClassifierService._extract_email_content(thread_data)

            # Prepare the system prompt
            system_prompt = """
            You are an AI assistant that classifies emails and extracts structured information.
            Analyze the email content and classify it into ONE of these categories:
            1. Job Posting: Emails containing job opportunities, listings, or recruitment needs.
            2. Candidate: Emails from job applicants, about applicants, or candidate-related communications.
            3. Event: Emails about events, meetings, webinars, conferences, or gatherings.

            For each type, also extract these fields:

            JOB POSTING:
            - company_name: The company offering the job
            - position: The job title or position
            - location: Where the job is located (remote, city, etc.)
            - salary_range: Salary information if available
            - requirements: Key skills or requirements
            - application_deadline: When to apply by (if mentioned)

            CANDIDATE:
            - candidate_name: Name of the candidate
            - position_applied: Position they're applying for
            - experience_years: Years of experience
            - key_skills: Main skills of the candidate
            - education: Educational background
            - availability: When they can start

            EVENT:
            - event_name: Name of the event
            - event_date: When it's happening
            - event_time: Time of the event
            - location: Where it's happening (virtual, physical location)
            - description: Brief description of the event
            - registration_deadline: When to register by (if mentioned)

            RESPONSE FORMAT:
            Return a JSON object with:
            1. "classification": ONE of ["Job Posting", "Candidate", "Event"]
            2. "confidence": A number from 0-100 indicating confidence in the classification
            3. "fields": An object containing the appropriate fields for the classification type
            4. "reasoning": Brief explanation of why this classification was chosen
            """

            # Generate the classification with GPT-4o-mini
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": f"Please classify this email:\n\n{email_content}",
                        },
                    ],
                    temperature=0.2,
                    response_format={"type": "json_object"},
                )

                classification_result = json.loads(response.choices[0].message.content)
                logger.debug(f"Email classification: {classification_result}")

                # Find the matching label
                label = next(
                    (
                        label
                        for label in email_type_labels
                        if label.name == classification_result["classification"]
                    ),
                    None,
                )

                if label:
                    # Apply the label to the thread with the calculated confidence
                    confidence = classification_result.get("confidence", 85)
                    thread_label = label_service.add_label_to_thread(
                        thread_id=thread_data["thread_id"],
                        label_id=label.id,
                        user_id=user.id,
                        confidence=confidence,
                        is_confirmed=False,  # Auto-applied labels are not confirmed
                        db=db,
                    )

                    logger.info(
                        f"Applied label '{label.name}' to thread {thread_data['thread_id']} "
                        f"with {confidence}% confidence"
                    )

                    # Return the classification data and label info
                    return {
                        "success": True,
                        "thread_id": thread_data["thread_id"],
                        "classification": classification_result["classification"],
                        "confidence": confidence,
                        "fields": classification_result.get("fields", {}),
                        "reasoning": classification_result.get("reasoning", ""),
                        "label_id": label.id,
                        "label_name": label.name,
                        "label_color": label.color,
                    }
                else:
                    logger.warning(
                        f"No matching label found for classification: {classification_result['classification']}"
                    )
                    return {
                        "success": False,
                        "message": f"No matching label found for classification: {classification_result['classification']}",
                    }

            except Exception as e:
                logger.error(f"Error generating classification with GPT: {str(e)}")
                return {
                    "success": False,
                    "message": f"Error generating classification: {str(e)}",
                }

        except Exception as e:
            logger.error(f"Error in email classification: {str(e)}")
            return {"success": False, "message": f"Error classifying email: {str(e)}"}

    @staticmethod
    def _extract_email_content(thread_data: Dict[str, Any]) -> str:
        """Extract the relevant content from an email thread for classification"""
        content = f"Subject: {thread_data.get('subject', '(No Subject)')}\n\n"

        # Get the messages in the thread
        messages = thread_data.get("messages", [])

        # If there are messages, extract the content from the most recent one
        if messages:
            # Use the most recent (last) message for classification
            latest_message = messages[-1]

            content += f"From: {latest_message.get('sender', '(Unknown)')}\n"

            # Extract recipients if available
            recipients = latest_message.get("recipients", [])
            if recipients:
                content += f"To: {', '.join(recipients)}\n"

            # Add the message body or snippet
            if "body" in latest_message and latest_message["body"]:
                # For HTML content, we would want to extract just the text
                # This is a simplified version
                body = latest_message["body"]
                # Remove HTML tags if present (very basic approach)
                import re

                body = re.sub(r"<[^>]*>", " ", body)
                content += f"\nBody:\n{body}"
            elif "snippet" in latest_message:
                content += f"\nBody:\n{latest_message['snippet']}"

            # Add context from earlier messages if needed
            if len(messages) > 1:
                content += "\n\nEarlier in the conversation:\n"
                for i, message in enumerate(messages[:-1]):
                    if i > 2:  # Limit to 3 previous messages to avoid too much content
                        break
                    content += f"Message from {message.get('sender', '(Unknown)')}:\n"
                    if "snippet" in message:
                        content += f"{message['snippet']}\n\n"

        return content


# Create a singleton instance
email_classifier = EmailClassifierService()
