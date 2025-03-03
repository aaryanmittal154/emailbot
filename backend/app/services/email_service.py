from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import base64
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import json
import time
from sqlalchemy import func

from app.db.database import get_db
from app.models.user import User
from app.models.email import EmailMetadata as Email
from app.schemas.email import (
    EmailCreate,
    EmailResponse,
    ThreadResponse,
    SendEmailRequest,
)
from app.services.auth_service import get_current_user, get_google_creds
from app.services.embedding_service import process_thread_for_semantic_search
from app.services.vector_db_service import vector_db


def get_gmail_service(credentials: Credentials):
    """Create Gmail API service instance"""
    return build("gmail", "v1", credentials=credentials)


def build_gmail_service(credentials: Credentials):
    """Alias for get_gmail_service for backward compatibility"""
    return get_gmail_service(credentials)


def list_messages(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    max_results: int = 20,
    q: str = None,
    label_ids: List[str] = None,
    page: int = 1,
    use_cache: bool = True,
):
    """
    List Gmail messages for a user with pagination

    This function implements a hybrid approach:
    1. First tries to get email metadata from database cache
    2. If cache is empty or outdated, fetches from Gmail API
    3. Stores basic metadata in the database for future quick access
    """
    print(
        f"Listing emails for user: {user.email}, max_results: {max_results}, page: {page}"
    )

    try:
        # Calculate offset for pagination
        offset = (page - 1) * max_results

        # If we're using cache and it's not a search query, try to get from database first
        if use_cache and not q and not label_ids:
            # Check if we have emails in the database
            existing_emails = (
                db.query(Email)
                .filter(Email.user_id == user.id)
                .order_by(Email.date.desc())
                .offset(offset)
                .limit(max_results)
                .all()
            )

            # If we have enough emails in cache, return them
            if len(existing_emails) >= max_results or len(existing_emails) > 0:
                print(
                    f"Using cached email metadata from database, found {len(existing_emails)} emails"
                )
                # Convert to dict format and return
                return [
                    {
                        "id": email.id,
                        "user_id": email.user_id,
                        "gmail_id": email.gmail_id,
                        "thread_id": email.thread_id,
                        "sender": email.sender,
                        "recipients": email.recipients if email.recipients else [],
                        "subject": email.subject or "",
                        "snippet": email.snippet or "",
                        "date": email.date.isoformat() if email.date else None,
                        "labels": email.labels if email.labels else [],
                        "has_attachment": email.has_attachment,
                        "is_read": email.is_read,
                        "created_at": (
                            email.created_at.isoformat() if email.created_at else None
                        ),
                        "updated_at": (
                            email.updated_at.isoformat() if email.updated_at else None
                        ),
                    }
                    for email in existing_emails
                ]

        # If we don't have enough cached data or we have a search/filter,
        # fetch from Gmail API
        print("Fetching email data from Gmail API")
        # Get Google credentials
        credentials = get_google_creds(user.id, db)

        # Create Gmail API service
        service = get_gmail_service(credentials)

        # Prepare query parameters
        params = {
            "userId": "me",
            "maxResults": max_results,
        }

        if q:
            params["q"] = q

        if label_ids:
            params["labelIds"] = label_ids

        print(f"Calling Gmail API with params: {params}")
        # Call Gmail API to list messages
        results = service.users().messages().list(**params).execute()
        messages = results.get("messages", [])
        print(f"Found {len(messages)} messages")

        # Fetch full message details and store metadata
        email_data = []
        for message in messages:
            # First check if we already have this message in the database
            existing_email = (
                db.query(Email)
                .filter(
                    Email.gmail_id == message["id"],
                    Email.user_id == user.id,
                )
                .first()
            )

            if existing_email:
                print(f"Using existing email metadata for message {message['id']}")
                email_metadata = existing_email
            else:
                # Get message details from Gmail API
                msg = (
                    service.users()
                    .messages()
                    .get(userId="me", id=message["id"])
                    .execute()
                )

                # Extract email metadata
                headers = {
                    header["name"].lower(): header["value"]
                    for header in msg.get("payload", {}).get("headers", [])
                }

                # Process and store the email metadata
                email_metadata = process_email_metadata(msg, headers, user.id, db)

            # Convert SQLAlchemy model to dictionary and append to results
            email_dict = {
                "id": email_metadata.id,
                "user_id": email_metadata.user_id,
                "gmail_id": email_metadata.gmail_id,
                "thread_id": email_metadata.thread_id,
                "sender": email_metadata.sender,
                "recipients": (
                    email_metadata.recipients if email_metadata.recipients else []
                ),
                "subject": email_metadata.subject or "",
                "snippet": email_metadata.snippet or "",
                "date": (
                    email_metadata.date.isoformat() if email_metadata.date else None
                ),
                "labels": email_metadata.labels if email_metadata.labels else [],
                "has_attachment": email_metadata.has_attachment,
                "is_read": email_metadata.is_read,
                "created_at": (
                    email_metadata.created_at.isoformat()
                    if email_metadata.created_at
                    else None
                ),
                "updated_at": (
                    email_metadata.updated_at.isoformat()
                    if email_metadata.updated_at
                    else None
                ),
            }
            email_data.append(email_dict)

        print(f"Processed {len(email_data)} emails for user: {user.email}")
        return email_data
    except Exception as e:
        print(f"Error in list_messages: {str(e)}")
        raise


