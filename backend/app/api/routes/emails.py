from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import or_

from app.db.database import get_db
from app.models.user import User
from app.models.email import EmailMetadata
from app.models.email_label import ThreadLabel
from app.schemas.email import (
    EmailResponse,
    ThreadResponse,
    SendEmailRequest,
    SendEmailResponse,
)
from app.services.email_service import email_service, get_gmail_service
from app.services.auth_service import get_current_user, get_google_creds

# Set up logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emails", tags=["Emails"])


@router.get("/", response_model=List[dict])
async def list_messages(
    q: Optional[str] = None,
    label_ids: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    include_full_content: bool = False,
    refresh_db: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List Gmail messages for a user with pagination

    - q: Optional search query
    - label_ids: Optional comma-separated list of label IDs
    - page: Page number (starting from 1)
    - page_size: Number of results per page
    - include_full_content: Whether to include full email content
    - refresh_db: If true, only fetch data from database (no Gmail API calls)
    """
    print(
        f"List messages request: q={q}, label_ids={label_ids}, page={page}, page_size={page_size}, refresh_db={refresh_db}"
    )

    # Return empty list for users who haven't completed onboarding
    if (
        not user.is_onboarded and not include_full_content
    ):  # Allow fetching during onboarding if explicitly requested
        print(f"User {user.email} has not completed onboarding yet")
        return []

    try:
        # Parse label_ids if provided
        label_list = None
        if label_ids:
            label_list = label_ids.split(",")

        # Call the email service to list messages
        emails = email_service["list_messages"](
            user=user,
            db=db,
            max_results=page_size,
            q=q,
            label_ids=label_list,
            page=page,
            refresh_db=refresh_db,
        )

        # If full content is specifically requested, ensure it's included
        if include_full_content:
            # Add the full_content field to each email if not already included
            for email in emails:
                if "full_content" not in email or not email["full_content"]:
                    # Fetch from database if not included
                    db_email = (
                        db.query(Email)
                        .filter(
                            Email.gmail_id == email["gmail_id"],
                            Email.user_id == user.id,
                        )
                        .first()
                    )
                    if db_email and db_email.full_content:
                        email["full_content"] = db_email.full_content

        return emails
    except Exception as e:
        print(f"Error listing messages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing messages: {str(e)}",
        )


@router.get("/thread/{thread_id}", response_model=Dict[str, Any])
async def get_email_thread(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a complete email thread by thread ID

    - **thread_id**: The Gmail thread ID

    Returns the full thread with all messages in chronological order
    """
    return email_service["get_thread"](thread_id=thread_id, user=current_user, db=db)


@router.post("/sync", response_model=Dict[str, Any])
async def sync_emails(
    background_tasks: BackgroundTasks,
    max_results: int = 500,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sync emails from Gmail in the background

    This endpoint will trigger a background job to sync new emails
    from Gmail and store their metadata in the database for faster access.
    It will preserve all previously indexed emails while adding new ones.

    - **max_results**: Maximum number of new emails to check for syncing (default: 500)
    """
    # Add a background task to sync emails using index_all_threads
    # With is_initial_indexing=False, this will only index new emails
    # without affecting the previously indexed ones
    background_tasks.add_task(
        email_service["index_all_threads"],
        user=current_user,
        db=db,
        max_threads=max_results,
        is_initial_indexing=False,  # Not initial indexing, so it will index new emails without limits
    )

    return {
        "status": "Sync started",
        "message": f"Syncing new emails in the background (checking up to {max_results} threads)",
    }


@router.post("/send", response_model=SendEmailResponse)
async def send_email(
    email_request: SendEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send an email via Gmail

    - **to**: List of recipient email addresses
    - **subject**: Email subject
    - **body**: Email body (HTML supported)
    - **cc**: List of CC recipients (optional)
    - **bcc**: List of BCC recipients (optional)
    """
    return email_service["send_email"](
        email_request=email_request, user=current_user, db=db
    )


@router.post("/semantic-index", response_model=Dict[str, Any])
async def index_all_threads_for_search(
    background_tasks: BackgroundTasks,
    max_threads: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Index all email threads for semantic search and categorize them

    This endpoint:
    1. Fetches up to 20 threads for the user (testing limit)
    2. Classifies each thread into categories (Job Posting, Candidate, Event)
    3. Processes them for semantic search
    4. Stores their embeddings in the vector database

    Note: Currently limited to 20 emails in the testing phase.
    """
    # Start indexing in background to avoid timeout
    background_tasks.add_task(
        email_service["index_all_threads"], user=user, db=db, max_threads=max_threads
    )

    return {
        "success": True,
        "message": "Started indexing and categorizing up to 20 threads in the background. This process includes automatic classification of each thread.",
    }


@router.get("/search", response_model=Dict[str, Any])
async def search_emails(
    q: str,
    top_k: int = 10,
    filter_category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Search for emails using semantic search

    Args:
        q: The search query
        top_k: Number of results to return
        filter_category: Optional category filter (e.g., "Job Posting" or "Candidate")
        db: Database session
        user: The current user

    Returns:
        Search results
    """
    try:
        results = email_service["search_similar_threads"](
            query=q, user=user, top_k=top_k, filter_category=filter_category
        )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching emails: {str(e)}",
        )


# When viewing a thread, automatically index it for semantic search
@router.get("/emails/thread/{thread_id}", response_model=Dict[str, Any])
async def get_email_thread(
    thread_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    """Get a complete email thread by thread_id"""
    thread = email_service["get_thread"](thread_id, user)

    # Index the thread for semantic search in the background
    background_tasks.add_task(
        email_service["get_thread"],
        thread_id=thread_id,
        user=user,
        store_embedding=True,
    )

    return thread


@router.get("/labeled/{label_name}", response_model=List[Dict[str, Any]])
async def get_emails_by_label(
    label_name: str,
    page: int = 1,
    max_results: int = 20,
    refresh_db: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get emails with a specific label

    Args:
        label_name: The name of the label (e.g., "Job Posting" or "Candidate")
        page: Page number for pagination
        max_results: Maximum number of results to return per page
        refresh_db: If true, only fetch data from database (no Gmail API calls)
        db: Database session
        user: The current user

    Returns:
        List of emails with the specified label
    """
    # Check if user is onboarded before processing
    if not user.is_onboarded:
        # Return empty list for users who haven't completed onboarding
        return []

    try:
        # Find thread_ids that have this label
        thread_labels = (
            db.query(ThreadLabel)
            .join(ThreadLabel.label)
            .filter(
                ThreadLabel.user_id == user.id, ThreadLabel.label.has(name=label_name)
            )
            .all()
        )

        thread_ids = [tl.thread_id for tl in thread_labels]

        if not thread_ids:
            return []

        # Get emails for these threads
        emails = []

        if refresh_db:
            logger.info(
                f"Refreshing {label_name} emails from database for user {user.id}"
            )

            # Get all matching emails first so we can sort by date
            matching_emails = []
            for thread_id in thread_ids:
                # Query the latest email for each thread
                latest_email = (
                    db.query(EmailMetadata)
                    .filter(
                        EmailMetadata.user_id == user.id,
                        EmailMetadata.thread_id == thread_id,
                    )
                    .order_by(EmailMetadata.date.desc())
                    .first()
                )

                if latest_email:
                    matching_emails.append(latest_email)

            # Sort all emails by date (newest first)
            matching_emails.sort(
                key=lambda x: x.date if x.date else datetime.min, reverse=True
            )

            # Apply pagination
            page_emails = matching_emails[(page - 1) * max_results : page * max_results]

            # Create the thread data for each email
            for email in page_emails:
                try:
                    thread_data = {
                        "thread_id": email.thread_id,
                        "subject": email.subject,
                        "participants": [email.sender],
                        "message_count": 1,  # Simplified
                        "last_updated": email.date.isoformat() if email.date else None,
                        # Include the latest message details
                        "latest_message": {
                            "id": email.gmail_id,
                            "sender": email.sender,
                            "snippet": email.snippet,
                            "date": email.date.isoformat() if email.date else None,
                            "is_read": email.is_read,
                        },
                    }
                    emails.append(thread_data)
                except Exception as e:
                    logger.warning(f"Error processing email {email.gmail_id}: {str(e)}")
                    continue
        else:
            # Use the original implementation with Gmail API
            for thread_id in thread_ids[(page - 1) * max_results : page * max_results]:
                try:
                    # Get thread data
                    thread = email_service["get_thread"](
                        thread_id=thread_id, user=user, db=db
                    )

                    # If it's a job posting, attempt to get the classification data
                    classification_data = None
                    if label_name == "Job Posting":
                        try:
                            # Try to get classification data
                            from app.services.email_classifier_service import (
                                email_classifier,
                            )

                            classification_result = (
                                await email_classifier.classify_email(
                                    thread_data=thread, user=user, db=db
                                )
                            )
                            if classification_result["success"]:
                                classification_data = classification_result
                        except Exception as classify_error:
                            logger.warning(
                                f"Error classifying thread {thread_id}: {str(classify_error)}"
                            )

                    # If successful, add to the list
                    if thread:
                        thread_data = {
                            "thread_id": thread["thread_id"],
                            "subject": thread["subject"],
                            "participants": thread["participants"],
                            "message_count": thread["message_count"],
                            "last_updated": thread["last_updated"],
                            # Include the latest message details for display
                            "latest_message": (
                                thread["messages"][-1] if thread["messages"] else {}
                            ),
                        }

                        # Add classification data if available
                        if classification_data:
                            thread_data["classification_data"] = classification_data

                        emails.append(thread_data)
                except Exception as e:
                    logger.warning(f"Error getting thread {thread_id}: {str(e)}")
                    continue

            # Sort the emails by last_updated (newest first)
            emails.sort(key=lambda x: x.get("last_updated", ""), reverse=True)

        return emails

    except Exception as e:
        logger.error(f"Error getting emails by label: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting labeled emails: {str(e)}",
        )


@router.get("/similar", response_model=Dict[str, Any])
async def get_similar_threads(
    thread_id: str,
    target_label: str,
    top_k: int = 5,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get threads similar to the specified thread, filtered by the target label.

    This endpoint finds semantically similar threads that have a specific label.
    For example, given a job posting, find similar candidates, or given a candidate,
    find similar job postings.

    Parameters:
    - thread_id: The ID of the thread to find similar threads for
    - target_label: The label to filter results by (e.g., "Job Posting", "Candidate")
    - top_k: Number of similar threads to return

    Returns a ranked list of similar threads with relevance scores.
    """
    try:
        # Get the thread data
        thread = email_service["get_thread"](thread_id=thread_id, user=user, db=db)

        if not thread:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Thread {thread_id} not found",
            )

        # Get text content from thread messages to create an embedding
        thread_text = ""
        for message in thread.get("messages", []):
            message_content = message.get("body", message.get("snippet", ""))
            thread_text += f"{message_content}\n\n"

        # Generate embedding for the thread
        from app.services.embedding_service import create_thread_embedding

        thread_embedding = create_thread_embedding(thread_text)

        # Find threads with the target label
        target_threads = (
            db.query(ThreadLabel)
            .join(ThreadLabel.label)
            .filter(
                ThreadLabel.user_id == user.id, ThreadLabel.label.has(name=target_label)
            )
            .all()
        )

        target_thread_ids = [tl.thread_id for tl in target_threads]

        if not target_thread_ids:
            return {"thread_id": thread_id, "similar_threads": [], "count": 0}

        # Search similar threads in vector database, filtered by target label
        from app.services.vector_db_service import vector_db

        results = vector_db.search_threads(
            user.id, thread_embedding, top_k * 3
        )  # Fetch more to ensure we have enough after filtering

        # Filter results to only include threads with the target label
        filtered_results = []
        for result in results:
            if result["thread_id"] in target_thread_ids:
                filtered_results.append(result)
                if len(filtered_results) >= top_k:
                    break

        # For each result, add classification data
        for result in filtered_results:
            try:
                # Try to get classification data
                from app.services.email_classifier_service import email_classifier

                # Get complete thread data for classification
                thread_data = email_service["get_thread"](
                    thread_id=result["thread_id"], user=user, db=db
                )

                classification_result = await email_classifier.classify_email(
                    thread_data=thread_data, user=user, db=db
                )

                if classification_result["success"]:
                    result["classification_data"] = classification_result
            except Exception as classify_error:
                logger.warning(
                    f"Error classifying result thread {result['thread_id']}: {str(classify_error)}"
                )

        return {
            "thread_id": thread_id,
            "similar_threads": filtered_results,
            "count": len(filtered_results),
        }

    except Exception as e:
        logger.error(f"Error finding similar threads: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error finding similar threads: {str(e)}",
        )


@router.get("/new", response_model=Dict[str, Any])
async def get_new_emails(
    last_checked_timestamp: Optional[str] = None,
    max_results: int = 20,
    use_gmail_query: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetch only new emails that have arrived since the provided timestamp or using Gmail query

    - **last_checked_timestamp**: ISO format timestamp (e.g., '2023-03-17T12:30:45Z')
    - **max_results**: Maximum number of results to return
    - **use_gmail_query**: Use Gmail's query syntax for finding emails instead of a timestamp
    """
    try:
        # Get credentials and build service
        creds = get_google_creds(current_user.id, db)
        service = get_gmail_service(creds)

        # Decide which method to use for querying
        if use_gmail_query:
            # Use the same query that the auto-reply service uses, which has proven to work
            gmail_query = "is:unread newer_than:1h"
            logger.info(f"Using Gmail query: {gmail_query}")
        else:
            # Use the timestamp-based approach
            if not last_checked_timestamp:
                one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
                last_checked_timestamp = one_hour_ago.isoformat()

            # Convert timestamp to Gmail query format
            dt = datetime.fromisoformat(last_checked_timestamp.replace("Z", "+00:00"))
            # Gmail uses 'after:YYYY/MM/DD' format
            date_str = dt.strftime("%Y/%m/%d")
            gmail_query = f"after:{date_str}"
            logger.info(f"Using timestamp-based Gmail query: {gmail_query}")

        # Fetch messages matching the query
        response = (
            service.users()
            .messages()
            .list(userId="me", q=gmail_query, maxResults=max_results)
            .execute()
        )

        messages = response.get("messages", [])
        logger.info(f"Found {len(messages)} messages matching query: {gmail_query}")

        if not messages:
            return {
                "count": 0,
                "emails": [],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        # Get unique thread IDs to avoid duplication
        thread_ids = set()
        for message in messages:
            thread_ids.add(message["threadId"])

        logger.info(f"Processing {len(thread_ids)} unique threads")

        # Fetch full details for each thread
        emails = []
        for thread_id in thread_ids:
            try:
                # Use the existing get_thread function - with correct dictionary access
                thread_data = email_service["get_thread"](thread_id, current_user, db)
                if thread_data:
                    emails.append(thread_data)
            except Exception as thread_error:
                logger.error(
                    f"Error processing thread {thread_id}: {str(thread_error)}"
                )
                # Continue with other threads

        logger.info(f"Successfully retrieved {len(emails)} threads")

        # Return count and emails data
        return {
            "count": len(emails),
            "emails": emails,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching new emails: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch new emails: {str(e)}",
        )
