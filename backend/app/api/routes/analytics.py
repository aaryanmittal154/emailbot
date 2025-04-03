from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from ...db.database import get_db
from ...models.user import User
from ...services.auth_service import get_current_user
from ...services.email_service import email_service
from ...services.label_service import EmailLabelService
from ...services.vector_db_service import VectorDBService

router = APIRouter()

# Create instance of label service
label_service = EmailLabelService()
vector_db_service = VectorDBService()


@router.get("/analytics/summary")
async def get_email_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a summary of email statistics including counts, top senders, and categories.
    """
    try:
        # Get total email count
        total_emails = email_service["get_email_count"](user.id, db)

        # Get unread email count
        unread_emails = email_service["get_unread_email_count"](user.id, db)

        # Get emails from last week to calculate change
        week_ago = datetime.now() - timedelta(days=7)
        emails_last_week = email_service["get_email_count_since"](user.id, week_ago, db)
        emails_two_weeks_ago = email_service["get_email_count_since"](
            user.id, week_ago - timedelta(days=7), week_ago, db
        )

        weekly_change = 0
        if emails_two_weeks_ago > 0:
            weekly_change = (
                (emails_last_week - emails_two_weeks_ago) / emails_two_weeks_ago
            ) * 100

        # Get top senders
        top_senders = email_service["get_top_senders"](user.id, 5, db)

        # Get email categories
        category_counts = label_service.get_label_category_counts(user.id, db)

        return {
            "total_emails": total_emails,
            "unread_emails": unread_emails,
            "weekly_change": round(weekly_change, 1),
            "top_senders": top_senders,
            "email_categories": category_counts,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting email summary: {str(e)}"
        )


@router.get("/analytics/weekly-digest")
async def get_weekly_digest(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Get a weekly digest of email activity.
    """
    try:
        week_ago = datetime.now() - timedelta(days=7)
        two_weeks_ago = datetime.now() - timedelta(days=14)

        # Emails received in last week
        emails_received = email_service["get_email_count_since"](user.id, week_ago, db)

        # Emails sent in last week
        emails_sent = email_service["get_sent_email_count_since"](user.id, week_ago, db)

        # Previous week's emails for comparison
        prev_week_received = email_service["get_email_count_since"](
            user.id, two_weeks_ago, week_ago, db
        )

        week_over_week_change = 0
        if prev_week_received > 0:
            week_over_week_change = (
                (emails_received - prev_week_received) / prev_week_received
            ) * 100

        # Average response time
        avg_response_time = email_service["get_average_response_time"](
            user.id, week_ago, db
        )

        # Busiest day of the week
        busiest_day = email_service["get_busiest_day"](user.id, week_ago, db)

        # Key contacts this week
        key_contacts = email_service["get_key_contacts"](user.id, week_ago, 3, db)

        return {
            "emails_received": emails_received,
            "emails_sent": emails_sent,
            "avg_response_time": avg_response_time,
            "busiest_day": busiest_day,
            "key_contacts": key_contacts,
            "week_over_week_change": round(week_over_week_change, 1),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting weekly digest: {str(e)}"
        )


@router.get("/analytics/popular-topics")
async def get_popular_topics(
    timeframe: str = Query(
        "week", description="Timeframe for topics (day, week, month)"
    ),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get popular topics from emails in the specified timeframe.
    """
    try:
        # Determine the start date based on timeframe
        start_date = datetime.now()
        if timeframe == "day":
            start_date -= timedelta(days=1)
        elif timeframe == "week":
            start_date -= timedelta(days=7)
        elif timeframe == "month":
            start_date -= timedelta(days=30)
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid timeframe. Use 'day', 'week', or 'month'",
            )

        # Get popular topics with counts and sentiment
        topics = email_service["get_popular_topics"](user.id, start_date, db)

        return topics
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting popular topics: {str(e)}"
        )


@router.get("/analytics/sentiment")
async def get_email_sentiment(
    timeframe: str = Query(
        "month", description="Timeframe for analysis (week, month, year)"
    ),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get sentiment analysis of emails in the specified timeframe.
    """
    try:
        # Determine the start date based on timeframe
        start_date = datetime.now()
        if timeframe == "week":
            start_date -= timedelta(days=7)
        elif timeframe == "month":
            start_date -= timedelta(days=30)
        elif timeframe == "year":
            start_date -= timedelta(days=365)
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid timeframe. Use 'week', 'month', or 'year'",
            )

        # Get sentiment analysis
        sentiment_data = email_service["get_sentiment_analysis"](
            user.id, start_date, db
        )

        return sentiment_data
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting sentiment analysis: {str(e)}"
        )


@router.get("/analytics/time-patterns")
async def get_time_patterns(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Get time patterns of email activity.
    """
    try:
        # Get email patterns by day of week
        day_patterns = email_service["get_email_patterns_by_day"](user.id, db)

        # Get email patterns by hour
        hour_patterns = email_service["get_email_patterns_by_hour"](user.id, db)

        # Get average response times by time of day
        response_times = email_service["get_response_times_by_time_of_day"](user.id, db)

        return {
            "days": day_patterns,
            "peak_times": hour_patterns,
            "avg_response_by_hour": response_times,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting time patterns: {str(e)}"
        )


@router.post("/search/natural-language")
async def natural_language_search(
    query: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search emails using natural language query.
    """
    try:
        # Parse the natural language query
        search_params = email_service["parse_search_query"](query)

        # Execute the search with the parsed parameters
        results = email_service["execute_smart_search"](
            user.id, search_params, page, page_size, db
        )

        return {
            "query": query,
            "parsed_params": search_params,
            "results": results,
            "count": len(results),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error performing search: {str(e)}"
        )


@router.get("/search/suggestions")
async def get_search_suggestions(
    query: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Get search suggestions based on a partial query.
    """
    try:
        # Generate search suggestions
        suggestions = email_service["generate_search_suggestions"](user.id, query, db)

        return {"query": query, "suggestions": suggestions}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting search suggestions: {str(e)}"
        )
