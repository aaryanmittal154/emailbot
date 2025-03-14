from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.auth_service import get_current_user
from app.db.database import get_db
from app.services.match_service import match_service

router = APIRouter()


@router.get("/job/{job_thread_id}/candidates", response_model=Dict[str, Any])
async def get_matching_candidates(
    job_thread_id: str,
    top_k: int = Query(3, description="Number of candidates to return"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Find candidates that match a job posting.

    This endpoint analyzes a job posting and finds the top matching candidates
    based on semantic similarity using vector embeddings.

    Parameters:
    - job_thread_id: The ID of the job posting thread
    - top_k: Number of matching candidates to return

    Returns a list of candidates ranked by relevance to the job posting.
    """
    matches = await match_service.find_matching_candidates(
        job_thread_id=job_thread_id, user=user, db=db, top_k=top_k
    )

    return matches


@router.get("/candidate/{candidate_thread_id}/jobs", response_model=Dict[str, Any])
async def get_matching_jobs(
    candidate_thread_id: str,
    top_k: int = Query(3, description="Number of jobs to return"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Find job postings that match a candidate.

    This endpoint analyzes a candidate's profile and finds the top matching job postings
    based on semantic similarity using vector embeddings.

    Parameters:
    - candidate_thread_id: The ID of the candidate thread
    - top_k: Number of matching jobs to return

    Returns a list of job postings ranked by relevance to the candidate.
    """
    matches = await match_service.find_matching_jobs(
        candidate_thread_id=candidate_thread_id, user=user, db=db, top_k=top_k
    )

    return matches


@router.get("/history/{thread_id}", response_model=List[Dict[str, Any]])
async def get_match_history(
    thread_id: str,
    match_type: str = Query(
        ..., description="Match type: 'job_to_candidate' or 'candidate_to_job'"
    ),
    limit: int = Query(10, description="Maximum number of matches to return"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the match history for a job posting or candidate.

    This endpoint retrieves previous matches that have been generated for a specific job posting or candidate.

    Parameters:
    - thread_id: The ID of the thread
    - match_type: The type of match to retrieve ('job_to_candidate' or 'candidate_to_job')
    - limit: Maximum number of matches to return

    Returns a list of previous matches ordered by recency.
    """
    if match_type not in ["job_to_candidate", "candidate_to_job"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid match type. Must be either 'job_to_candidate' or 'candidate_to_job'",
        )

    matches = await match_service.get_previous_matches(
        thread_id=thread_id, match_type=match_type, user=user, db=db, limit=limit
    )

    return matches
