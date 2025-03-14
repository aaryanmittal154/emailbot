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

            # Get the communication types category and its labels
            communication_category = (
                db.query(LabelCategory)
                .filter(LabelCategory.name == "Communication Types")
                .first()
            )
            if not communication_category:
                logger.warning(
                    "Communication Types category not found, initializing labels"
                )
                label_service.initialize_default_labels(db)
                communication_category = (
                    db.query(LabelCategory)
                    .filter(LabelCategory.name == "Communication Types")
                    .first()
                )

            communication_type_labels = (
                db.query(EmailLabel)
                .filter(EmailLabel.category_id == communication_category.id)
                .all()
            )

            # Combine all labels for classification
            all_labels = email_type_labels + communication_type_labels

            # Get email content to analyze
            email_content = EmailClassifierService._extract_email_content(thread_data)

            # Prepare the system prompt
            system_prompt = """
            You are a specialized email classification system with STRICT categorization rules.
            Your ONLY purpose is to analyze emails and assign them to EXACTLY ONE category with complete precision.

            ## CLASSIFICATION HIERARCHY (FOLLOW THIS ORDER)

            STEP 1: Identify if the email's PRIMARY FOCUS is:
            - Describing an open job position → JOB POSTING
            - Discussing a specific person's candidacy → CANDIDATE
            - Announcing a scheduled gathering → EVENT
            - Primarily asking for information → QUESTIONS
            - Introducing a topic for discussion → DISCUSSION TOPICS
            - If none of above apply → OTHER

            STEP 2: If unclear from primary focus, use these DECISIVE INDICATORS:

            FOR JOB POSTING (ANY of these):
            - Subject contains: "hiring", "job opening", "position", "vacancy", "opportunity at [company]"
            - Email describes specific role responsibilities
            - Email lists job requirements or qualifications needed
            - Email is written from an employer's perspective about their needs
            - Email mentions application process for a specific role

            FOR CANDIDATE (ANY of these):
            - Subject contains: "candidate", "applicant", "resume", "seeking position", "looking for job"
            - Email discusses someone's work history, skills, or qualifications
            - Email is written from perspective of someone seeking work
            - Email refers to a specific person being recommended or considered
            - Email mentions matching people to jobs (rather than jobs to people)

            FOR EVENT (ANY of these):
            - Subject contains: "meeting", "webinar", "conference", "event", "session"
            - Email mentions specific date, time and location for a gathering
            - Email includes registration or attendance information
            - Email describes agenda or speakers

            FOR QUESTIONS (ANY of these):
            - Subject or body contains multiple question marks
            - Email specifically requests information, clarification, or explanations
            - Email uses interrogative language (who, what, when, where, why, how)
            - Email clearly states "I have a question" or similar phrasing
            - Email asks for help on a specific topic

            FOR DISCUSSION TOPICS (ANY of these):
            - Email introduces a topic for team discussion or decision
            - Email solicits opinions or feedback on a shared topic
            - Email contains phrases like "let's discuss", "thoughts on", "what do you think about"
            - Email continues an ongoing thread or conversation on a specific topic
            - Email shares information with an invitation for response

            FOR OTHER (ANY of these):
            - Email doesn't clearly fit into any of the above categories
            - Email contains multiple unrelated topics or general updates
            - Email is administrative in nature (e.g., notifications, system messages)
            - Email is a personal message unrelated to recruitment
            - Email is a newsletter, marketing communication, or general announcement

            ## DEFINITIVE RULES

            1. SUBJECT LINE OVERRULES BODY in case of conflict, UNLESS the body CLEARLY contradicts the subject
            2. MOST RECENT MESSAGE has priority over earlier messages
            3. If discussing BOTH a job AND candidates, determine which is the MAIN PURPOSE:
               - If evaluating candidates FOR a specific job → CANDIDATE
               - If describing a job and mentioning ideal candidates → JOB POSTING
            4. Matching/recommending candidates to jobs is ALWAYS → CANDIDATE
            5. An email with a list of multiple job openings is ALWAYS → JOB POSTING
            6. Messages with "Re:" prefix follow the same rules - classify by CONTENT not just by being a reply
            7. If email contains multiple questions but is primarily about a job posting → JOB POSTING
            8. If email introduces a discussion topic about candidates → CANDIDATE
            9. Only classify as QUESTIONS if asking for information is the PRIMARY purpose
            10. Only classify as DISCUSSION TOPICS if starting/continuing a discussion is the PRIMARY purpose
            11. Use OTHER sparingly, ONLY when no other categories reasonably apply

            ## UNAMBIGUOUS EXAMPLES

            DEFINITE JOB POSTINGS:
            - "Hiring a Full-Stack Developer at TechCorp" describing position details and application process
            - "New Role: Senior Project Manager - $120K" listing job responsibilities
            - "Re: Cloud Engineer Position" that primarily describes job requirements
            - "We're expanding our team" describing open positions

            DEFINITE CANDIDATES:
            - "John Smith - Software Engineer Resume" containing someone's qualifications
            - "Recommending Jane for the analyst role" discussing a specific person
            - "Re: Candidate for Marketing Position" evaluating someone's fit
            - "Looking for work in data science" from someone seeking employment
            - "Matching developers to your open roles" about finding candidates for positions

            DEFINITE QUESTIONS:
            - "Question about the hiring process?" asking for procedural clarification
            - "Can you explain the benefits package?" requesting specific information
            - "What skills are required for this position?" asking about job requirements
            - "How do I submit my resume?" asking about application procedures
            - "When is the application deadline?" requesting timing information

            DEFINITE DISCUSSION TOPICS:
            - "Thoughts on our hiring strategy for Q3" introducing a topic for team input
            - "Let's discuss the candidate evaluation process" starting a conversation
            - "Feedback needed on job description draft" soliciting opinions
            - "Continuing our conversation about the interview panel" extending a thread
            - "I've been thinking about how we structure our recruitment" sharing ideas for discussion

            DEFINITE OTHER:
            - "Weekly department update" containing miscellaneous information
            - "System notification: Your account password will expire" administrative message
            - "Happy holidays from the team" personal or social message
            - "Company newsletter" with general updates not specific to recruitment
            - "Reminder: Submit your timesheet" administrative reminder

            ## FIELD EXTRACTION

            For each type, extract these fields:

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

            QUESTIONS:
            - main_question: The primary question being asked
            - topic: The subject or topic of the question
            - urgency: Any indication of urgency (if mentioned)
            - context: Brief context behind the question
            - requested_information: Specific information being requested

            DISCUSSION TOPICS:
            - topic_title: Short title or name of the topic
            - key_points: Main points or ideas being discussed
            - action_items: Any proposed actions or next steps
            - stakeholders: People involved or mentioned
            - deadline: Any relevant deadlines mentioned

            OTHER:
            - summary: Brief summary of the content
            - category: Best subcategory if possible (administrative, personal, etc.)
            - action_required: Whether any action is needed (if applicable)
            - sender_type: Type of sender (system, individual, organization)

            ## CLASSIFICATION OUTPUT

            After analyzing, output JSON with:
            1. "classification": EXACTLY ONE of ["Job Posting", "Candidate", "Event", "Questions", "Discussion Topics", "Other"]
            2. "confidence": A number from 0-100
            3. "primary_indicators": List the SPECIFIC words/phrases that determined this classification
            4. "fields": Extract the appropriate structured data
            5. "reasoning": Brief explanation focusing on which DEFINITIVE RULE was applied

            REMEMBER: Your categorization MUST be consistent and follow these rules EXACTLY.
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
                        for label in all_labels
                        if label.name == classification_result["classification"]
                    ),
                    None,
                )

                if label:
                    # Apply the label to the thread
                    label_service.add_label_to_thread(
                        thread_data["thread_id"],
                        label.id,
                        user.id,
                        confidence=classification_result["confidence"],
                        is_confirmed=False,
                        db=db,
                    )

                    logger.info(
                        f"Applied label '{classification_result['classification']}' to thread {thread_data['thread_id']} with {classification_result['confidence']}% confidence"
                    )

                    # Include category in thread data for vector indexing
                    thread_data["category"] = classification_result["classification"]

                    # Return the classification data and label info
                    return {
                        "success": True,
                        "thread_id": thread_data["thread_id"],
                        "classification": classification_result["classification"],
                        "confidence": classification_result["confidence"],
                        "fields": classification_result.get("fields", {}),
                        "reasoning": classification_result.get("reasoning", ""),
                        "label_id": label.id,
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

        # If there are messages, extract the content from the first/original email instead of the most recent
        if messages:
            # Use the first message (original email) for classification instead of the latest
            original_message = messages[0]

            content += f"From: {original_message.get('sender', '(Unknown)')}\n"

            # Extract recipients if available
            recipients = original_message.get("recipients", [])
            if recipients:
                content += f"To: {', '.join(recipients)}\n"

            # Add the message body or snippet
            if "body" in original_message and original_message["body"]:
                # For HTML content, we would want to extract just the text
                # This is a simplified version
                body = original_message["body"]
                # Remove HTML tags if present (very basic approach)
                import re

                body = re.sub(r"<[^>]*>", " ", body)
                content += f"\nBody:\n{body}"
            elif "snippet" in original_message:
                content += f"\nBody:\n{original_message['snippet']}"

            # No need to add context from other messages since we're focusing only on the original email

        return content


# Create a singleton instance
email_classifier = EmailClassifierService()