def get_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    store_embedding: bool = False,
):
    """Get a Gmail thread by ID with enhanced processing for chronological ordering"""
    try:
        # Get Google credentials
        credentials = get_google_creds(user.id, db)

        # Create Gmail API service
        service = get_gmail_service(credentials)

        # Get thread from Gmail API
        thread = (
            service.users()
            .threads()
            .get(userId="me", id=thread_id, format="full")
            .execute()
        )

        print(
            f"Retrieved thread {thread_id} with {len(thread.get('messages', []))} messages"
        )

        # Process and organize thread messages
        messages = []
        participants = set()
        subject = ""
        # Use timezone-aware datetime.min
        last_updated = datetime.min.replace(tzinfo=timezone.utc)

        # First pass - extract all message data
        for message in thread.get("messages", []):
            # Get message headers
            headers = {
                header["name"].lower(): header["value"]
                for header in message.get("payload", {}).get("headers", [])
            }

            # Process email metadata
            email_metadata = process_email_metadata(message, headers, user.id, db)

            # Extract message body if available
            body = {}
            message_parts = [message.get("payload", {})]

            while message_parts:
                part = message_parts.pop(0)

                # Handle multipart messages
                if part.get("mimeType", "").startswith("multipart/"):
                    if "parts" in part:
                        message_parts.extend(part["parts"])
                # Handle text parts
                elif (
                    part.get("mimeType") == "text/plain"
                    and "body" in part
                    and "data" in part["body"]
                ):
                    encoded_data = (
                        part["body"]["data"].replace("-", "+").replace("_", "/")
                    )
                    body["plain"] = base64.b64decode(encoded_data).decode("utf-8")
                elif (
                    part.get("mimeType") == "text/html"
                    and "body" in part
                    and "data" in part["body"]
                ):
                    encoded_data = (
                        part["body"]["data"].replace("-", "+").replace("_", "/")
                    )
                    body["html"] = base64.b64decode(encoded_data).decode("utf-8")

            # Determine the best body content to use (prefer HTML, fall back to plain text)
            final_body = body.get("html", body.get("plain", ""))

            # For plain text, convert newlines to <br> for better display
            if not body.get("html") and body.get("plain"):
                # Simple conversion of plain text to HTML with preservation of line breaks
                final_body = (
                    "<div style='white-space: pre-wrap;'>"
                    + body.get("plain", "")
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\n", "<br>")
                    + "</div>"
                )

            # Convert SQLAlchemy model to dictionary
            email_dict = {
                "id": email_metadata.id,
                "user_id": email_metadata.user_id,
                "gmail_id": email_metadata.gmail_id,
                "thread_id": email_metadata.thread_id,
                "sender": email_metadata.sender,
                "recipients": (
                    email_metadata.recipients if email_metadata.recipients else []
                ),
                "subject": email_metadata.subject or "",
                "snippet": email_metadata.snippet or "",
                "body": final_body,  # Add the message body
                "date": (
                    email_metadata.date.isoformat() if email_metadata.date else None
                ),
                "labels": email_metadata.labels if email_metadata.labels else [],
                "has_attachment": email_metadata.has_attachment,
                "is_read": email_metadata.is_read,
                "created_at": (
                    email_metadata.created_at.isoformat()
                    if email_metadata.created_at
                    else None
                ),
                "updated_at": (
                    email_metadata.updated_at.isoformat()
                    if email_metadata.updated_at
                    else None
                ),
                # Add internal date from Gmail for precise sorting
                "internal_date": int(message.get("internalDate", 0)),
                # Track message position in conversation
                "message_position": {"is_first": False, "is_last": False},
            }
            messages.append(email_dict)

            # Extract participants
            if "from" in headers:
                participants.add(headers["from"])

            if "to" in headers:
                for recipient in headers["to"].split(","):
                    participants.add(recipient.strip())

            # Get subject
            if "subject" in headers and not subject:
                subject = headers["subject"]

            # Track latest message date
            # Ensure both dates have timezone info before comparing
            if email_metadata.date:
                # Add timezone if not present
                email_date = email_metadata.date
                if email_date.tzinfo is None:
                    email_date = email_date.replace(tzinfo=timezone.utc)

                # Ensure last_updated has timezone info (it should already, but just to be safe)
                if last_updated.tzinfo is None:
                    last_updated = last_updated.replace(tzinfo=timezone.utc)

                # Now both datetimes are timezone-aware, so we can safely compare them
                if email_date > last_updated:
                    last_updated = email_date

        # Sort messages chronologically by internalDate
        messages.sort(key=lambda x: x["internal_date"])

        # Mark first and last messages
        if messages:
            messages[0]["message_position"]["is_first"] = True
            messages[-1]["message_position"]["is_last"] = True

        # Create thread response
        thread_response = {
            "thread_id": thread_id,
            "messages": messages,
            "subject": subject or "(No Subject)",
            "participants": list(participants),
            "message_count": len(messages),
            "last_updated": (
                last_updated.isoformat()
                if last_updated != datetime.min.replace(tzinfo=timezone.utc)
                else datetime.now(timezone.utc).isoformat()
            ),
        }

        # Generate embedding and store in vector database if requested
        if store_embedding:
            try:
                # Process thread for semantic search
                enhanced_thread = process_thread_for_semantic_search(thread_response)

                # Store in vector database
                vector_db.upsert_thread(user.id, enhanced_thread)

                print(f"Thread {thread_id} embedding stored in vector database")
            except Exception as e:
                print(f"Error storing thread embedding: {str(e)}")

        return thread_response
    except Exception as e:
        print(f"Error in get_thread: {str(e)}")
        raise


