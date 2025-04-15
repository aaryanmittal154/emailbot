from openai import OpenAI
import os
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from datetime import datetime, timezone, timedelta
import re
from dateutil import parser
import logging
import json
import base64
import requests

from app.db.database import get_db
from app.models.user import User
from app.models.gmail_rate_limit import GmailRateLimit

# IMPORTANT: Do not import from app.api.routes.auto_reply here to avoid circular imports
# Use runtime imports where needed inside each function instead

# Import specific functions needed from email_service
from app.services.email_service import get_thread, get_gmail_service, send_email
from app.services.auth_service import get_current_user, get_google_creds
from app.services.embedding_service import create_thread_embedding
from app.services.vector_db_service import vector_db
from app.services.email_classifier_service import email_classifier
from app.schemas.email import SendEmailRequest
from app.services.match_service import match_service
from app.db.database import SessionLocal
from app.utils.thread_utils import get_thread_category
from app.core.config import settings
from app.services.thread_monitoring_service import ThreadMonitoringService

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Constants
MAX_CONTEXT_THREADS = 3  # Number of similar threads to use for context
NEW_EMAIL_THRESHOLD = timedelta(
    hours=1
)  # Only process emails received in the last hour

# Initialize logger
logger = logging.getLogger(__name__)


class AutoReplyManager:
    """Manages automated email replies using RAG"""

    # Cache to track message IDs that have already been processed to avoid duplicate replies
    processed_message_ids = set()

    @staticmethod
    async def check_and_process_new_emails(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        max_results: int = 20,
        use_html: bool = False,
    ) -> Dict[str, Any]:
        """
        Check for new unread emails and generate auto-replies

        Args:
            user: The current user
            db: Database session
            max_results: Maximum number of emails to process
            use_html: Whether to use HTML formatting for emails

        Returns:
            Dictionary with processing results
        """
        try:
            # First check if user has an active rate limit
            active_limit = GmailRateLimit.get_active_limit(db, user.id)
            if active_limit:
                return {
                    "success": False,
                    "message": "Gmail sending rate limit in effect",
                    "details": {
                        "rate_limit": {
                            "status": "rate_limited",
                            "retry_after": active_limit.retry_after.isoformat(),
                        }
                    },
                }

            # Set the time threshold for new emails
            time_threshold = datetime.now(timezone.utc) - NEW_EMAIL_THRESHOLD

            # Get Google credentials
            credentials = get_google_creds(user.id, db)

            # Use the imported function directly
            service = get_gmail_service(credentials)

            # Query for recent unread emails
            # Use a Gmail query for unread emails
            results = (
                service.users()
                .messages()
                .list(userId="me", q="is:unread newer_than:1h", maxResults=max_results)
                .execute()
            )

            messages = results.get("messages", [])
            processed_count = 0
            replied_count = 0
            errors = []
            rate_limit_info = None

            # Track the threads we've processed to avoid duplicates
            processed_threads = set()

            for msg in messages:
                if rate_limit_info:
                    # We've hit a rate limit, stop processing
                    break

                thread_id = msg["threadId"]

                # Skip if we've already processed this thread
                if thread_id in processed_threads:
                    continue

                processed_threads.add(thread_id)

                try:
                    # Get full thread data
                    thread = get_thread(thread_id=thread_id, user=user, db=db)

                    # Only process threads with a message in the last hour
                    latest_message = thread["messages"][-1]
                    latest_time = parser.parse(latest_message["date"])
                    processed_count += 1

                    # Check if we should process this email further
                    if latest_time.replace(
                        tzinfo=timezone.utc
                    ) > time_threshold and not AutoReplyManager._user_already_replied(
                        thread["messages"], user.email
                    ):
                        # Classify the email content
                        classification_result = await email_classifier.classify_email(
                            thread, user, db
                        )
                        classification = classification_result["classification"]

                        # Generate and send a reply
                        reply_sent, response = (
                            await AutoReplyManager.generate_and_send_reply(
                                thread, user, db, use_html, classification
                            )
                        )

                        if reply_sent:
                            replied_count += 1
                        elif (
                            response
                            and "status" in response
                            and response["status"] == "rate_limited"
                        ):
                            rate_limit_info = response

                        # Fetch the thread again and update it in vector storage
                        print(
                            f"Indexing thread {thread['thread_id']} after sending auto-reply"
                        )

                        # Call the function directly
                        updated_thread = get_thread(
                            thread_id=thread["thread_id"],
                            user=user,
                            db=db,
                            store_embedding=True,
                        )

                except Exception as thread_error:
                    print(f"Error processing thread {thread_id}: {str(thread_error)}")
                    errors.append(
                        {
                            "thread_id": thread_id,
                            "error": str(thread_error),
                            "type": type(thread_error).__name__,
                        }
                    )
                    continue

            # Prepare the details dictionary if needed
            details = {}
            if errors:
                details["errors"] = errors

            if rate_limit_info:
                details["rate_limit"] = rate_limit_info

            return {
                "success": True,
                "processed_count": processed_count,
                "replied_count": replied_count,
                "message": f"Processed {processed_count} threads, sent {replied_count} auto-replies",
                "details": details if details else None,
            }

        except Exception as e:
            error_msg = str(e)
            print(f"Error processing emails: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing emails: {error_msg}",
            )

    @staticmethod
    def _user_already_replied(messages: List[Dict], user_email: str) -> bool:
        """Check if the user has already replied in this thread"""
        # Start from the second-to-last message and work backwards
        # Skip the last message since that's the one we're potentially replying to
        if len(messages) < 2:
            return False

        for message in reversed(messages[:-1]):
            if message["sender"] == user_email:
                return True

        return False

    @staticmethod
    async def generate_and_send_reply(
        thread: Dict[str, Any],
        user: User,
        db: Session,
        use_html: bool = False,
        classification: str = "General",
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """Generate and send an appropriate reply using RAG"""
        try:
            # First check if user has an active rate limit
            active_limit = GmailRateLimit.get_active_limit(db, user.id)
            if active_limit:
                return False, {
                    "status": "rate_limited",
                    "retry_after": active_limit.retry_after.isoformat(),
                }

            # Extract the latest message content for the query
            latest_message = thread["messages"][-1]
            latest_message_text = latest_message.get(
                "body", latest_message.get("snippet", "")
            )

            # Log the message we're responding to
            print("============= EMAIL BEING PROCESSED =============")
            print(f"Thread ID: {thread['thread_id']}")
            print(f"Subject: {thread['subject']}")
            print(f"From: {latest_message['sender']}")
            print(f"Content: {latest_message_text[:500]}...")
            print(f"Classification: {classification}")
            print("================================================")

            # Create an embedding for the latest message
            query_embedding = create_thread_embedding(latest_message_text)

            print("Created embedding for the latest message")

            # Find similar threads in vector database with category filtering
            print(f"Searching for similar threads in vector DB for user ID: {user.id}")

            # For job postings, find candidate threads; for candidates, find job postings
            complementary_category = None
            if classification.lower() == "job posting":
                complementary_category = "candidate"
                print(f"This is a job posting, searching for matching candidates")
            elif classification.lower() == "candidate":
                complementary_category = "job posting"
                print(f"This is a candidate, searching for matching job postings")
            else:
                print(
                    f"Non job/candidate email ({classification}), using general search"
                )

            # First try with category filtering
            try:
                similar_threads = vector_db.search_threads(
                    user.id,
                    query_embedding,
                    MAX_CONTEXT_THREADS,
                    filter_category=complementary_category,
                )

                # If no matching threads found with category filter, fall back to general search
                if len(similar_threads) == 0 and complementary_category:
                    print(
                        f"No {complementary_category.lower()} threads found, falling back to general search"
                    )
                    similar_threads = vector_db.search_threads(
                        user.id, query_embedding, MAX_CONTEXT_THREADS
                    )
            except Exception as search_error:
                print(
                    f"Error during vector search: {str(search_error)}, falling back to general search"
                )
                # Fall back to general search without filtering
                similar_threads = vector_db.search_threads(
                    user.id, query_embedding, MAX_CONTEXT_THREADS
                )

            print(f"Found {len(similar_threads)} similar threads")
            for i, st in enumerate(similar_threads):
                print(f"Similar thread {i+1}: {st.get('subject', 'No Subject')}")
                if "category" in st:
                    print(f"  Category: {st.get('category', 'Unknown')}")

            # Format the context from similar threads
            context = AutoReplyManager._format_context_from_threads(similar_threads)

            print("============= CONTEXT FOR LLM =============")
            print(context)
            print("============================================")

            # --- BEGIN ADDED IRRELEVANT CHECK ---
            # Skip actual reply generation/sending if classified as irrelevant
            if classification.lower() == "irrelevant":
                print(
                    f"Skipping reply generation for irrelevant email (thread {thread['thread_id']}) - already stored."
                )
                # Even though we skip the reply, return True for success because the process didn't fail
                # The caller (process_single_email) will check the 'response' dictionary for status
                return False, {  # Return False for reply_sent flag
                    "status": "skipped",
                    "reason": "irrelevant_category",
                    "message": "Email classified as irrelevant - skipping reply generation",
                }
            # --- END ADDED IRRELEVANT CHECK ---

            # Generate the reply using gpt-4o
            reply_content = await AutoReplyManager._generate_reply_with_gpt(
                thread=thread,
                latest_message=latest_message,
                context=context,
                user_email=user.email,
                classification=classification,
            )

            if not reply_content:
                print(f"No reply generated for thread {thread['thread_id']}")
                return False, None

            # Send the email reply
            try:
                email_request = SendEmailRequest(
                    to=[latest_message["sender"]],  # Reply to the sender
                    subject=f"Re: {thread['subject']}",
                    body=reply_content,
                    # Include any CC recipients from the original message
                    cc=[
                        r
                        for r in latest_message.get("recipients", [])
                        if r != user.email and r != latest_message["sender"]
                    ],
                    # Add proper threading parameters
                    thread_id=thread["thread_id"],
                    html=use_html,  # Use HTML formatting based on parameter
                )

                # Call the function directly
                response = send_email(email_request=email_request, user=user, db=db)

                print(f"Auto-reply sent successfully for thread {thread['thread_id']}")
                print(f"Response: {response}")

                # Register this thread for monitoring
                ThreadMonitoringService.register_thread_for_monitoring(
                    thread_id=thread["thread_id"], user_id=user.id
                )
                print(f"Thread {thread['thread_id']} registered for monitoring")

                return True, response

            except Exception as send_error:
                # Check specifically for rate limit errors
                if (
                    "429" in str(send_error)
                    and "rate limit exceeded" in str(send_error).lower()
                ):
                    # Extract the retry date if available
                    retry_info = str(send_error)
                    print(
                        f"Gmail rate limit exceeded when sending reply for thread {thread['thread_id']}"
                    )
                    print(f"Rate limit error details: {retry_info}")

                    retry_date = "unknown date"

                    # Try to extract the date from the error message
                    date_match = re.search(r"Retry after ([0-9\-T:\.Z]+)", retry_info)
                    if date_match:
                        retry_after_str = date_match.group(1)
                        try:
                            retry_after = parser.parse(retry_after_str)
                            # Store the rate limit in the database
                            GmailRateLimit.add_limit(db, user.id, retry_after)
                            retry_date = retry_after_str
                        except Exception as parse_error:
                            print(f"Error parsing retry date: {parse_error}")

                    print(
                        f"Gmail API rate limit exceeded. Cannot send until {retry_date}"
                    )

                    # Return rate limit information
                    return False, {
                        "status": "rate_limited",
                        "retry_after": retry_date,
                    }
                else:
                    print(
                        f"Error sending reply for thread {thread['thread_id']}: {str(send_error)}"
                    )
                    print(f"Error type: {type(send_error).__name__}")
                    print(
                        f"Error details: {send_error.__dict__ if hasattr(send_error, '__dict__') else 'No details available'}"
                    )

                return False, None

        except Exception as e:
            print(f"Error generating reply for thread {thread['thread_id']}: {str(e)}")
            return False, None

    @staticmethod
    def _format_context_from_threads(similar_threads: List[Dict[str, Any]]) -> str:
        """Format context from similar threads for the LLM"""
        context = "CONTEXT FROM SIMILAR EMAIL THREADS:\n\n"

        for i, thread in enumerate(similar_threads):
            context += f"--- SIMILAR THREAD {i+1} ---\n"
            context += f"Subject: {thread.get('subject', 'No Subject')}\n"

            # Include category if available
            category = thread.get("category", "")
            if category:
                context += f"Category: {category}\n"

            # Include thread content
            context += f"Content: {thread.get('text_preview', '')}\n\n"

        return context

    @staticmethod
    def get_default_auto_reply_prompt() -> str:
        """Return the default auto-reply prompt"""
        return """You are an intelligent email assistant that drafts contextually appropriate replies.
Your task is to generate a reply to the latest email in a thread based on:
1. The conversation history in the thread
2. Context from similar previous email threads
3. The specific content of the incoming email

Your reply should:
- Be professional and helpful
- Directly address the questions or requests in the latest email
- Use insights from similar threads to craft a more informed response
- Be concise but comprehensive
- Sound natural and human-like, not robotic
- Use the same tone and level of formality as the conversation history suggests

DO NOT:
- Include placeholder text or notes to yourself
- Mention that you're an AI or that this is an automated response
- Reference the fact that you're using similar threads for context
- Include salutations like "Dear" or signatures like "Best regards" - these will be added separately
- Leave ANY template placeholders like [Name] or [Company] in your response
"""

    @staticmethod
    def get_default_context_only_prompt() -> str:
        """Return the default context-only prompt for certain categories"""
        return """You are a STRICTLY FACT-BASED email assistant with ZERO ability to use general knowledge outside the provided context.

CRITICAL INSTRUCTIONS (You MUST follow these or you will be penalized):
1. YOU HAVE NO KNOWLEDGE beyond what is explicitly shown in the provided context
2. If asked about terms, topics, or entities, ONLY repeat information that is EXPLICITLY present in the context
3. DO NOT DEFINE OR EXPLAIN anything that isn't defined or explained in the provided context
4. If asked whether something was discussed or mentioned before, check the context thoroughly:
   - If the term appears ANYWHERE in the context, respond "Yes, X was mentioned..."
   - Do NOT require a "detailed discussion" - a single mention counts as being discussed
5. For yes/no questions, provide a literal answer based ONLY on what is in the context
6. If you are unsure if something appears in the context, ASSUME IT DOES NOT
7. NEVER say "it seems we haven't discussed this before" unless you have verified it is COMPLETELY absent from ALL context

WHAT YOU MUST NOT DO (violations will result in penalties):
- DO NOT provide definitions, explanations or clarifications using your general knowledge
- DO NOT make assumptions about what something is or what it means
- DO NOT say something "hasn't been discussed in detail" if it appears in the context at all
- DO NOT make up information even if you think it would be helpful
- DO NOT use phrases like "based on my knowledge" or "I understand that"

EXAMPLES:

GOOD RESPONSE (If context contains mentions of "X"):
Question: "What is X?"
Response: "Based on our conversation history, I don't have specific information about what X is. While X has been mentioned in our previous discussions, there wasn't a definition or explanation provided. Would you like me to find out more information about X for you?"

BAD RESPONSE (NEVER DO THIS):
Question: "What is X?"
Response: "X is a technology platform that helps businesses analyze data. It seems we haven't discussed X in detail before."

GOOD RESPONSE (If context shows mentions of "Y"):
Question: "Have we discussed Y before?"
Response: "Yes, Y has been mentioned in our previous conversations. In our exchange on [date], you asked about Y."

BAD RESPONSE (NEVER DO THIS):
Question: "Have we discussed Y before?"
Response: "It seems we haven't had a detailed discussion about Y yet."

Remember: Your responses MUST be based SOLELY on the information in the context. If the information is not explicitly present, acknowledge that you don't have that information rather than making something up.
"""

    @staticmethod
    def get_default_job_posting_prompt() -> str:
        """Return the default prompt for job posting replies"""
        return """You are an intelligent email assistant for a recruiter that specializes in matching job postings with candidates.
Your task is to generate a helpful reply to a job posting email using:
1. The conversation history in the thread
2. Information about matching candidates found in the context
3. The specific content of the incoming job posting

Your reply should:
- Acknowledge the job posting details
- Mention the top matching candidates with their match percentages
- Highlight key skills and experience that make these candidates a good fit
- Be professional and helpful
- Sound natural and human-like, not robotic

DO NOT:
- Include placeholder text or notes to yourself
- Mention that you're an AI or that this is an automated response
- Leave ANY template placeholders like [Name] or [Company] in your response
- Make up candidate information that isn't in the provided context
"""

    @staticmethod
    def get_default_candidate_prompt() -> str:
        """Return the default prompt for candidate replies"""
        return """You are an intelligent email assistant for a recruiter that specializes in matching candidates with job openings.
Your task is to generate a helpful reply to a candidate email using:
1. The conversation history in the thread
2. Information about matching job openings found in the context
3. The specific content of the incoming candidate email

Your reply should:
- Acknowledge the candidate's skills and experience
- Mention the top matching job openings with their match percentages
- Highlight key requirements and benefits of these positions
- Be professional and helpful
- Sound natural and human-like, not robotic

DO NOT:
- Include placeholder text or notes to yourself
- Mention that you're an AI or that this is an automated response
- Leave ANY template placeholders like [Name] or [Company] in your response
- Make up job information that isn't in the provided context
"""

    @staticmethod
    async def _generate_reply_with_gpt(
        thread: Dict[str, Any],
        latest_message: Dict[str, Any],
        context: str,
        user_email: str,
        classification: str = "General",
    ) -> str:
        """Generate a reply using gpt-4o with context from similar emails"""
        try:
            # Extract the thread conversation history
            conversation_history = "CONVERSATION HISTORY:\n"
            for i, msg in enumerate(thread["messages"]):
                sender = msg["sender"]
                role = "You" if sender == user_email else f"Them ({sender})"
                conversation_history += f"{role}: {msg.get('snippet', '')}\n"

            # Get database session to check for custom prompts
            from app.db.database import SessionLocal

            db = SessionLocal()

            try:
                # Get user from database
                from app.models.user import User

                user = db.query(User).filter(User.email == user_email).first()

                if user:
                    # Check for custom prompt by category
                    from app.models.custom_prompt import CustomPrompt

                    custom_prompt = (
                        db.query(CustomPrompt)
                        .filter(
                            CustomPrompt.user_id == user.id,
                            CustomPrompt.category == classification,
                            CustomPrompt.prompt_type == "auto_reply",
                        )
                        .first()
                    )

                    # If no category-specific prompt, check for generic custom prompt
                    if not custom_prompt:
                        custom_prompt = (
                            db.query(CustomPrompt)
                            .filter(
                                CustomPrompt.user_id == user.id,
                                CustomPrompt.category
                                == "Other",  # Use "Other" as the generic category
                                CustomPrompt.prompt_type == "auto_reply",
                            )
                            .first()
                        )

                    if custom_prompt:
                        system_prompt = custom_prompt.content
                        print(
                            f"Using custom auto-reply prompt for user {user.id} and category {classification}"
                        )
                    else:
                        # Use appropriate default prompt based on classification
                        if classification.lower() in ["job posting"]:
                            system_prompt = (
                                AutoReplyManager.get_default_job_posting_prompt()
                            )
                        elif classification.lower() in ["candidate"]:
                            system_prompt = (
                                AutoReplyManager.get_default_candidate_prompt()
                            )
                        elif classification.lower() in [
                            "questions",
                            "discussion topics",
                            "event",
                        ]:
                            system_prompt = (
                                AutoReplyManager.get_default_context_only_prompt()
                            )
                        else:
                            system_prompt = (
                                AutoReplyManager.get_default_auto_reply_prompt()
                            )
                else:
                    # Fall back to default prompt if user not found
                    system_prompt = AutoReplyManager.get_default_auto_reply_prompt()

            finally:
                # Close the database session
                db.close()

            user_prompt = f"""Based on the information below, draft a reply to the latest email in this thread.

{conversation_history}

LATEST EMAIL:
From: {latest_message['sender']}
Subject: {latest_message.get('subject', thread.get('subject', 'No Subject'))}
Content: {latest_message.get('body', latest_message.get('snippet', ''))}

{context}

Based on this information, draft a helpful and appropriate reply.{' Remember to ALWAYS include percentage matches in your reply and NEVER leave template placeholders like [Name] or [Company] in your response.' if classification.lower() in ['job posting', 'candidate'] else ''}
"""

            # Make the OpenAI API call
            print("\n=== FULL PROMPT BEING SENT TO LLM ===")
            print(f"System prompt length: {len(system_prompt)} characters")
            print(f"User prompt length: {len(user_prompt)} characters")
            print("System prompt first 200 chars:", system_prompt[:200], "...")
            print("User prompt first 200 chars:", user_prompt[:200], "...")
            print("\n=== COMPLETE LLM PROMPT ===")
            print(system_prompt)
            print("\n")
            print(user_prompt)
            print("\n================================\n")

            # Print classification for debugging
            print(
                f"Using classification: {classification} (lowercase: {classification.lower()})"
            )
            print(
                f"Is this a context-only category? {classification.lower() in ['other events', 'questions', 'discussion topic']}"
            )
            print(
                f"Is this a matching category? {classification.lower() in ['job posting', 'candidate']}"
            )

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=(
                    0.3
                    if classification.lower()
                    in ["other events", "questions", "discussion topic"]
                    else 0.7
                ),
                max_tokens=800,
            )

            # Get the reply content
            reply_content = response.choices[0].message.content.strip()

            # Final check to remove any remaining placeholders - though the instructions should prevent this
            import re

            reply_content = re.sub(r"\[([^\]]+)\]", r"\1", reply_content)

            return reply_content
        except Exception as e:
            print(f"Error generating reply: {str(e)}")
            return None

    @staticmethod
    async def set_up_gmail_push_notifications(
        user: User, db: Session
    ) -> Dict[str, Any]:
        """
        Set up Gmail push notifications for real-time email processing.

        This registers a webhook with Gmail API to receive notifications when new emails arrive.

        Args:
            user: The user to set up notifications for
            db: Database session

        Returns:
            Dict with setup results
        """
        try:
            # Get credentials and build service
            credentials = get_google_creds(user.id, db)
            service = get_gmail_service(credentials)

            # Create a unique topic name for this user
            topic_name = f"projects/{settings.google_cloud_project}/topics/gmail-notifications-{user.id}"

            # Set up the webhook
            webhook_url = (
                f"{settings.base_url}/api/auto-reply/receive-gmail-push-notification"
            )

            # Register the webhook for push notifications
            # Note: The push notification requires a Google Cloud Pub/Sub topic
            # that must be set up in the Google Cloud Console
            request = {
                "labelIds": ["INBOX"],
                "topicName": topic_name,
                "labelFilterBehavior": "INCLUDE",
            }

            # Call the Gmail API to watch for changes
            watch_response = service.users().watch(userId="me", body=request).execute()

            # Store the watch details for this user
            expiration = (
                int(watch_response.get("expiration", 0)) / 1000
            )  # Convert to seconds
            expiration_date = datetime.fromtimestamp(expiration, timezone.utc)
            history_id = watch_response.get("historyId")

            logger.info(
                f"Gmail push notifications set up for user {user.id}. Expires: {expiration_date}"
            )

            return {
                "success": True,
                "message": "Gmail push notifications set up successfully",
                "details": {
                    "expiration": expiration_date.isoformat(),
                    "historyId": history_id,
                },
            }

        except Exception as e:
            logger.error(f"Error setting up Gmail push notifications: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to set up Gmail push notifications: {str(e)}",
            }

    @staticmethod
    async def process_gmail_push_notification(
        user: User, db: Session, notification_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a Gmail push notification and trigger immediate auto-reply.

        Args:
            user: The current user
            db: Database session
            notification_data: The notification data from Gmail

        Returns:
            Dictionary with processing results
        """
        try:
            logger.info(f"Processing Gmail push notification for user {user.id}")

            # Extract message info from the notification
            if "message" not in notification_data:
                logger.error("No message data in notification")
                return {
                    "success": False,
                    "message": "No message data in notification",
                }

            # Extract message ID from notification
            message_info = notification_data.get("message", {})
            message_id = message_info.get("data", {}).get("emailMessageId")

            if not message_id:
                logger.error("No message ID in notification")
                return {
                    "success": False,
                    "message": "No message ID in notification",
                }

            # Check if this notification is for a new email
            history_id = message_info.get("data", {}).get("historyId")
            if not history_id:
                logger.error("No history ID in notification")
                return {
                    "success": False,
                    "message": "No history ID in notification",
                }

            # First check if user has an active rate limit
            active_limit = GmailRateLimit.get_active_limit(db, user.id)
            if active_limit:
                logger.warning(f"Gmail rate limit in effect for user {user.id}")
                return {
                    "success": False,
                    "message": "Gmail sending rate limit in effect",
                    "details": {
                        "rate_limit": {
                            "status": "rate_limited",
                            "retry_after": active_limit.retry_after.isoformat(),
                        }
                    },
                }

            # Get Google credentials
            credentials = get_google_creds(user.id, db)

            # Get Gmail service
            service = get_gmail_service(credentials)

            # Get the thread ID for this message
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

            # Get full thread data
            thread = get_thread(thread_id=thread_id, user=user, db=db)

            # Check if the message is unread and recent
            time_threshold = datetime.now(timezone.utc) - NEW_EMAIL_THRESHOLD

            # Get the latest message in the thread
            latest_message = thread["messages"][-1]
            latest_time = parser.parse(latest_message["date"])

            # Check if the email is recent and we haven't replied yet
            if latest_time.replace(
                tzinfo=timezone.utc
            ) > time_threshold and not AutoReplyManager._user_already_replied(
                thread["messages"], user.email
            ):
                logger.info(f"Processing new email in thread {thread_id}")

                # Classify the email content
                classification_result = await email_classifier.classify_email(
                    thread, user, db
                )
                classification = classification_result["classification"]

                # Generate and send a reply
                reply_sent, response = await AutoReplyManager.generate_and_send_reply(
                    thread, user, db, use_html=False, classification=classification
                )

                if reply_sent:
                    logger.info(f"Auto-reply sent for thread {thread_id}")
                    return {
                        "success": True,
                        "message": "Auto-reply sent successfully",
                        "thread_id": thread_id,
                    }
                elif (
                    response
                    and "status" in response
                    and response["status"] == "rate_limited"
                ):
                    logger.warning(
                        f"Rate limit hit while sending auto-reply for thread {thread_id}"
                    )
                    return {
                        "success": False,
                        "message": "Gmail sending rate limit reached",
                        "details": response,
                    }
                else:
                    logger.warning(f"Failed to send auto-reply for thread {thread_id}")
                    return {
                        "success": False,
                        "message": "Failed to send auto-reply",
                        "details": response,
                    }
            else:
                logger.info(f"Email in thread {thread_id} does not need an auto-reply")
                return {
                    "success": True,
                    "message": "Email does not need an auto-reply",
                    "thread_id": thread_id,
                }

        except Exception as e:
            logger.error(f"Error processing Gmail push notification: {str(e)}")
            raise Exception(f"Error processing Gmail push notification: {str(e)}")

    @staticmethod
    async def process_history_updates(
        user: User,
        db: Session,
        history_id: str,
        time_threshold: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Process Gmail history updates since a specific history ID.

        This method is designed to work with Gmail push notifications to process
        all changes that have happened since the last known history ID.

        Args:
            user: The user who received the emails
            db: Database session
            history_id: The Gmail history ID to start from
            time_threshold: Only process emails newer than this time

        Returns:
            Dictionary with processing results
        """
        try:
            # Set default time threshold if not provided (last hour)
            if time_threshold is None:
                time_threshold = datetime.now(timezone.utc) - NEW_EMAIL_THRESHOLD

            logger.info(
                f"Processing Gmail history updates since ID {history_id} for user {user.id}"
            )

            # First check if user has an active rate limit
            active_limit = GmailRateLimit.get_active_limit(db, user.id)
            if active_limit:
                logger.warning(f"Gmail rate limit in effect for user {user.id}")
                return {
                    "success": False,
                    "message": "Gmail sending rate limit in effect",
                    "details": {
                        "rate_limit": {
                            "status": "rate_limited",
                            "retry_after": active_limit.retry_after.isoformat(),
                        }
                    },
                }

            # Get Google credentials
            credentials = get_google_creds(user.id, db)
            service = get_gmail_service(credentials)

            # Get history updates from Gmail API
            try:
                history_results = (
                    service.users()
                    .history()
                    .list(
                        userId="me",
                        startHistoryId=history_id,
                        historyTypes=[
                            "messageAdded",
                            "labelAdded",
                        ],  # Only care about new messages and label changes
                    )
                    .execute()
                )

                history_changes = history_results.get("history", [])
                logger.info(
                    f"Found {len(history_changes)} history changes for user {user.id}"
                )

                # Track results
                processed_count = 0
                replied_count = 0

                # Process each history change
                for change in history_changes:
                    # Look for added messages
                    for message_added in change.get("messagesAdded", []):
                        message = message_added.get("message", {})
                        message_id = message.get("id")

                        if (
                            message_id
                            and "INBOX" in message.get("labelIds", [])
                            and "UNREAD" in message.get("labelIds", [])
                        ):
                            # Process this new unread email
                            logger.info(
                                f"Processing new message {message_id} from history"
                            )
                            processed_count += 1

                            result = await AutoReplyManager.process_single_email(
                                user=user, db=db, email_id=message_id, use_html=False
                            )

                            if result.get(
                                "success"
                            ) and "Auto-reply sent successfully" in result.get(
                                "message", ""
                            ):
                                replied_count += 1

                # Get the latest history ID for future queries
                new_history_id = history_results.get("historyId")
                if new_history_id:
                    # Update the stored history ID - using runtime import to avoid circular imports
                    from app.api.routes.auto_reply import get_auto_reply_config

                    config = get_auto_reply_config(user.id, db)
                    config.push_notification_history_id = new_history_id
                    db.commit()

                logger.info(
                    f"Processed {processed_count} emails, sent {replied_count} replies for user {user.id}"
                )

                # Update global statistics - using runtime import to avoid circular imports
                if replied_count > 0:
                    from app.services.background_tasks import update_user_check_stats

                    update_user_check_stats(user.id, replied_count)

                return {
                    "success": True,
                    "message": f"Processed {processed_count} emails, sent {replied_count} replies",
                    "processed_count": processed_count,
                    "replied_count": replied_count,
                    "latest_history_id": new_history_id,
                }

            except Exception as gmail_error:
                logger.error(
                    f"Gmail API error while getting history: {str(gmail_error)}"
                )
                return {
                    "success": False,
                    "message": f"Gmail API error: {str(gmail_error)}",
                }

        except Exception as e:
            logger.error(f"Error processing history updates: {str(e)}")
            return {
                "success": False,
                "message": f"Error processing history updates: {str(e)}",
            }

    @staticmethod
    async def process_single_email(
        user: User,
        db: Session,
        email_id: str,
        use_html: bool = False,
    ) -> Dict[str, Any]:
        """
        Process a single email for auto-reply.

        This method is optimized for instant processing of newly arrived emails.
        It reuses the core logic from check_and_process_new_emails for consistency.

        Args:
            user: The user who received the email
            db: Database session
            email_id: The Gmail message ID
            use_html: Whether to use HTML in the reply

        Returns:
            Dictionary with processing results
        """
        try:
            # First check if user has an active rate limit
            active_limit = GmailRateLimit.get_active_limit(db, user.id)
            if active_limit:
                print(f"Gmail rate limit in effect for user {user.id}")
                return {
                    "success": False,
                    "message": "Gmail sending rate limit in effect",
                    "details": {
                        "rate_limit": {
                            "status": "rate_limited",
                            "retry_after": active_limit.retry_after.isoformat(),
                        }
                    },
                }

            # Set the time threshold for new emails (last hour)
            time_threshold = datetime.now(timezone.utc) - NEW_EMAIL_THRESHOLD

            # Get Google credentials
            credentials = get_google_creds(user.id, db)

            # Use the imported function directly
            service = get_gmail_service(credentials)

            # Get the message details to find the thread ID
            try:
                message = (
                    service.users().messages().get(userId="me", id=email_id).execute()
                )
            except Exception as e:
                print(f"Error getting message {email_id}: {str(e)}")
                return {
                    "success": False,
                    "message": f"Error getting message: {str(e)}",
                }

            thread_id = message.get("threadId")
            if not thread_id:
                print(f"No thread ID found for message {email_id}")
                return {
                    "success": False,
                    "message": "No thread ID found for message",
                }

            # Get the full thread data
            thread = get_thread(thread_id=thread_id, user=user, db=db)

            # Only process if the latest message is recent and we haven't replied
            latest_message = thread["messages"][-1]
            latest_time = parser.parse(latest_message["date"])

            # Check if we've already processed this message
            if email_id in AutoReplyManager.processed_message_ids:
                print(f"Skipping already processed email {email_id}")
                return {
                    "success": True,
                    "message": "Email already processed",
                }

            # Skip processing if:
            # 1. Email is older than our threshold
            # 2. User has already replied to this thread
            if latest_time.replace(
                tzinfo=timezone.utc
            ) <= time_threshold or AutoReplyManager._user_already_replied(
                thread["messages"], user.email
            ):
                print(f"Skipping email {email_id}: too old or already replied")
                # --- ADD MONITORING CALL HERE before returning ---
                try:
                    logger.info(
                        f"Triggering monitoring check for skipped email {email_id} in thread {thread_id}"
                    )
                    # We need notification_data format, let's construct a minimal version
                    minimal_notification_data = {
                        "message": {"data": {"emailMessageId": email_id}}
                    }
                    monitoring_outcome = (
                        await ThreadMonitoringService.process_gmail_push_notification(
                            user=user,
                            db=db,
                            notification_data=minimal_notification_data,
                        )
                    )
                    logger.info(
                        f"Monitoring outcome for skipped email: {monitoring_outcome.get('message')}"
                    )
                except Exception as monitoring_error:
                    logger.error(
                        f"Error during monitoring for skipped email {email_id}: {str(monitoring_error)}"
                    )
                    # Do not let monitoring error block the original flow
                # --- END MONITORING CALL ---
                return {
                    "success": True,
                    "message": "Email skipped (too old or already replied)",
                }

            # Classify the email content
            classification_result = await email_classifier.classify_email(
                thread, user, db
            )
            classification = classification_result["classification"]

            # --- BEGIN ADDED CODE ---
            # Check if thread data includes text_content required for upsert
            if not thread.get("text_content"):
                logger.warning(
                    f"Thread {thread_id} is missing 'text_content'. Skipping pre-reply upsert."
                )
            else:
                try:
                    # Ensure embedding exists and add classification before upsert
                    latest_message_text = thread["messages"][-1].get(
                        "body", thread["messages"][-1].get("snippet", "")
                    )
                    thread_embedding = create_thread_embedding(latest_message_text)
                    thread["embedding"] = thread_embedding
                    thread["category"] = (
                        classification  # Add classification to thread data
                    )

                    print(
                        f"Upserting thread {thread_id} with classification '{classification}' before reply check."
                    )
                    upsert_success = vector_db.upsert_thread(
                        user_id=user.id, thread_data=thread
                    )
                    if not upsert_success:
                        logger.error(
                            f"Failed to upsert thread {thread_id} to vector DB before reply check."
                        )
                        # Optionally return an error, or just log and continue
                except Exception as e:
                    logger.error(
                        f"Error during pre-reply upsert for thread {thread_id}: {str(e)}",
                        exc_info=True,
                    )
                    # Optionally return an error, or just log and continue
            # --- END ADDED CODE ---

            # --- BEGIN ADDED IRRELEVANT CHECK ---
            # Skip actual reply generation/sending if classified as irrelevant
            if classification.lower() == "irrelevant":
                print(
                    f"Skipping reply generation for irrelevant email (thread {thread['thread_id']}) - already stored."
                )
                # Even though we skip the reply, return True for success because the process didn't fail
                # The caller (process_single_email) will check the 'response' dictionary for status
                return False, {  # Return False for reply_sent flag
                    "status": "skipped",
                    "reason": "irrelevant_category",
                    "message": "Email classified as irrelevant - skipping reply generation",
                }
            # --- END ADDED IRRELEVANT CHECK ---

            # Generate and send a reply
            reply_sent, response = await AutoReplyManager.generate_and_send_reply(
                thread, user, db, use_html, classification
            )

            # --- ADD MONITORING CALL HERE after reply attempt ---
            try:
                logger.info(
                    f"Triggering monitoring check after reply attempt for email {email_id} in thread {thread_id}"
                )
                minimal_notification_data = {
                    "message": {"data": {"emailMessageId": email_id}}
                }
                monitoring_outcome = (
                    await ThreadMonitoringService.process_gmail_push_notification(
                        user=user, db=db, notification_data=minimal_notification_data
                    )
                )
                logger.info(
                    f"Monitoring outcome after reply attempt: {monitoring_outcome.get('message')}"
                )
            except Exception as monitoring_error:
                logger.error(
                    f"Error during monitoring after reply attempt for {email_id}: {str(monitoring_error)}"
                )
                # Do not let monitoring error block the original flow
            # --- END MONITORING CALL ---

            if reply_sent:
                # Mark this message as processed to avoid duplicate replies
                AutoReplyManager.processed_message_ids.add(email_id)
                print(f"Auto-reply sent for email {email_id}")
                return {
                    "success": True,
                    "message": "Auto-reply sent successfully",
                    "thread_id": thread_id,
                }
            elif (
                response
                and "status" in response
                and response["status"] == "rate_limited"
            ):
                print(f"Rate limit hit while sending auto-reply for email {email_id}")
                return {
                    "success": False,
                    "message": "Gmail sending rate limit reached",
                    "details": response,
                }
            else:
                print(f"Failed to send auto-reply for email {email_id}")
                return {
                    "success": False,
                    "message": "Failed to send auto-reply",
                    "details": response,
                }

        except Exception as e:
            print(f"Error processing email {email_id}: {str(e)}")
            # --- ADD MONITORING CALL HERE in case of processing error, if thread_id is known ---
            if "thread_id" in locals() and thread_id:
                try:
                    logger.info(
                        f"Triggering monitoring check after processing error for email {email_id} in thread {thread_id}"
                    )
                    minimal_notification_data = {
                        "message": {"data": {"emailMessageId": email_id}}
                    }
                    monitoring_outcome = (
                        await ThreadMonitoringService.process_gmail_push_notification(
                            user=user,
                            db=db,
                            notification_data=minimal_notification_data,
                        )
                    )
                    logger.info(
                        f"Monitoring outcome after error: {monitoring_outcome.get('message')}"
                    )
                except Exception as monitoring_error:
                    logger.error(
                        f"Error during monitoring after processing error for {email_id}: {str(monitoring_error)}"
                    )
                    # Do not let monitoring error block the error flow
            # --- END MONITORING CALL ---
            return {
                "success": False,
                "message": f"Error processing email: {str(e)}",
            }
