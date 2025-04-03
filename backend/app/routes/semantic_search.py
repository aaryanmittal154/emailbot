from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from app.services.vector_store import VectorStore
from app.models.email import Email
from app.services.email_service import EmailService
from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

# Create FastAPI router
router = APIRouter(prefix="/api/emails")
vector_store = VectorStore()
email_service = EmailService()


# Define request models
class SemanticSearchRequest(BaseModel):
    query: str
    include_categories: List[str] = []
    exclude_categories: List[str] = []
    exclude_thread_ids: List[str] = []
    limit: int = 10
    timestamp: Optional[int] = None


@router.post("/semantic-search-multi")
async def semantic_search_multi(
    request: SemanticSearchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enhanced semantic search endpoint that supports cross-category search

    Request body:
    {
        "query": "string",  # The search query text
        "include_categories": ["string"],  # Categories to include (empty = all)
        "exclude_categories": ["string"],  # Categories to exclude
        "exclude_thread_ids": ["string"],  # Thread IDs to exclude
        "limit": int,  # Maximum number of results
        "timestamp": int  # Optional timestamp for cache-busting
    }
    """
    # Extract request data
    query = request.query
    include_categories = request.include_categories
    exclude_categories = request.exclude_categories
    exclude_thread_ids = request.exclude_thread_ids
    limit = request.limit

    try:
        # Search for matching email threads
        results = vector_store.search_vectors(
            query_text=query,
            include_labels=include_categories,
            exclude_labels=exclude_categories,
            exclude_thread_ids=exclude_thread_ids,
            limit=limit,
        )

        # Format results for frontend
        formatted_results = [format_search_result(result) for result in results]

        return {
            "results": formatted_results,
            "query": query,
            "count": len(formatted_results),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error during semantic search: {str(e)}"
        )


@router.get("/similar-threads-multi")
async def similar_threads_multi(
    thread_id: str = Query(
        ..., description="The thread ID to find similar threads for"
    ),
    include_categories: str = Query(
        "", description="Comma-separated list of categories to include"
    ),
    exclude_categories: str = Query(
        "", description="Comma-separated list of categories to exclude"
    ),
    top_k: int = Query(5, description="Number of similar threads to return"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get threads similar to a specific thread across multiple categories

    Query parameters:
    - thread_id: The ID of the thread to find similar threads for
    - include_categories: Comma-separated list of category labels to include
    - exclude_categories: Comma-separated list of category labels to exclude
    - top_k: Number of similar threads to return
    """
    try:
        # Get the source thread
        thread = email_service.get_thread(thread_id, user=user, db=db)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        # Generate query text from the thread
        query_text = generate_query_text(thread)

        # Parse category filters
        include_list = (
            [cat.strip() for cat in include_categories.split(",")]
            if include_categories
            else []
        )
        exclude_list = (
            [cat.strip() for cat in exclude_categories.split(",")]
            if exclude_categories
            else []
        )

        # Remove empty strings
        include_list = [cat for cat in include_list if cat]
        exclude_list = [cat for cat in exclude_list if cat]

        # Search for similar threads
        results = vector_store.search_vectors(
            query_text=query_text,
            include_labels=include_list,
            exclude_labels=exclude_list,
            exclude_thread_ids=[thread_id],  # Exclude the source thread
            limit=top_k,
        )

        # Format results for frontend
        formatted_results = [format_search_result(result) for result in results]

        return {
            "results": formatted_results,
            "source_thread_id": thread_id,
            "count": len(formatted_results),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error finding similar threads: {str(e)}"
        )


class EmailCheckRequest(BaseModel):
    max_results: int = 5
    use_html: bool = True
    use_cross_category: bool = True
    timestamp: Optional[int] = None


@router.post("/check-new-emails-enhanced")
async def check_new_emails_enhanced(
    request: EmailCheckRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check for new emails and generate auto-replies with enhanced cross-category context

    Request body:
    {
        "max_results": int,  # Maximum number of emails to process
        "use_html": bool,  # Whether to use HTML formatting in replies
        "use_cross_category": bool,  # Whether to use cross-category context
        "timestamp": int  # Optional timestamp for cache-busting
    }
    """
    # Extract request data
    max_results = request.max_results
    use_html = request.use_html
    use_cross_category = request.use_cross_category

    try:
        # Get recent unreplied emails
        unreplied_threads = email_service.get_unreplied_emails(
            user=user, db=db, max_results=max_results
        )

        # Process each thread
        results = []
        for thread in unreplied_threads:
            thread_id = thread.get("thread_id")

            # Determine thread category
            category = thread.get("category", "")
            if not category:
                # If no category, try to extract it from labels or content
                category = "General"  # Default category

            # Generate context from similar threads
            context = generate_context_for_email(
                thread_id=thread_id,
                primary_category=category,
                use_cross_category=use_cross_category,
            )

            # Add to results
            results.append(
                {
                    "thread_id": thread_id,
                    "thread": thread,
                    "category": category,
                    "context": context,
                }
            )

        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error checking new emails: {str(e)}"
        )


# Helper functions


def generate_query_text(thread: Dict[str, Any]) -> str:
    """Generate a query text from an email thread"""
    # Start with subject as it's most important
    query_text = thread.get("subject", "")

    # Add the most recent message content (usually most relevant for context)
    messages = thread.get("messages", [])
    if messages:
        latest_message = messages[-1]
        query_text += " " + latest_message.get("snippet", "")

    return query_text


def format_search_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Format a search result for the frontend"""
    return {
        "thread_id": result.get("thread_id", ""),
        "subject": result.get("subject", "(No Subject)"),
        "snippet": result.get("snippet", ""),
        "date": result.get("date", ""),
        "sender": result.get("sender", ""),
        "category": result.get("category", ""),
        "score": result.get("score", 0),
        "labels": result.get("labels", []),
    }


def generate_context_for_email(
    thread_id: str, primary_category: str, use_cross_category: bool = True
) -> Dict[str, Any]:
    """Generate context for an email based on its category"""
    # Default context structure
    context = {
        "primary_category": primary_category,
        "primary_matches": [],
        "cross_category_matches": [],
    }

    try:
        # Get the source thread
        thread = email_service.get_thread(thread_id)
        if not thread:
            return context

        # Generate query text from the thread
        query_text = generate_query_text(thread)

        # Find matches within the same category
        primary_results = vector_store.search_vectors(
            query_text=query_text,
            include_labels=[primary_category],
            exclude_thread_ids=[thread_id],
            limit=3,
        )
        context["primary_matches"] = [format_search_result(r) for r in primary_results]

        # If cross-category search is enabled, find relevant threads in other categories
        if use_cross_category:
            cross_results = vector_store.search_vectors(
                query_text=query_text,
                exclude_labels=[primary_category],
                exclude_thread_ids=[thread_id],
                limit=3,
            )
            context["cross_category_matches"] = [
                format_search_result(r) for r in cross_results
            ]

        return context
    except Exception as e:
        print(f"Error generating context: {str(e)}")
        return context
