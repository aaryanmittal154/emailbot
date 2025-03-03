from openai import OpenAI
import os
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from datetime import datetime, timezone, timedelta
import re
from dateutil import parser
import logging

from app.db.database import get_db
from app.models.user import User
from app.models.gmail_rate_limit import GmailRateLimit
from app.services.email_service import email_service
from app.services.auth_service import get_current_user, get_google_creds
from app.services.embedding_service import create_thread_embedding
from app.services.vector_db_service import vector_db
from app.services.email_classifier_service import email_classifier
from app.schemas.email import SendEmailRequest

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

    @staticmethod
    async def check_and_process_new_emails(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        max_results: int = 20,
        use_html: bool = False,
    ) -> Dict[str, Any]:
        """
        Check for new emails and process them for auto-reply

        This function:
        1. Gets recent unread emails
        2. For each thread, checks if it needs a reply
        3. If so, generates and sends an appropriate response

        Returns a summary of actions taken
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

            # Create Gmail API service
            service = email_service["get_gmail_service"](credentials)

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

            # Process each message
            for message_data in messages:
                message_id = message_data["id"]
                thread_id = message_data.get("threadId")

                # Skip if we've already processed this thread
                if thread_id in processed_threads:
                    continue

                processed_threads.add(thread_id)

                try:
                    # Get full thread data
                    thread = email_service["get_thread"](
                        thread_id=thread_id, user=user, db=db
                    )

                    # Classify the email and apply the appropriate label
                    classification_result = await email_classifier.classify_email(
                        thread_data=thread, user=user, db=db
                    )

                    if classification_result["success"]:
                        logger.info(
                            f"Email classified as '{classification_result['classification']}' "
                            f"with {classification_result['confidence']}% confidence"
                        )
                        # Log the extracted fields
                        logger.info(
                            f"Extracted fields: {classification_result['fields']}"
                        )
                    else:
                        logger.warning(
                            f"Failed to classify email: {classification_result['message']}"
                        )

                    # Index this thread in Pinecone regardless of whether we reply to it
                    try:
                        print(
                            f"Automatically indexing newly discovered thread {thread_id}"
                        )
                        # Fetch the thread again with store_embedding=True to index it
                        email_service["get_thread"](
                            thread_id=thread_id,
                            user=user,
                            db=db,
                            store_embedding=True,  # This will store it in Pinecone
                        )
                        print(f"Successfully indexed thread {thread_id} in Pinecone")
                    except Exception as index_error:
                        print(
                            f"Error automatically indexing thread {thread_id}: {str(index_error)}"
                        )

                    # Check if the thread needs a reply (most recent message is unread and not sent by user)
                    if thread["messages"] and len(thread["messages"]) > 0:
                        latest_message = thread["messages"][
                            -1
                        ]  # Last message in thread

                        # Only process if:
                        # 1. Message is unread
                        # 2. User is not the sender (don't reply to own emails)
                        # 3. No previous reply in thread from the user
                        if (
                            not latest_message["is_read"]
                            and latest_message["sender"] != user.email
                            and not AutoReplyManager._user_already_replied(
                                thread["messages"], user.email
                            )
                        ):

                            # Generate and send reply
                            reply_sent, rate_limit = (
                                await AutoReplyManager.generate_and_send_reply(
                                    thread=thread,
                                    user=user,
                                    db=db,
                                    use_html=use_html,
                                    classification=classification_result[
                                        "classification"
                                    ],
                                )
                            )

                            if reply_sent:
                                replied_count += 1

                            # If we hit a rate limit, stop processing and return
                            if rate_limit:
                                rate_limit_info = rate_limit
                                break

                    processed_count += 1

                except Exception as e:
                    error_msg = str(e)
                    errors.append({"thread_id": thread_id, "error": error_msg})

                    # Check for rate limit errors
                    if (
                        "429" in error_msg
                        and "rate limit exceeded" in error_msg.lower()
                    ):
                        date_match = re.search(
                            r"Retry after ([0-9\-T:\.Z]+)", error_msg
                        )
                        if date_match:
                            retry_after_str = date_match.group(1)
                            try:
                                retry_after = parser.parse(retry_after_str)
                                # Store the rate limit in the database
                                GmailRateLimit.add_limit(db, user.id, retry_after)

                                rate_limit_info = {
                                    "status": "rate_limited",
                                    "retry_after": retry_after_str,
                                }
                            except Exception as parse_error:
                                print(f"Error parsing retry date: {parse_error}")
                                rate_limit_info = {
                                    "status": "rate_limited",
                                    "retry_after": "unknown",
                                }
                        else:
                            rate_limit_info = {
                                "status": "rate_limited",
                                "retry_after": "unknown",
                            }

                        # Stop processing more threads if we hit a rate limit
                        break

                    print(f"Error processing thread {thread_id}: {error_msg}")
                    continue

            response = {
                "success": True,
                "processed_count": processed_count,
                "replied_count": replied_count,
                "message": f"Processed {processed_count} threads, sent {replied_count} auto-replies",
            }

            # Add details about errors if there were any
            if errors:
                response["details"] = {
                    "errors": errors[:5],  # Limit number of errors returned
                    "error_count": len(errors),
                }

            if rate_limit_info:
                if "details" not in response:
                    response["details"] = {}
                response["details"]["rate_limit"] = rate_limit_info
                response["message"] += f". Note: Gmail sending rate limit reached."

            return response

        except Exception as e:
            print(f"Error in check_and_process_new_emails: {str(e)}")
            error_msg = str(e)
            details = {"error": error_msg}

            # Check for rate limit errors in the top-level exception too
            if "429" in error_msg and "rate limit exceeded" in error_msg.lower():
                import re

                date_match = re.search(r"Retry after ([0-9\-T:\.Z]+)", error_msg)
                if date_match:
                    retry_after_str = date_match.group(1)
                    try:
                        retry_after = parser.parse(retry_after_str)
                        # Store the rate limit in the database
                        GmailRateLimit.add_limit(db, user.id, retry_after)

                        details["rate_limit"] = {
                            "status": "rate_limited",
                            "retry_after": retry_after_str,
                        }
                    except Exception as parse_error:
                        print(f"Error parsing retry date: {parse_error}")
                        details["rate_limit"] = {
                            "status": "rate_limited",
                            "retry_after": "unknown",
                        }
                else:
                    details["rate_limit"] = {
                        "status": "rate_limited",
                        "retry_after": "unknown",
                    }

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
    ) -> tuple[bool, Dict]:
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

            # Find similar threads in vector database
            print(f"Searching for similar threads in vector DB for user ID: {user.id}")
            similar_threads = vector_db.search_threads(
                user.id, query_embedding, MAX_CONTEXT_THREADS
            )

            print(f"Found {len(similar_threads)} similar threads")
            for i, st in enumerate(similar_threads):
                print(f"Similar thread {i+1}: {st.get('subject', 'No Subject')}")

            # Format the context from similar threads
            context = AutoReplyManager._format_context_from_threads(similar_threads)

            print("============= CONTEXT FOR LLM =============")
            print(context)
            print("============================================")

            # Generate the reply using GPT-4o-mini
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

                # Send the email using the existing email service
                print("============= SENDING AUTO-REPLY EMAIL =============")
                print(f"To: {email_request.to}")
                print(f"Subject: {email_request.subject}")
                print(f"Thread ID: {email_request.thread_id}")
                print(f"HTML Format: {email_request.html}")
                print(f"CC Recipients: {email_request.cc}")
                print("===================================================")

                response = email_service["send_email"](
                    email_request=email_request,
                    user=user,
                    db=db,
                )

                print(f"Auto-reply sent successfully for thread {thread['thread_id']}")
                print(f"Response: {response}")

                # Index the updated thread (including our reply) in Pinecone
                try:
                    print(
                        f"Indexing thread {thread['thread_id']} after sending auto-reply"
                    )
                    # Get updated thread that includes our reply
                    updated_thread = email_service["get_thread"](
                        thread_id=thread["thread_id"],
                        user=user,
                        db=db,
                        store_embedding=True,  # This will store it in Pinecone
                    )
                    print(
                        f"Successfully indexed thread {thread['thread_id']} in Pinecone"
                    )
                except Exception as index_error:
                    print(f"Error indexing thread after auto-reply: {str(index_error)}")

                return True, None

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

            # Include thread content
            context += f"Content: {thread.get('text_preview', '')}\n\n"

        return context

    @staticmethod
    async def _generate_reply_with_gpt(
        thread: Dict[str, Any],
        latest_message: Dict[str, Any],
        context: str,
        user_email: str,
        classification: str = "General",
    ) -> str:
        """Generate a reply using GPT-4o-mini with context from similar emails"""
        try:
            # Extract the thread conversation history
            conversation_history = "CONVERSATION HISTORY:\n"
            for i, msg in enumerate(thread["messages"]):
                sender = msg["sender"]
                role = "You" if sender == user_email else f"Them ({sender})"
                conversation_history += f"{role}: {msg.get('snippet', '')}\n"

            # Create the base prompt
            system_prompt = """You are an intelligent email assistant that drafts contextually appropriate replies.
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

            # Customize system prompt based on classification
            if classification == "Job Posting":
                system_prompt = """You are an intelligent email assistant specializing in job recruitment.
For this email about a job posting, analyze the job requirements and find the top 3 matching candidates from the context provided.

For each candidate match, you MUST ALWAYS:
1. Calculate and provide a percentage match (e.g., "85% match") based on how well their qualifications align with the job requirements
2. Explain why they're a good fit in 1-2 sentences
3. List key qualifications that align with the job

The percentage match should reflect:
- Required skills/experience that match (highest weight)
- Relevant education or certifications
- Years of experience if specified
- Industry-specific knowledge
- Soft skills that align with the role

IMPORTANT FORMATTING REQUIREMENTS:
1. YOU MUST INCLUDE PERCENTAGE MATCHES for each candidate
2. DO NOT leave any template placeholders in your response - replace all [Placeholders] with actual information
3. If candidate names are available, use them; if not, describe them by their key skills instead
4. If you cannot determine a percentage match, you are required to make your best reasonable estimate

YOU MUST FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS - responses without percentage matches will be rejected:

"Based on the job requirements, here are the top candidates that match this position:

1. [Candidate Name] - [Match Percentage]%
   [Brief explanation of why they're a good match]
   Key qualifications: [List 3-4 relevant skills/experiences]

2. [Candidate Name] - [Match Percentage]%
   [Brief explanation of why they're a good match]
   Key qualifications: [List 3-4 relevant skills/experiences]

3. [Candidate Name] - [Match Percentage]%
   [Brief explanation of why they're a good match]
   Key qualifications: [List 3-4 relevant skills/experiences]"

Example of a correct response:
"Based on the job requirements, here are the top candidates that match this position:

1. John Smith - 92%
   John has 5 years of experience in backend development using Python and Django, making him an excellent fit for your tech stack.
   Key qualifications: Python/Django expertise, AWS experience, CI/CD pipeline management, microservices architecture

2. Maria Garcia - 87%
   Maria brings strong full-stack development skills and has worked on similar enterprise applications for 4 years.
   Key qualifications: Full-stack development, React/Node.js proficiency, database optimization, Agile methodology

3. David Kim - 78%
   David's background in cloud infrastructure and recent transition to development provides a valuable technical perspective.
   Key qualifications: Cloud infrastructure, JavaScript development, API design, system architecture"

If insufficient candidate information is available in the context, provide a professional response explaining that you'll keep the job posting on file and match with candidates as they come in, but still make reasonable estimates based on whatever limited information you have.

Make your response professional, helpful, and natural-sounding.
"""

            elif classification == "Candidate":
                system_prompt = """You are an intelligent email assistant specializing in career placement.
For this email from a job candidate, analyze their qualifications and find the top 3 matching job postings from the context provided.

For each job match, you MUST ALWAYS:
1. Calculate and provide a percentage match (e.g., "85% match") based on how well the candidate's qualifications match the job requirements
2. Explain why they're a good fit in 1-2 sentences
3. List key requirements from the job that align with the candidate's skills

The percentage match should reflect:
- Skills/experience that match the job requirements (highest weight)
- Education or certifications that align with requirements
- Years of experience compared to what's required
- Industry-specific knowledge relevance
- Soft skills that match the job description

IMPORTANT FORMATTING REQUIREMENTS:
1. YOU MUST INCLUDE PERCENTAGE MATCHES for each job
2. DO NOT leave any template placeholders in your response - replace all [Placeholders] with actual information
3. If job titles and companies are available, use them; if not, describe the positions by their key requirements instead
4. If you cannot determine a percentage match, you are required to make your best reasonable estimate

YOU MUST FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS - responses without percentage matches will be rejected:

"Based on your qualifications, here are the top job matches:

1. [Job Title] at [Company] - [Match Percentage]%
   [Brief explanation of why it's a good match]
   Key requirements: [List 3-4 relevant skills/experiences needed]

2. [Job Title] at [Company] - [Match Percentage]%
   [Brief explanation of why it's a good match]
   Key requirements: [List 3-4 relevant skills/experiences needed]

3. [Job Title] at [Company] - [Match Percentage]%
   [Brief explanation of why it's a good match]
   Key requirements: [List 3-4 relevant skills/experiences needed]"

Example of a correct response:
"Based on your qualifications, here are the top job matches:

1. Frontend Developer at TechCorp - 94%
   Your 3 years of experience with React and performance optimization directly matches their needs for improving web application speed.
   Key requirements: React.js expertise, performance optimization experience, responsive design skills, 2+ years experience

2. Full Stack Engineer at DataSys - 86%
   Your Node.js background and experience with modern JavaScript frameworks align perfectly with their tech stack.
   Key requirements: JavaScript/Node.js proficiency, API development, front-end frameworks, collaborative team experience

3. UI Engineer at StartupX - 79%
   Your focus on reducing page load times would be valuable for their customer-facing applications.
   Key requirements: Front-end optimization, JavaScript frameworks, UX sensitivity, startup experience"

If insufficient job information is available in the context, provide a professional response explaining that you'll keep their profile on file and match with jobs as they become available, but still make reasonable estimates based on whatever limited information you have.

Make your response professional, helpful, and natural-sounding.
"""

            user_prompt = f"""Based on the information below, draft a reply to the latest email in this thread.

{conversation_history}

LATEST EMAIL:
From: {latest_message['sender']}
Subject: {latest_message.get('subject', thread.get('subject', 'No Subject'))}
Content: {latest_message.get('body', latest_message.get('snippet', ''))}

{context}

Based on this information, draft a helpful and appropriate reply. Remember to ALWAYS include percentage matches in your reply and NEVER leave template placeholders like [Name] or [Company] in your response.
"""

            # Make the OpenAI API call
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
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
