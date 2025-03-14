import os
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status

from app.models.user import User
from app.models.match import JobCandidateMatch
from app.services.vector_db_service import vector_db
from app.services.embedding_service import create_thread_embedding
from app.services.auth_service import get_current_user
from app.db.database import get_db
from app.services.email_service import get_thread


class MatchService:
    """Service for matching job postings with candidates and vice versa"""

    @staticmethod
    async def find_matching_candidates(
        job_thread_id: str,
        user: User,
        db: Session,
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """
        Find candidates that match a job posting

        Args:
            job_thread_id: The thread ID of the job posting email
            user: The current user
            db: Database session
            top_k: Number of candidates to return

        Returns:
            Dictionary with match results
        """
        try:
            # Get the job posting thread data
            job_thread = get_thread(thread_id=job_thread_id, user=user, db=db)

            if not job_thread:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Job thread {job_thread_id} not found",
                )

            # Extract job details to use for matching
            job_text = ""
            for message in job_thread.get("messages", []):
                message_content = message.get("body", message.get("snippet", ""))
                job_text += f"{message_content}\n\n"

            # Generate embedding for the job posting
            job_embedding = create_thread_embedding(job_text)

            # Find threads with the "Candidate" label
            from app.models.email_label import ThreadLabel, EmailLabel

            candidate_label = (
                db.query(EmailLabel).filter(EmailLabel.name == "Candidate").first()
            )

            if not candidate_label:
                return {
                    "job_thread_id": job_thread_id,
                    "candidates": [],
                    "count": 0,
                    "message": "No candidate label found",
                }

            # Get all threads with the candidate label
            candidate_threads = (
                db.query(ThreadLabel)
                .filter(
                    ThreadLabel.user_id == user.id,
                    ThreadLabel.label_id == candidate_label.id,
                )
                .all()
            )

            candidate_thread_ids = [
                thread_label.thread_id for thread_label in candidate_threads
            ]

            if not candidate_thread_ids:
                return {
                    "job_thread_id": job_thread_id,
                    "candidates": [],
                    "count": 0,
                    "message": "No candidates found",
                }

            # Search for similar threads in vector database
            results = vector_db.search_threads(
                user.id, job_embedding, min(top_k * 3, len(candidate_thread_ids))
            )

            # Filter results to only include candidate threads
            matching_candidates = []
            for result in results:
                if result["thread_id"] in candidate_thread_ids:
                    # Get detailed data for this candidate
                    candidate_thread = get_thread(
                        thread_id=result["thread_id"], user=user, db=db
                    )

                    # Store match in database
                    match_record = JobCandidateMatch(
                        user_id=user.id,
                        job_thread_id=job_thread_id,
                        candidate_thread_id=result["thread_id"],
                        similarity_score=result["score"],
                        matched_at=datetime.utcnow(),
                        match_type="job_to_candidate",
                    )
                    db.add(match_record)

                    # Add to results
                    matching_candidates.append(
                        {
                            "thread_id": result["thread_id"],
                            "subject": result["subject"],
                            "participants": result["participants"],
                            "message_count": result["message_count"],
                            "last_updated": result["last_updated"],
                            "similarity_score": result["score"],
                            "candidate_thread": candidate_thread,
                        }
                    )

                    if len(matching_candidates) >= top_k:
                        break

            # Commit changes to database
            db.commit()

            return {
                "job_thread_id": job_thread_id,
                "job_title": job_thread.get("subject", "No Subject"),
                "candidates": matching_candidates,
                "count": len(matching_candidates),
            }

        except Exception as e:
            db.rollback()
            print(f"Error finding matching candidates: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error finding matching candidates: {str(e)}",
            )

    @staticmethod
    async def find_matching_jobs(
        candidate_thread_id: str,
        user: User,
        db: Session,
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """
        Find job postings that match a candidate

        Args:
            candidate_thread_id: The thread ID of the candidate email
            user: The current user
            db: Database session
            top_k: Number of jobs to return

        Returns:
            Dictionary with match results
        """
        try:
            # Get the candidate thread data
            candidate_thread = get_thread(
                thread_id=candidate_thread_id, user=user, db=db
            )

            if not candidate_thread:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Candidate thread {candidate_thread_id} not found",
                )

            # Extract candidate details to use for matching
            candidate_text = ""
            for message in candidate_thread.get("messages", []):
                message_content = message.get("body", message.get("snippet", ""))
                candidate_text += f"{message_content}\n\n"

            # Generate embedding for the candidate
            candidate_embedding = create_thread_embedding(candidate_text)

            # Find threads with the "Job Posting" label
            from app.models.email_label import ThreadLabel, EmailLabel

            job_label = (
                db.query(EmailLabel).filter(EmailLabel.name == "Job Posting").first()
            )

            if not job_label:
                return {
                    "candidate_thread_id": candidate_thread_id,
                    "jobs": [],
                    "count": 0,
                    "message": "No job posting label found",
                }

            # Get all threads with the job posting label
            job_threads = (
                db.query(ThreadLabel)
                .filter(
                    ThreadLabel.user_id == user.id, ThreadLabel.label_id == job_label.id
                )
                .all()
            )

            job_thread_ids = [thread_label.thread_id for thread_label in job_threads]

            if not job_thread_ids:
                return {
                    "candidate_thread_id": candidate_thread_id,
                    "jobs": [],
                    "count": 0,
                    "message": "No job postings found",
                }

            # Search for similar threads in vector database
            results = vector_db.search_threads(
                user.id, candidate_embedding, min(top_k * 3, len(job_thread_ids))
            )

            # Filter results to only include job posting threads
            matching_jobs = []
            for result in results:
                if result["thread_id"] in job_thread_ids:
                    # Get detailed data for this job
                    job_thread = get_thread(
                        thread_id=result["thread_id"], user=user, db=db
                    )

                    # Store match in database
                    match_record = JobCandidateMatch(
                        user_id=user.id,
                        job_thread_id=result["thread_id"],
                        candidate_thread_id=candidate_thread_id,
                        similarity_score=result["score"],
                        matched_at=datetime.utcnow(),
                        match_type="candidate_to_job",
                    )
                    db.add(match_record)

                    # Add to results
                    matching_jobs.append(
                        {
                            "thread_id": result["thread_id"],
                            "subject": result["subject"],
                            "participants": result["participants"],
                            "message_count": result["message_count"],
                            "last_updated": result["last_updated"],
                            "similarity_score": result["score"],
                            "job_thread": job_thread,
                        }
                    )

                    if len(matching_jobs) >= top_k:
                        break

            # Commit changes to database
            db.commit()

            return {
                "candidate_thread_id": candidate_thread_id,
                "candidate_name": candidate_thread.get("subject", "No Subject"),
                "jobs": matching_jobs,
                "count": len(matching_jobs),
            }

        except Exception as e:
            db.rollback()
            print(f"Error finding matching jobs: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error finding matching jobs: {str(e)}",
            )

    @staticmethod
    async def get_previous_matches(
        thread_id: str, match_type: str, user: User, db: Session, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get previous matches for a thread

        Args:
            thread_id: The thread ID to get matches for
            match_type: Either 'job_to_candidate' or 'candidate_to_job'
            user: The current user
            db: Database session
            limit: Maximum number of matches to return

        Returns:
            List of previous matches
        """
        try:
            query = db.query(JobCandidateMatch).filter(
                JobCandidateMatch.user_id == user.id,
                JobCandidateMatch.match_type == match_type,
            )

            if match_type == "job_to_candidate":
                query = query.filter(JobCandidateMatch.job_thread_id == thread_id)
            else:
                query = query.filter(JobCandidateMatch.candidate_thread_id == thread_id)

            # Get the most recent matches
            matches = (
                query.order_by(JobCandidateMatch.matched_at.desc()).limit(limit).all()
            )

            # Format the results
            results = []
            for match in matches:
                if match_type == "job_to_candidate":
                    # Get candidate thread details
                    candidate_thread = get_thread(
                        thread_id=match.candidate_thread_id, user=user, db=db
                    )

                    results.append(
                        {
                            "match_id": match.id,
                            "candidate_thread_id": match.candidate_thread_id,
                            "similarity_score": match.similarity_score,
                            "matched_at": match.matched_at.isoformat(),
                            "candidate_thread": candidate_thread,
                        }
                    )
                else:
                    # Get job thread details
                    job_thread = get_thread(
                        thread_id=match.job_thread_id, user=user, db=db
                    )

                    results.append(
                        {
                            "match_id": match.id,
                            "job_thread_id": match.job_thread_id,
                            "similarity_score": match.similarity_score,
                            "matched_at": match.matched_at.isoformat(),
                            "job_thread": job_thread,
                        }
                    )

            return results

        except Exception as e:
            print(f"Error getting previous matches: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error getting previous matches: {str(e)}",
            )


# Create a singleton instance
match_service = MatchService()
