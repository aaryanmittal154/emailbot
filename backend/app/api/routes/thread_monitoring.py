from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import logging

from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.thread_monitoring_service import ThreadMonitoringService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/thread-monitoring", tags=["thread-monitoring"])


@router.post("/check-updates", response_model=Dict[str, Any])
async def check_thread_updates(
    background_tasks: BackgroundTasks,
    max_results: Optional[int] = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check monitored threads for updates and store them in the vector database.
    This endpoint launches the check process in the background and returns immediately.
    """
    # Schedule the task to run in the background
    background_tasks.add_task(
        ThreadMonitoringService.check_for_thread_updates,
        user=user,
        db=db,
        max_results=max_results,
    )

    return {
        "success": True,
        "message": f"Started background task to check for thread updates (max: {max_results})",
    }


@router.post("/check-updates-sync", response_model=Dict[str, Any])
async def check_thread_updates_sync(
    max_results: Optional[int] = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check monitored threads for updates and store them in the vector database synchronously.
    This endpoint processes the threads and waits for completion before returning.
    """
    # Process thread updates synchronously
    result = await ThreadMonitoringService.check_for_thread_updates(
        user=user,
        db=db,
        max_results=max_results,
    )

    return result


@router.get("/list-monitored", response_model=Dict[str, Any])
async def list_monitored_threads(
    user: User = Depends(get_current_user),
):
    """
    List all thread IDs currently being monitored for this user
    """
    # Filter monitored threads for this user
    user_threads = [
        thread_id.split(":", 1)[1]
        for thread_id in ThreadMonitoringService.monitored_threads
        if thread_id.startswith(f"{user.id}:")
    ]

    return {"success": True, "thread_count": len(user_threads), "threads": user_threads}