def send_email(
    email_request: SendEmailRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send an email using Gmail API with proper handling of:
    - Threading (using References/In-Reply-To headers)
    - Content types (HTML vs plain text)
    - Base64url encoding
    - Optimized API calls
    """
    try:
        # Get Google credentials
        credentials = get_google_creds(user.id, db)

        # Create Gmail API service
        service = get_gmail_service(credentials)

        # Create a proper MIME message
        if email_request.html:
            # Create an HTML email
            message = MIMEText(email_request.body, "html")
        else:
            # Create a plain text email
            message = MIMEText(email_request.body, "plain")

        # Set basic headers
        message["to"] = ", ".join(email_request.to)
        message["subject"] = email_request.subject
        message["from"] = user.email

        # Set CC/BCC if provided
        if email_request.cc:
            message["cc"] = ", ".join(email_request.cc)

        if email_request.bcc:
            message["bcc"] = ", ".join(email_request.bcc)

        # Add threading headers if this is a reply
        if email_request.thread_id:
            # If in_reply_to is provided, use it, otherwise generate from thread_id
            message_id = (
                email_request.in_reply_to
                or f"<{email_request.thread_id}@mail.gmail.com>"
            )
            message["In-Reply-To"] = message_id

            # If references are provided, use them, otherwise use the thread_id
            if email_request.references:
                message["References"] = " ".join(email_request.references)
            else:
                message["References"] = message_id

        # Encode message properly using base64url encoding
        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

        # Create Gmail API request body
        create_message = {"raw": encoded_message}

        # If thread_id is provided, include it in the request
        if email_request.thread_id:
            create_message["threadId"] = email_request.thread_id

        # Send message
        sent_message = (
            service.users().messages().send(userId="me", body=create_message).execute()
        )

        return {
            "message_id": sent_message["id"],
            "thread_id": sent_message["threadId"],
            "success": True,
        }
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        # Check if this is a rate limit error
        if "rate limit exceeded" in str(e).lower():
            from app.models.gmail_rate_limit import GmailRateLimit
            import re
            from dateutil import parser

            # Try to extract retry date from error
            date_match = re.search(
                r"until (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)", str(e)
            )
            if date_match:
                retry_after_str = date_match.group(1)
                retry_after = parser.parse(retry_after_str)
                # Add to rate limit database
                GmailRateLimit.add_limit(db, user.id, retry_after, "send_email")

                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Gmail API rate limit exceeded. Retry after {retry_after_str}",
                )

        # Other errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}",
        )


def process_email_metadata(message, headers, user_id, db):
    """
    Process and store email metadata

    This function:
    1. Extracts metadata from Gmail message
    2. Checks if email already exists in DB
    3. Creates or updates email metadata in DB
    4. Returns the email metadata object
    """
    # Extract message data
    message_id = message["id"]
    thread_id = message["threadId"]
    snippet = message.get("snippet", "")
    labels = message.get("labelIds", [])

    # Get email headers - convert names to lowercase for consistent access
    if isinstance(headers, dict):
        # Headers already processed as dictionary
        sender = headers.get("from", "")
        recipients_str = headers.get("to", "")
        subject = headers.get("subject", "")
        date_str = headers.get("date", "")
    else:
        # Process headers as list of dicts with name/value pairs
        headers_dict = {header["name"].lower(): header["value"] for header in headers}
        sender = headers_dict.get("from", "")
        recipients_str = headers_dict.get("to", "")
        subject = headers_dict.get("subject", "")
        date_str = headers_dict.get("date", "")

    # Parse recipients
    recipients = [r.strip() for r in recipients_str.split(",") if r.strip()]

    # Parse date
    try:
        from email.utils import parsedate_to_datetime

        date = parsedate_to_datetime(date_str)
    except Exception as e:
        print(f"Error parsing date '{date_str}': {str(e)}")
        # Use internal date as a fallback
        try:
            timestamp = (
                int(message.get("internalDate", 0)) / 1000
            )  # Convert ms to seconds
            from datetime import timezone

            date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except Exception as inner_e:
            print(f"Error using internalDate as fallback: {str(inner_e)}")
            date = datetime.now(timezone.utc)

    # Check if message has attachments
    has_attachment = False
    if "parts" in message.get("payload", {}):
        for part in message["payload"]["parts"]:
            if "filename" in part and part["filename"]:
                has_attachment = True
                break

    # Check if the email already exists in the database
    email = (
        db.query(Email)
        .filter(Email.gmail_id == message_id, Email.user_id == user_id)
        .first()
    )

    if not email:
        # Create new email metadata
        email = Email(
            user_id=user_id,
            gmail_id=message_id,
            thread_id=thread_id,
            sender=sender,
            recipients=recipients,
            subject=subject,
            snippet=snippet,
            date=date,
            labels=labels,
            has_attachment=has_attachment,
            is_read="UNREAD" not in labels,
        )
        db.add(email)
        print(f"Created new email metadata for message {message_id}")
    else:
        # Update existing email metadata to ensure we have the latest info
        email.thread_id = thread_id
        email.sender = sender
        email.recipients = recipients
        email.subject = subject
        email.snippet = snippet
        email.date = date
        email.labels = labels
        email.has_attachment = has_attachment
        email.is_read = "UNREAD" not in labels
        email.updated_at = datetime.now()
        print(f"Updated existing email metadata for message {message_id}")

    # Commit the changes
    db.commit()
    db.refresh(email)

    return email


def search_similar_threads(
    query: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    top_k: int = 10,
):
    """
    Search for email threads similar to the query using semantic search

    Args:
        query: The search query text
        user: The current user
        db: Database session
        top_k: Number of results to return

    Returns:
        List of threads ordered by semantic similarity
    """
    try:
        from app.services.embedding_service import create_thread_embedding

        # Create embedding for the query
        query_embedding = create_thread_embedding(query)

        # Search vector database
        results = vector_db.search_threads(user.id, query_embedding, top_k)

        # Return search results
        return {"query": query, "results": results, "count": len(results)}
    except Exception as e:
        print(f"Error in search_similar_threads: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching threads: {str(e)}",
        )


def index_all_threads(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    max_threads: int = 100,
):
    """
    Index all threads for a user to enable semantic search

    This function:
    1. Fetches thread IDs from Gmail
    2. Retrieves full thread data
    3. Generates embeddings
    4. Stores in Pinecone
    """
    try:
        # Get Google credentials
        credentials = get_google_creds(user.id, db)

        # Create Gmail API service
        service = get_gmail_service(credentials)

        # Get list of thread IDs
        results = (
            service.users()
            .threads()
            .list(userId="me", maxResults=max_threads)
            .execute()
        )
        threads = results.get("threads", [])

        print(f"Found {len(threads)} threads to index")

        indexed_count = 0
        for thread_item in threads:
            thread_id = thread_item["id"]
            try:
                # Get full thread data
                thread_data = get_thread(thread_id, user, db, store_embedding=True)
                indexed_count += 1

                # Add a delay to avoid rate limiting
                time.sleep(0.5)
            except Exception as thread_error:
                print(f"Error processing thread {thread_id}: {str(thread_error)}")
                continue

        return {
            "success": True,
            "indexed_count": indexed_count,
            "total_threads": len(threads),
        }
    except Exception as e:
        print(f"Error in index_all_threads: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error indexing threads: {str(e)}",
        )


# Analytics methods
def get_email_count(user_id: int, db: Session) -> int:
    """Get the total count of emails for a user."""
    return db.query(Email).filter(Email.user_id == user_id).count()


def get_unread_email_count(user_id: int, db: Session) -> int:
    """Get the count of unread emails for a user."""
    return (
        db.query(Email).filter(Email.user_id == user_id, Email.is_read == False).count()
    )


def get_email_count_since(
    user_id: int,
    since_date: datetime,
    until_date: Optional[datetime] = None,
    db: Session = None,
) -> int:
    """Get the count of emails since a specific date."""
    query = db.query(Email).filter(
        Email.user_id == user_id,
        Email.date >= since_date,
    )

    if until_date:
        query = query.filter(Email.date < until_date)

    return query.count()


def get_sent_email_count_since(user_id: int, since_date: datetime, db: Session) -> int:
    """Get the count of sent emails since a specific date."""
    # Get the user's email
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return 0

    # Find sent emails where the user is in the 'from' field
    return (
        db.query(Email)
        .filter(
            Email.user_id == user_id,
            Email.date >= since_date,
            Email.sender.like(f"%{user.email}%"),
        )
        .count()
    )


def get_top_senders(user_id: int, limit: int, db: Session) -> List[Dict[str, Any]]:
    """Get the top email senders for a user."""
    # Group by sender and count
    sender_counts = (
        db.query(Email.sender.label("email"), func.count(Email.id).label("count"))
        .filter(Email.user_id == user_id)
        .group_by(Email.sender)
        .order_by(func.count(Email.id).desc())
        .limit(limit)
        .all()
    )

    # Convert to list of dicts
    return [{"email": sender, "count": count} for sender, count in sender_counts]


def get_average_response_time(user_id: int, since_date: datetime, db: Session) -> str:
    """Get the average response time for a user's emails."""
    # This is a complex calculation that would involve:
    # 1. Finding pairs of received and sent emails in the same thread
    # 2. Calculating the time difference between them
    # 3. Averaging these differences

    # For simplicity, we'll return a mock value
    # In a real implementation, this would be calculated from the data
    return "2.5 hours"


def get_busiest_day(user_id: int, since_date: datetime, db: Session) -> str:
    """Get the busiest day of the week for email activity."""
    # This would involve:
    # 1. Extracting the day of week from email timestamps
    # 2. Counting emails per day
    # 3. Finding the day with the most emails

    # For simplicity, we'll return a mock value
    # In a real implementation, this would be calculated from the data
    return "Monday"


def get_key_contacts(
    user_id: int, since_date: datetime, limit: int, db: Session
) -> List[str]:
    """Get the most contacted email addresses."""
    # This would involve analyzing both sent and received emails
    # to determine the most frequent contacts

    # For simplicity, we'll return mock values
    # In a real implementation, this would be calculated from the data
    return ["colleague@company.com", "client@client.com", "team@organization.com"]


def get_popular_topics(
    user_id: int, since_date: datetime, db: Session
) -> List[Dict[str, Any]]:
    """Get popular topics from emails in the specified timeframe."""
    # In a real implementation, this would use NLP to extract topics
    # from email subjects and bodies

    # For simplicity, we'll return mock values
    return [
        {"topic": "Project Update", "count": 23, "sentiment": "positive"},
        {"topic": "Meeting Request", "count": 18, "sentiment": "neutral"},
        {"topic": "Support Ticket", "count": 15, "sentiment": "negative"},
        {"topic": "Newsletter", "count": 12, "sentiment": "neutral"},
        {"topic": "Product Launch", "count": 10, "sentiment": "positive"},
    ]


def get_sentiment_analysis(
    user_id: int, since_date: datetime, db: Session
) -> Dict[str, Any]:
    """Get sentiment analysis of emails in the specified timeframe."""
    # In a real implementation, this would use NLP to analyze
    # the sentiment of email content

    # For simplicity, we'll return mock values
    return {
        "overall": "positive",
        "breakdown": {"positive": 65, "neutral": 25, "negative": 10},
        "trend": "up",
    }


def get_email_patterns_by_day(user_id: int, db: Session) -> Dict[str, int]:
    """Get email patterns by day of week."""
    # This would analyze email timestamps to determine
    # the distribution of emails across days of the week

    # For simplicity, we'll return mock values
    return {
        "Monday": 24,
        "Tuesday": 20,
        "Wednesday": 22,
        "Thursday": 26,
        "Friday": 18,
        "Saturday": 5,
        "Sunday": 3,
    }


def get_email_patterns_by_hour(user_id: int, db: Session) -> List[Dict[str, int]]:
    """Get email patterns by hour of day."""
    # This would analyze email timestamps to determine
    # the busiest hours for email activity

    # For simplicity, we'll return mock values
    return [
        {"hour": 9, "count": 42},
        {"hour": 14, "count": 35},
        {"hour": 17, "count": 28},
    ]


def get_response_times_by_time_of_day(user_id: int, db: Session) -> Dict[str, str]:
    """Get average response times by time of day."""
    # This would calculate average response times for
    # different times of day (morning, afternoon, evening)

    # For simplicity, we'll return mock values
    return {"morning": "15 minutes", "afternoon": "28 minutes", "evening": "45 minutes"}


def parse_search_query(query: str) -> Dict[str, Any]:
    """Parse a natural language search query into structured parameters."""
    # In a real implementation, this would use NLP (possibly via OpenAI)
    # to parse the natural language query into structured parameters

    # For simplicity, we'll return basic parsed parameters
    return {
        "keywords": query.split(),
        "date_range": None,
        "sender": None,
        "has_attachments": False,
    }


def execute_smart_search(
    user_id: int, search_params: Dict[str, Any], page: int, page_size: int, db: Session
) -> List[Dict[str, Any]]:
    """Execute a search with the parsed parameters."""
    # In a real implementation, this would use the parsed parameters
    # to perform a search across emails

    # For simplicity, we'll return mock results
    return [
        {
            "thread_id": "thread1",
            "subject": "Project Discussion",
            "snippet": "Let's discuss the project timeline...",
            "date": "2023-06-15T10:30:00Z",
            "sender": "colleague@company.com",
        },
        {
            "thread_id": "thread2",
            "subject": "Weekly Update",
            "snippet": "Here's the weekly progress update...",
            "date": "2023-06-14T14:45:00Z",
            "sender": "manager@company.com",
        },
    ]


def generate_search_suggestions(user_id: int, query: str, db: Session) -> List[str]:
    """Generate search suggestions based on a partial query."""
    # In a real implementation, this would analyze the partial query
    # and suggest relevant search terms based on email content

    # For simplicity, we'll return basic suggestions
    return [
        f"emails about '{query}'",
        f"'{query}' from last week",
        f"important emails containing '{query}'",
    ]


# Create a dictionary of all email service functions
email_service = {
    "get_gmail_service": get_gmail_service,
    "build_gmail_service": build_gmail_service,
    "list_messages": list_messages,
    "get_thread": get_thread,
    "send_email": send_email,
    "process_email_metadata": process_email_metadata,
    "search_similar_threads": search_similar_threads,
    "index_all_threads": index_all_threads,
    # Add new analytics functions
    "get_email_count": get_email_count,
    "get_unread_email_count": get_unread_email_count,
    "get_email_count_since": get_email_count_since,
    "get_sent_email_count_since": get_sent_email_count_since,
    "get_top_senders": get_top_senders,
    "get_average_response_time": get_average_response_time,
    "get_busiest_day": get_busiest_day,
    "get_key_contacts": get_key_contacts,
    "get_popular_topics": get_popular_topics,
    "get_sentiment_analysis": get_sentiment_analysis,
    "get_email_patterns_by_day": get_email_patterns_by_day,
    "get_email_patterns_by_hour": get_email_patterns_by_hour,
    "get_response_times_by_time_of_day": get_response_times_by_time_of_day,
    "parse_search_query": parse_search_query,
    "execute_smart_search": execute_smart_search,
    "generate_search_suggestions": generate_search_suggestions,
}
