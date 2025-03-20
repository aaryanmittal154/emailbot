import base64
import time
import json
import re
import asyncio
from datetime import datetime, timedelta, timezone
import html
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
import os

from app.db.database import get_db
from app.models.user import User
from app.models.email import EmailMetadata as Email
from app.services.auth_service import get_google_creds
from app.services.vector_db_service import vector_db
from fastapi import Depends, HTTPException
from fastapi import status
from app.schemas.email import SendEmailRequest
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional
import os
import asyncio
import re
import html

from app.services.auth_service import get_current_user
from app.services.embedding_service import process_thread_for_semantic_search
from app.utils.thread_utils import get_thread_category

# Import the email classifier - we'll use it in index_all_threads
try:
    from app.services.email_classifier_service import email_classifier
except ImportError:
    email_classifier = None
    print("WARNING: email_classifier could not be imported")


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
    refresh_db: bool = False,
):
    """
    List Gmail messages for a user with pagination

    This function implements a hybrid approach:
    1. First tries to get email metadata from database cache
    2. If cache is empty or outdated, fetches from Gmail API
    3. Stores basic metadata in the database for future quick access

    If refresh_db is True, only data from the database will be used (no Gmail API calls)
    """
    print(
        f"Listing emails for user: {user.email}, max_results: {max_results}, page: {page}, refresh_db: {refresh_db}"
    )

    try:
        # Calculate offset for pagination
        offset = (page - 1) * max_results

        # If we're using cache and it's not a search query, or if refresh_db is True,
        # try to get from database first
        if (use_cache and not q and not label_ids) or refresh_db:
            # First get the timestamp of when initial indexing completed
            # This will be used to differentiate between initial indexed emails and new ones
            # We define it as the earliest creation date of any indexed email
            earliest_email = (
                db.query(Email)
                .filter(Email.user_id == user.id)
                .order_by(Email.created_at.asc())
                .first()
            )

            # Query emails from database with pagination
            query = db.query(Email).filter(Email.user_id == user.id)

            # Apply search filters if provided
            if q:
                search_terms = q.split()
                for term in search_terms:
                    query = query.filter(
                        or_(
                            Email.subject.ilike(f"%{term}%"),
                            Email.sender.ilike(f"%{term}%"),
                            Email.snippet.ilike(f"%{term}%"),
                        )
                    )

            if label_ids:
                # Get threads with these labels
                thread_labels = (
                    db.query(ThreadLabel)
                    .filter(
                        ThreadLabel.user_id == user.id,
                        ThreadLabel.label_id.in_(label_ids),
                    )
                    .all()
                )
                thread_ids = [tl.thread_id for tl in thread_labels]
                if thread_ids:
                    query = query.filter(Email.thread_id.in_(thread_ids))
                else:
                    # No threads with these labels, return empty list
                    return []

            # Order by date descending (newest first)
            query = query.order_by(Email.date.desc())

            # Apply pagination
            query = query.offset(offset).limit(max_results)

            # Execute query
            db_emails = query.all()

            # If we got results and we're not forcing refresh from Gmail API, use them
            if db_emails and (refresh_db or len(db_emails) >= max_results):
                print(f"Using {len(db_emails)} emails from database cache")
                return [
                    {
                        "id": email.id,
                        "thread_id": email.thread_id,
                        "gmail_id": email.gmail_id,
                        "sender": email.sender,
                        "recipients": email.recipients,
                        "subject": email.subject,
                        "snippet": email.snippet,
                        "date": email.date.isoformat() if email.date else None,
                        "labels": email.labels,
                        "has_attachment": email.has_attachment,
                        "is_read": email.is_read,
                    }
                    for email in db_emails
                ]

        # If refresh_db is True and we reach here, it means we didn't find enough data in DB
        # Return what we have rather than calling Gmail API
        if refresh_db:
            print(
                f"refresh_db is True but found insufficient data in database. Returning available data."
            )
            return []

        # For other cases, continue to use Gmail API as before
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
                "body": final_body,  # Add the message body
                "full_content": email_metadata.full_content,  # Add the full content from DB if available
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
        service = build_gmail_service(credentials)

        # Try to find thread messages from database first (if all are cached)
        cached_messages = (
            db.query(Email)
            .filter(Email.thread_id == thread_id, Email.user_id == user.id)
            .order_by(Email.date.asc())
            .all()
        )

        # Initial thread data structure
        messages = []
        participants = set()
        subject = ""
        # Use timezone-aware datetime.min
        last_updated = datetime.min.replace(tzinfo=timezone.utc)

        # Check if we need to get from Gmail API (if not all messages are in DB)
        get_from_api = True

        # If we have messages in database, check if we have the complete thread
        if cached_messages:
            # First get the thread data to check the message count
            thread_data = (
                service.users().threads().get(userId="me", id=thread_id).execute()
            )

            # If we have all messages cached, use the cache
            if len(cached_messages) == len(thread_data.get("messages", [])):
                get_from_api = False
                print(
                    f"Using {len(cached_messages)} cached messages for thread {thread_id}"
                )

        # If we need to get from API, process thread messages from Gmail API
        if get_from_api:
            # Get the thread data from Gmail API
            thread_data = (
                service.users()
                .threads()
                .get(userId="me", id=thread_id, format="full")
                .execute()
            )

            # Process each message in the thread
            for message in thread_data.get("messages", []):
                # Extract headers
                headers = {}
                for header in message.get("payload", {}).get("headers", []):
                    headers[header["name"].lower()] = header["value"]

                # Check if we already have this message in the database
                email_metadata = (
                    db.query(Email)
                    .filter(
                        Email.gmail_id == message["id"],
                        Email.user_id == user.id,
                    )
                    .first()
                )

                if not email_metadata:
                    # Process and store the email metadata
                    email_metadata = process_email_metadata(
                        message, headers, user.id, db
                    )

                # Extract message body
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
                    "full_content": email_metadata.full_content,  # Add the full content from DB if available
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

                # Extract subject (use the first message's subject as the thread subject)
                if "subject" in headers and not subject:
                    subject = headers["subject"]

                # Track last updated date
                if email_metadata.date and email_metadata.date > last_updated:
                    last_updated = email_metadata.date
        else:
            # Use cached messages
            for email_metadata in cached_messages:
                # Try to extract body content for display
                body_content = ""

                # If we have full_content, convert it to HTML for display
                if email_metadata.full_content:
                    body_content = f"<div style='white-space: pre-wrap;'>{html.escape(email_metadata.full_content).replace(chr(10), '<br>')}</div>"

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
                    "body": (
                        body_content
                        if body_content
                        else f"<div>{email_metadata.snippet or ''}</div>"
                    ),
                    "full_content": email_metadata.full_content,  # Add the full content from DB
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
                    "internal_date": 0,  # Unknown for cached messages
                    "message_position": {"is_first": False, "is_last": False},
                }
                messages.append(email_dict)

                # Extract participants
                if email_metadata.sender:
                    participants.add(email_metadata.sender)

                for recipient in email_metadata.recipients or []:
                    participants.add(recipient)

                # Extract subject
                if email_metadata.subject and not subject:
                    subject = email_metadata.subject

                # Track last updated date
                if email_metadata.date and email_metadata.date > last_updated:
                    last_updated = email_metadata.date

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

        # If this is a reply, get the original message content to quote
        quoted_content = ""
        original_sender = ""
        original_date = ""
        original_message_id = None
        thread_data = None

        if email_request.thread_id:
            try:
                # Get the full thread data for both quoting and threading
                thread_data = get_thread(email_request.thread_id, user, db)

                if thread_data and thread_data["messages"]:
                    # Find the original message to reply to (latest message)
                    original_message = thread_data["messages"][-1]

                    # Extract sender and date from original message for quoting
                    original_sender = original_message.get("sender", "")
                    original_date = original_message.get("date", "")

                    # Get plain text content for quoting
                    message_content = original_message.get(
                        "body", original_message.get("snippet", "")
                    )

                    # Extract the message ID from the latest message
                    for header in original_message.get("headers", []):
                        if header["name"].lower() == "message-id":
                            original_message_id = header["value"]
                            break

                    # Create quoted text in standard email format
                    if email_request.html:
                        # Format for HTML emails
                        quoted_content = f"""
                        <div class="gmail_quote">
                        <div>On {original_date}, {original_sender} wrote:</div>
                        <blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">
                        {message_content}
                        </blockquote>
                        </div>
                        """
                    else:
                        # Format for plain text emails
                        quoted_lines = message_content.split("\n")
                        quoted_text = "\n".join([f"> {line}" for line in quoted_lines])
                        quoted_content = f"\n\nOn {original_date}, {original_sender} wrote:\n{quoted_text}"
            except Exception as e:
                print(f"Error getting original message content: {str(e)}")
                # Continue without quoted content if we can't get it

        # Prepare the email body - combine new content with quoted content
        body_content = email_request.body
        if quoted_content and not email_request.suppress_quote:
            if email_request.html:
                body_content = f"{body_content}{quoted_content}"
            else:
                body_content = f"{body_content}{quoted_content}"

        # CRITICAL CHANGE: For replies, use Gmail's specific reply method instead of sending raw emails
        if email_request.thread_id:
            try:
                # Get the Gmail message details directly
                original_gmail_message = None
                original_message_id = None

                # Try to get the ACTUAL message from Gmail directly
                try:
                    # First get the message ID from our database or thread data
                    message_id_to_reply_to = None

                    if thread_data and thread_data["messages"]:
                        # Get the most recent message that isn't from the current user
                        for msg in reversed(thread_data["messages"]):
                            if msg.get("sender") != user.email:
                                if "gmail_id" in msg:
                                    message_id_to_reply_to = msg["gmail_id"]
                                    break

                        # If no messages from others found, just use the last message
                        if not message_id_to_reply_to and thread_data["messages"]:
                            message_id_to_reply_to = thread_data["messages"][-1].get(
                                "gmail_id"
                            )

                    # Once we have the message ID, get the FULL Gmail message
                    if message_id_to_reply_to:
                        # Get full message format to use for reply
                        original_gmail_message = (
                            service.users()
                            .messages()
                            .get(userId="me", id=message_id_to_reply_to, format="full")
                            .execute()
                        )

                        # Extract the RFC822 Message-ID for proper threading
                        headers = {
                            h["name"]: h["value"]
                            for h in original_gmail_message.get("payload", {}).get(
                                "headers", []
                            )
                        }
                        original_message_id = headers.get("Message-ID")

                        print(
                            f"Retrieved original Gmail message: {message_id_to_reply_to}"
                        )
                except Exception as msg_error:
                    print(f"Error getting original Gmail message: {str(msg_error)}")

                # ==========================================
                # APPROACH 1: Use Gmail's reply drafting approach
                # ==========================================

                if original_gmail_message:
                    try:
                        # Create a modified draft reply
                        # This uses Gmail's native threading by modifying an existing message

                        # Create a draft based on the original message
                        draft_reply = {
                            "message": {
                                "threadId": email_request.thread_id,
                                "payload": {
                                    "headers": [
                                        {
                                            "name": "To",
                                            "value": ", ".join(email_request.to),
                                        },
                                        {
                                            "name": "Subject",
                                            "value": email_request.subject,
                                        },
                                        {
                                            "name": "In-Reply-To",
                                            "value": original_message_id,
                                        },
                                        {
                                            "name": "References",
                                            "value": original_message_id,
                                        },
                                    ],
                                    "body": {
                                        "data": base64.urlsafe_b64encode(
                                            body_content.encode()
                                        ).decode()
                                    },
                                },
                            }
                        }

                        # Add CC if provided
                        if email_request.cc:
                            draft_reply["message"]["payload"]["headers"].append(
                                {"name": "Cc", "value": ", ".join(email_request.cc)}
                            )

                        # Try a totally different approach - create a draft then send it
                        # This forces Gmail to handle the threading
                        try:
                            # Create a proper MIME message with ALL required headers
                            email_mime = MIMEMultipart()
                            email_mime["From"] = user.email
                            email_mime["To"] = ", ".join(email_request.to)
                            email_mime["Subject"] = email_request.subject

                            if original_message_id:
                                email_mime["In-Reply-To"] = original_message_id
                                email_mime["References"] = original_message_id

                            # Add body
                            if email_request.html:
                                part = MIMEText(body_content, "html")
                            else:
                                part = MIMEText(body_content, "plain")

                            email_mime.attach(part)

                            # Convert to raw and encode
                            raw_message = base64.urlsafe_b64encode(
                                email_mime.as_bytes()
                            ).decode()

                            # Send using a different format that forces Gmail to use threading
                            sent_message = (
                                service.users()
                                .messages()
                                .send(
                                    userId="me",
                                    body={
                                        "raw": raw_message,
                                        "threadId": email_request.thread_id,
                                    },
                                )
                                .execute()
                            )

                            print(
                                f"Sent using Gmail direct approach with explicit threadId"
                            )
                            print(
                                f"Thread ID in response: {sent_message.get('threadId')}"
                            )

                            return {
                                "message_id": sent_message.get("id"),
                                "thread_id": sent_message.get("threadId"),
                                "success": True,
                            }
                        except Exception as direct_send_error:
                            print(
                                f"Error with direct send method: {str(direct_send_error)}"
                            )
                            raise direct_send_error
                    except Exception as draft_error:
                        print(f"Error creating draft reply: {str(draft_error)}")

                # ==========================================
                # APPROACH 2: Create a reply using completely new method
                # ==========================================

                # Create a completely new format with all required headers but use Gmail's JSON format
                message_json = {"raw": "", "threadId": email_request.thread_id}

                # Create the email in RFC822 format
                if email_request.html:
                    mime_subtype = "html"
                else:
                    mime_subtype = "plain"

                # Create a message object
                message = MIMEMultipart()
                message["to"] = ", ".join(email_request.to)
                message["from"] = user.email
                message["subject"] = email_request.subject

                # Critical: Set reply headers
                if original_message_id:
                    message["In-Reply-To"] = original_message_id
                    message["References"] = original_message_id

                # Add the body
                message.attach(MIMEText(body_content, mime_subtype))

                # Encode as needed by Gmail API
                raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
                message_json["raw"] = raw

                # Send the message with explicit threadId
                sent_message = (
                    service.users()
                    .messages()
                    .send(userId="me", body=message_json)
                    .execute()
                )

                print(
                    f"Sent message using standard method with explicit threadId setting"
                )
                print(f"Thread ID: {sent_message.get('threadId')}")

                return {
                    "message_id": sent_message["id"],
                    "thread_id": sent_message["threadId"],
                    "success": True,
                }

            except Exception as reply_error:
                print(f"Error with reply methods: {str(reply_error)}")
                print("Falling back to standard MIME message method")
                # Fall back to the standard method if direct API method fails

        # Standard method for new emails or if direct reply failed
        # Create a proper MIME message
        if email_request.html:
            # Create an HTML email
            message = MIMEText(body_content, "html")
        else:
            # Create a plain text email
            message = MIMEText(body_content, "plain")

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
            # Get the actual message ID from the thread data if possible
            thread_message_id = original_message_id  # Use the one we already retrieved

            if not thread_message_id:
                try:
                    # Try to get the original message details to get correct Message-ID
                    if thread_data and thread_data["messages"]:
                        # First check headers from the message we're directly replying to
                        latest_message = thread_data["messages"][-1]
                        for header in latest_message.get("headers", []):
                            if header["name"].lower() == "message-id":
                                thread_message_id = header["value"]
                                break

                        # If not found, try the first message in the thread
                        if not thread_message_id:
                            first_message = thread_data["messages"][0]
                            for header in first_message.get("headers", []):
                                if header["name"].lower() == "message-id":
                                    thread_message_id = header["value"]
                                    break
                except Exception as e:
                    print(f"Error getting original message ID: {str(e)}")
                    # Fall back to default ID format if we can't get the real one

            # If we couldn't get the real Message-ID, create a properly formatted one
            if not thread_message_id:
                thread_message_id = f"<{email_request.thread_id}@mail.gmail.com>"

            # Set Message-ID for this email - make it unique and correctly formatted
            unique_id = (
                f"{email_request.thread_id}-{int(time.time())}-{os.urandom(4).hex()}"
            )
            message["Message-ID"] = f"<reply-{unique_id}@{user.email.split('@')[1]}>"

            # Set In-Reply-To header to reference the original message
            message["In-Reply-To"] = thread_message_id

            # Set References to include both the original message ID and any previous references
            references = []
            if email_request.references:
                references.extend(email_request.references)
            if thread_message_id not in references:
                references.append(thread_message_id)

            message["References"] = " ".join(references)

        # Add Gmail-specific threading header
        if email_request.thread_id:
            message["X-GM-THRID"] = email_request.thread_id

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

    # Extract the full message content
    full_content = ""
    try:
        payload = message.get("payload", {})
        # Handle single-part messages (no parts)
        if "body" in payload and "data" in payload["body"]:
            body_data = payload["body"]["data"]
            body_bytes = base64.urlsafe_b64decode(
                body_data + "=" * (4 - len(body_data) % 4)
            )
            full_content = body_bytes.decode("utf-8", errors="replace")
        # Handle multi-part messages (with parts)
        elif "parts" in payload:
            for part in payload["parts"]:
                mime_type = part.get("mimeType", "")
                # Process text parts
                if mime_type.startswith("text/"):
                    if "body" in part and "data" in part["body"]:
                        part_data = part["body"]["data"]
                        part_bytes = base64.urlsafe_b64decode(
                            part_data + "=" * (4 - len(part_data) % 4)
                        )
                        part_content = part_bytes.decode("utf-8", errors="replace")
                        full_content += part_content + "\n\n"
                # Process nested parts
                elif "parts" in part:
                    for nested_part in part["parts"]:
                        if "body" in nested_part and "data" in nested_part["body"]:
                            nested_data = nested_part["body"]["data"]
                            nested_bytes = base64.urlsafe_b64decode(
                                nested_data + "=" * (4 - len(nested_data) % 4)
                            )
                            nested_content = nested_bytes.decode(
                                "utf-8", errors="replace"
                            )
                            full_content += nested_content + "\n\n"

        # If we couldn't extract content, use the snippet
        if not full_content.strip():
            full_content = snippet
    except Exception as e:
        print(f"Error extracting full email content: {str(e)}")
        full_content = snippet  # Fallback to snippet

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
            full_content=full_content,
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
        email.full_content = full_content
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
    filter_category: Optional[str] = None,
):
    """
    Search for email threads similar to the query using semantic search

    Args:
        query: The search query text
        user: The current user
        db: Database session
        top_k: Number of results to return
        filter_category: Optional category filter (e.g., "Job Posting" or "Candidate")

    Returns:
        List of threads ordered by semantic similarity
    """
    try:
        from app.services.embedding_service import create_thread_embedding

        # Create embedding for the query
        query_embedding = create_thread_embedding(query)

        # Search vector database
        results = vector_db.search_threads(
            user.id, query_embedding, top_k, filter_category=filter_category
        )

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
    max_threads: Optional[int] = None,
    is_initial_indexing: bool = False,  # Flag to indicate if this is the initial indexing during onboarding
):
    """
    Index all threads for a user to enable semantic search

    This function:
    1. Fetches thread IDs from Gmail
    2. Retrieves full thread data
    3. Classifies each thread
    4. Generates embeddings
    5. Stores in Pinecone

    Args:
        user: The current user
        db: Database session
        max_threads: Optional override for max threads to index. If None, uses user's preference.
        is_initial_indexing: Whether this is the initial indexing (during onboarding) or a regular sync
    """
    try:
        # Use the user's preference if no explicit max_threads provided
        if max_threads is None:
            max_threads = user.max_emails_to_index
            print(f"Using user's preference of {max_threads} threads")

        # If this is a regular sync, we need to check which threads we already have
        # to avoid re-indexing them and to ensure we index all new threads
        existing_thread_ids = set()
        if not is_initial_indexing:
            existing_emails = db.query(Email).filter(Email.user_id == user.id).all()
            existing_thread_ids = {
                email.thread_id for email in existing_emails if email.thread_id
            }
            print(
                f"Found {len(existing_thread_ids)} existing thread IDs in the database"
            )

        # Log the indexing limit
        print(f"Indexing up to {max_threads} threads for user {user.email}")

        # If max_threads is 0, don't index anything
        if max_threads <= 0:
            return {
                "success": True,
                "message": "Email indexing is disabled for this user.",
                "indexed_count": 0,
                "total_threads": 0,
            }

        # Get Google credentials
        credentials = get_google_creds(user.id, db)

        # Create Gmail API service
        service = get_gmail_service(credentials)

        # Get list of thread IDs
        results = (
            service.users()
            .threads()
            .list(
                userId="me", maxResults=100
            )  # Always request more threads to account for filtering
            .execute()
        )
        threads = results.get("threads", [])

        print(f"Found {len(threads)} threads to potentially index")

        indexed_count = 0
        classified_count = 0

        # Check if this is a new user by seeing if they have any emails indexed already
        existing_email_count = get_email_count(user.id, db)
        is_new_user = existing_email_count == 0

        if is_new_user:
            print(
                f"New user detected. Will classify all {len(threads)} threads (max {max_threads})"
            )
        else:
            print(f"Existing user with {existing_email_count} emails already indexed")

        # Filter threads for processing
        threads_to_process = []

        if is_initial_indexing:
            # For initial indexing, limit to max_threads
            threads_to_process = threads[:max_threads]
            print(
                f"Initial indexing: Processing {len(threads_to_process)} threads (limited by max_threads={max_threads})"
            )
        else:
            # For regular sync, process all new threads
            for thread in threads:
                if thread["id"] not in existing_thread_ids:
                    threads_to_process.append(thread)
            print(f"Regular sync: Processing {len(threads_to_process)} new threads")

        # Delete all previous emails for this user if this is initial indexing
        if is_initial_indexing:
            try:
                deleted_count = (
                    db.query(Email).filter(Email.user_id == user.id).delete()
                )
                db.commit()
                print(
                    f"Deleted {deleted_count} existing emails for user {user.id} before initial indexing"
                )
            except Exception as delete_error:
                print(f"Error deleting existing emails: {str(delete_error)}")
                db.rollback()

        for thread_item in threads_to_process:
            thread_id = thread_item["id"]
            try:
                # Get thread data
                thread_data = get_thread(thread_id, user, db)

                # Always classify threads for new users
                # For existing users, classification happens if email_classifier is available
                if is_new_user or email_classifier:
                    try:
                        print(f"Classifying thread {thread_id}...")
                        classification_result = asyncio.run(
                            email_classifier.classify_email(
                                thread_data=thread_data, user=user, db=db
                            )
                        )

                        if classification_result["success"]:
                            category = classification_result["classification"]
                            thread_data["category"] = category
                            print(f"Thread {thread_id} classified as: {category}")
                            classified_count += 1
                        else:
                            print(
                                f"Failed to classify thread {thread_id}: {classification_result['message']}"
                            )
                            # Still try to get category from existing labels as fallback
                            category = get_thread_category(thread_id, user.id, db)
                            if category:
                                thread_data["category"] = category
                                print(
                                    f"Thread {thread_id} has existing category: {category}"
                                )
                    except Exception as classify_error:
                        print(
                            f"Error classifying thread {thread_id}: {str(classify_error)}"
                        )
                        # Try to get category from existing labels as fallback
                        category = get_thread_category(thread_id, user.id, db)
                        if category:
                            thread_data["category"] = category
                            print(
                                f"Thread {thread_id} has existing category: {category}"
                            )
                else:
                    # For existing users, try to get category from existing labels
                    category = get_thread_category(thread_id, user.id, db)
                    if category:
                        thread_data["category"] = category
                        print(
                            f"Using existing category for thread {thread_id}: {category}"
                        )

                # Process thread for semantic search
                enhanced_thread = process_thread_for_semantic_search(thread_data)

                # Store in vector database
                success = vector_db.upsert_thread(user.id, enhanced_thread)

                if success:
                    print(f"Successfully indexed thread {thread_id} in Pinecone")
                else:
                    print(f"Failed to index thread {thread_id} in Pinecone")

                indexed_count += 1

                # Add a delay to avoid rate limiting
                time.sleep(0.5)
            except Exception as thread_error:
                print(f"Error processing thread {thread_id}: {str(thread_error)}")
                continue

        return {
            "success": True,
            "message": f"Successfully indexed {indexed_count} threads with {classified_count} classified",
            "indexed_count": indexed_count,
            "classified_count": classified_count,
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
    # In a real implementation, this would be calculated from the data
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


def index_thread(
    thread_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Index a specific thread for semantic search

    Args:
        thread_id: The ID of the thread to index
        user: The current user
        db: Database session

    Returns:
        Success status
    """
    try:
        # Get thread data
        thread_data = get_thread(thread_id, user, db)

        # Get thread category from labels if available
        category = get_thread_category(thread_id, user.id, db)
        if category:
            thread_data["category"] = category
            print(f"Thread {thread_id} has category: {category}")

        # Process thread for semantic search
        enhanced_thread = process_thread_for_semantic_search(thread_data)

        # Store in vector database
        success = vector_db.upsert_thread(user.id, enhanced_thread)

        if success:
            print(f"Successfully indexed thread {thread_id} in Pinecone")
        else:
            print(f"Failed to index thread {thread_id} in Pinecone")

        return {"success": success, "thread_id": thread_id}
    except Exception as e:
        print(f"Error indexing thread: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error indexing thread: {str(e)}",
        )


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
    "index_thread": index_thread,
}


# EmailService class for backward compatibility with code expecting a class-based service
class EmailService:
    """
    A class-based wrapper around email service functions.
    This provides backward compatibility for code expecting an EmailService class.
    All methods directly delegate to the corresponding standalone functions.
    """

    def __init__(self):
        pass

    def get_gmail_service(self, credentials):
        return get_gmail_service(credentials)

    def build_gmail_service(self, credentials):
        return build_gmail_service(credentials)

    def list_messages(
        self,
        user=None,
        db=None,
        max_results=20,
        q=None,
        label_ids=None,
        page=1,
        use_cache=True,
        refresh_db=False,
    ):
        return list_messages(
            user, db, max_results, q, label_ids, page, use_cache, refresh_db
        )

    def get_thread(self, thread_id, user=None, db=None, store_embedding=False):
        return get_thread(thread_id, user, db, store_embedding)

    def send_email(self, email_request, user=None, db=None):
        return send_email(email_request, user, db)

    def process_email_metadata(self, message, headers, user_id, db):
        return process_email_metadata(message, headers, user_id, db)

    def search_similar_threads(
        self, query, user=None, db=None, top_k=10, filter_category=None
    ):
        return search_similar_threads(query, user, db, top_k, filter_category)

    def index_all_threads(
        self,
        user=None,
        db=None,
        max_threads=None,
        is_initial_indexing=False,
    ):
        return index_all_threads(user, db, max_threads, is_initial_indexing)

    def index_thread(self, thread_id, user=None, db=None):
        return index_thread(thread_id, user, db)
