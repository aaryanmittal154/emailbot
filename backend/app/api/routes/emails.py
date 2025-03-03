from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging

from app.db.database import get_db
from app.models.user import User
from app.models.email_label import ThreadLabel
from app.schemas.email import (
    EmailResponse,
    ThreadResponse,
    SendEmailRequest,
    SendEmailResponse,
)
from app.services.email_service import email_service
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/emails", tags=["Emails"])


@router.get("/", response_model=List[Dict[str, Any]])
async def list_emails(
    q: Optional[str] = None,
    label_ids: Optional[List[str]] = Query(None),
    max_results: int = 20,
    page: int = 1,
    use_cache: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List emails from Gmail with pagination

    - **q**: Search query (same as Gmail search)
    - **label_ids**: List of Gmail label IDs to filter by
    - **max_results**: Maximum number of results per page
    - **page**: Page number (1-indexed)
    - **use_cache**: Whether to use cached data (set to false to force refresh)
    """
    return email_service["list_messages"](
        user=current_user,
        db=db,
        max_results=max_results,
        q=q,
        label_ids=label_ids,
        page=page,
        use_cache=use_cache,
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

    This endpoint will trigger a background job to sync up to max_results emails
    from Gmail and store their metadata in the database for faster access.

    - **max_results**: Maximum number of emails to sync (default: 500)
    """
    # Add a background task to sync emails
    background_tasks.add_task(
        email_service["list_messages"],
        user=current_user,
        db=db,
        max_results=max_results,
        use_cache=False,  # Force refresh from Gmail API
    )

    return {
        "status": "Sync started",
        "message": f"Syncing up to {max_results} emails in the background",
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
    max_threads: int = Query(100, description="Maximum number of threads to index"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Index all email threads for semantic search.

    This endpoint will:
    1. Fetch threads from Gmail
    2. Process them for semantic search
    3. Generate embeddings
    4. Store them in the vector database

    The process runs in the background to avoid timeouts.
    """
    # Run the indexing process in the background
    background_tasks.add_task(
        email_service["index_all_threads"], user=user, db=db, max_threads=max_threads
    )

    return {
        "success": True,
        "message": f"Indexing up to {max_threads} threads in the background. This may take several minutes.",
    }


@router.get("/semantic-search", response_model=Dict[str, Any])
async def search_threads_by_semantics(
    q: str = Query(..., description="Search query text"),
    top_k: int = Query(10, description="Number of results to return"),
    user: User = Depends(get_current_user),
):
    """
    Search for similar email threads using semantic search.

    This endpoint provides fuzzy semantic search across email threads, finding conceptually
    similar content even when keywords don't match exactly. The search is powered by
    OpenAI embeddings and Pinecone vector database.

    Parameters:
    - q: The search query text (e.g., "meeting tomorrow" or "project deadline")
    - top_k: Number of relevant results to return

    Returns a ranked list of similar threads with relevance scores and their full content.
    """
    results = email_service["search_similar_threads"](query=q, user=user, top_k=top_k)

    return results


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
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get emails that have been labeled with a specific label
    """
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

                        classification_result = await email_classifier.classify_email(
                            thread_data=thread, user=user, db=db
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
