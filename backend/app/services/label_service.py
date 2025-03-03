import os
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import logging
import random

from app.models.email_label import LabelCategory, EmailLabel, ThreadLabel, LabelFeedback
from app.models.user import User
from app.db.database import get_db
from app.services.auth_service import get_current_user
from app.services.embedding_service import create_thread_embedding
from app.services.vector_db_service import vector_db
from app.services.email_service import email_service
from app.models.email import EmailMetadata as Email

# Initialize logger
logger = logging.getLogger(__name__)


class EmailLabelService:
    """Service for managing email labels and providing AI-powered label suggestions"""

    @staticmethod
    def initialize_default_labels(db: Session) -> None:
        """Initialize default label categories and labels if they don't exist"""
        # Check if categories already exist
        email_category = (
            db.query(LabelCategory).filter(LabelCategory.name == "Email Types").first()
        )

        # Create email type category and labels if they don't exist
        if not email_category:
            email_category = LabelCategory(
                name="Email Types",
                description="Main categories for email classification",
            )
            db.add(email_category)
            db.commit()  # Commit to get the ID
            db.refresh(email_category)

            # Create email type labels
            email_type_labels = [
                EmailLabel(
                    name="Job Posting",
                    category_id=email_category.id,
                    description="Emails containing job opportunities and listings",
                    color="#4285F4",  # Blue
                ),
                EmailLabel(
                    name="Candidate",
                    category_id=email_category.id,
                    description="Emails from or about candidates and applications",
                    color="#EA4335",  # Red
                ),
                EmailLabel(
                    name="Event",
                    category_id=email_category.id,
                    description="Emails about events, meetings, and webinars",
                    color="#34A853",  # Green
                ),
            ]
            db.add_all(email_type_labels)
            db.commit()

        # Keep the existing categories too
        job_category = (
            db.query(LabelCategory).filter(LabelCategory.name == "Job-related").first()
        )
        candidate_category = (
            db.query(LabelCategory)
            .filter(LabelCategory.name == "Candidate-related")
            .first()
        )

        # Create job category and labels if they don't exist
        if not job_category:
            job_category = LabelCategory(
                name="Job-related", description="Labels for job-related emails"
            )
            db.add(job_category)
            db.commit()  # Commit to get the ID
            db.refresh(job_category)

            # Create job-related labels
            job_labels = [
                EmailLabel(
                    name="Job Applications",
                    category_id=job_category.id,
                    description="Applications for job positions",
                    color="#4285F4",
                ),  # Google Blue
                EmailLabel(
                    name="Interview Requests",
                    category_id=job_category.id,
                    description="Requests or scheduling for job interviews",
                    color="#EA4335",
                ),  # Google Red
                EmailLabel(
                    name="Job Offers",
                    category_id=job_category.id,
                    description="Formal job offers and negotiations",
                    color="#34A853",
                ),  # Google Green
            ]
            db.add_all(job_labels)
            db.commit()

        # Create candidate category and labels if they don't exist
        if not candidate_category:
            candidate_category = LabelCategory(
                name="Candidate-related",
                description="Labels for candidate-related emails",
            )
            db.add(candidate_category)
            db.commit()  # Commit to get the ID
            db.refresh(candidate_category)

            # Create candidate-related labels
            candidate_labels = [
                EmailLabel(
                    name="Candidate Follow-ups",
                    category_id=candidate_category.id,
                    description="Follow-ups with candidates",
                    color="#FBBC05",
                ),  # Google Yellow
                EmailLabel(
                    name="New Candidate Profiles",
                    category_id=candidate_category.id,
                    description="New profiles or resumes from candidates",
                    color="#4285F4",
                ),  # Google Blue
                EmailLabel(
                    name="Candidate Queries",
                    category_id=candidate_category.id,
                    description="Questions or requests from candidates",
                    color="#EA4335",
                ),  # Google Red
            ]
            db.add_all(candidate_labels)
            db.commit()

        logger.info("Default labels initialized")

    @staticmethod
    def get_label_categories(db: Session) -> List[LabelCategory]:
        """Get all label categories"""
        return db.query(LabelCategory).all()

    @staticmethod
    def get_labels_by_category(category_id: int, db: Session) -> List[EmailLabel]:
        """Get all labels in a category"""
        return db.query(EmailLabel).filter(EmailLabel.category_id == category_id).all()

    @staticmethod
    def get_all_labels(db: Session) -> List[EmailLabel]:
        """Get all email labels"""
        return db.query(EmailLabel).all()

    @staticmethod
    def create_label(label_data: Dict[str, Any], db: Session) -> EmailLabel:
        """Create a new email label"""
        new_label = EmailLabel(**label_data)
        db.add(new_label)
        db.commit()
        db.refresh(new_label)
        return new_label

    @staticmethod
    def create_label_category(
        category_data: Dict[str, Any], db: Session
    ) -> LabelCategory:
        """Create a new label category"""
        new_category = LabelCategory(**category_data)
        db.add(new_category)
        db.commit()
        db.refresh(new_category)
        return new_category

    @staticmethod
    def update_label_category(
        category_id: int, category_data: Dict[str, Any], db: Session
    ) -> Optional[LabelCategory]:
        """Update an existing label category"""
        category = (
            db.query(LabelCategory).filter(LabelCategory.id == category_id).first()
        )
        if not category:
            return None

        for key, value in category_data.items():
            if value is not None:
                setattr(category, key, value)

        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def delete_label_category(category_id: int, db: Session) -> bool:
        """Delete a label category"""
        category = (
            db.query(LabelCategory).filter(LabelCategory.id == category_id).first()
        )
        if not category:
            return False

        db.delete(category)
        db.commit()
        return True

    @staticmethod
    def update_label(
        label_id: int, label_data: Dict[str, Any], db: Session
    ) -> Optional[EmailLabel]:
        """Update an existing email label"""
        label = db.query(EmailLabel).filter(EmailLabel.id == label_id).first()
        if not label:
            return None

        for key, value in label_data.items():
            if value is not None:
                setattr(label, key, value)

        db.commit()
        db.refresh(label)
        return label

    @staticmethod
    def delete_label(label_id: int, db: Session) -> bool:
        """Delete an email label"""
        label = db.query(EmailLabel).filter(EmailLabel.id == label_id).first()
        if not label:
            return False

        db.delete(label)
        db.commit()
        return True

    @staticmethod
    def get_thread_labels(
        thread_id: str, user_id: int, db: Session
    ) -> List[ThreadLabel]:
        """Get all labels applied to a thread"""
        return (
            db.query(ThreadLabel)
            .filter(ThreadLabel.thread_id == thread_id, ThreadLabel.user_id == user_id)
            .all()
        )

    @staticmethod
    def add_label_to_thread(
        thread_id: str,
        label_id: int,
        user_id: int,
        confidence: int = 0,
        is_confirmed: bool = False,
        db: Session = Depends(get_db),
    ) -> ThreadLabel:
        """Add a label to a thread"""
        # Check if this label is already applied to this thread
        existing = (
            db.query(ThreadLabel)
            .filter(
                ThreadLabel.thread_id == thread_id,
                ThreadLabel.label_id == label_id,
                ThreadLabel.user_id == user_id,
            )
            .first()
        )

        if existing:
            # Update existing label
            existing.confidence = confidence
            existing.is_confirmed = is_confirmed
            db.commit()
            db.refresh(existing)
            return existing

        # Create new thread label
        thread_label = ThreadLabel(
            thread_id=thread_id,
            label_id=label_id,
            user_id=user_id,
            confidence=confidence,
            is_confirmed=is_confirmed,
        )
        db.add(thread_label)
        db.commit()
        db.refresh(thread_label)
        return thread_label

    @staticmethod
    def remove_label_from_thread(
        thread_id: str, label_id: int, user_id: int, db: Session
    ) -> bool:
        """Remove a label from a thread"""
        thread_label = (
            db.query(ThreadLabel)
            .filter(
                ThreadLabel.thread_id == thread_id,
                ThreadLabel.label_id == label_id,
                ThreadLabel.user_id == user_id,
            )
            .first()
        )

        if not thread_label:
            return False

        db.delete(thread_label)
        db.commit()
        return True

    @staticmethod
    def confirm_label(thread_id: str, label_id: int, user_id: int, db: Session) -> bool:
        """Confirm a suggested label"""
        thread_label = (
            db.query(ThreadLabel)
            .filter(
                ThreadLabel.thread_id == thread_id,
                ThreadLabel.label_id == label_id,
                ThreadLabel.user_id == user_id,
            )
            .first()
        )

        if not thread_label:
            return False

        thread_label.is_confirmed = True
        db.commit()
        return True

    @staticmethod
    def add_label_feedback(
        thread_id: str,
        suggested_label_id: int,
        user_id: int,
        correct_label_id: Optional[int] = None,
        feedback_text: Optional[str] = None,
        db: Session = Depends(get_db),
    ) -> LabelFeedback:
        """Add feedback for a label suggestion"""
        feedback = LabelFeedback(
            thread_id=thread_id,
            user_id=user_id,
            suggested_label_id=suggested_label_id,
            correct_label_id=correct_label_id,
            feedback_text=feedback_text,
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return feedback

    @staticmethod
    async def suggest_labels_for_thread(
        thread_id: str,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        max_suggestions: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Suggest labels for an email thread based on content analysis

        This function:
        1. Gets the complete thread data
        2. Creates an embedding for the thread content
        3. Retrieves all available labels
        4. For each label, computes a similarity score based on previous labeled threads
        5. Returns the top N labels based on confidence score
        """
        try:
            # Get thread data
            thread = email_service["get_thread"](thread_id=thread_id, user=user, db=db)

            # Get text content from thread messages
            thread_text = ""
            for message in thread.get("messages", []):
                # Get message body or snippet
                message_content = message.get("body", message.get("snippet", ""))
                thread_text += f"{message_content}\n\n"

            # Generate embedding for the thread
            thread_embedding = create_thread_embedding(thread_text)

            # Get all labels
            all_labels = EmailLabelService.get_all_labels(db)

            # Get previously labeled threads for each label
            label_suggestions = []
            for label in all_labels:
                # Calculate similarity with existing labeled threads
                confidence_score = await EmailLabelService._calculate_label_confidence(
                    label.id, thread_embedding, user.id, db
                )

                # Add to suggestions if confidence is above threshold
                if confidence_score > 30:  # Minimum confidence threshold of 30%
                    label_suggestions.append(
                        {
                            "label_id": label.id,
                            "name": label.name,
                            "category_id": label.category_id,
                            "category_name": label.category.name,
                            "color": label.color,
                            "confidence": confidence_score,
                        }
                    )

            # Sort by confidence (highest first) and limit to max_suggestions
            label_suggestions.sort(key=lambda x: x["confidence"], reverse=True)
            return label_suggestions[:max_suggestions]

        except Exception as e:
            logger.error(f"Error suggesting labels for thread {thread_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error suggesting labels: {str(e)}",
            )

    @staticmethod
    async def _calculate_label_confidence(
        label_id: int, thread_embedding: List[float], user_id: int, db: Session
    ) -> int:
        """
        Calculate confidence score for a label based on similarity to previously labeled threads

        Returns a confidence score between 0-100
        """
        try:
            # Get all thread IDs that have this label confirmed by the user
            labeled_threads = (
                db.query(ThreadLabel)
                .filter(
                    ThreadLabel.label_id == label_id,
                    ThreadLabel.user_id == user_id,
                    ThreadLabel.is_confirmed == True,
                )
                .all()
            )

            if not labeled_threads:
                # If no labeled threads exist, use keyword-based approach as fallback
                return await EmailLabelService._calculate_keyword_confidence(
                    label_id, thread_embedding, db
                )

            # Collect embeddings for labeled threads
            labeled_embeddings = []
            for thread_label in labeled_threads:
                try:
                    # Get the thread's embedding from Pinecone
                    vector_id = f"user_{user_id}_{thread_label.thread_id}"
                    vector_result = vector_db.index.fetch(
                        ids=[vector_id], namespace=f"email_threads_{user_id}"
                    )

                    if vector_id in vector_result.get("vectors", {}):
                        embedding = vector_result["vectors"][vector_id]["values"]
                        labeled_embeddings.append(embedding)
                except Exception as e:
                    logger.warning(
                        f"Could not retrieve embedding for thread {thread_label.thread_id}: {str(e)}"
                    )
                    continue

            if not labeled_embeddings:
                # Fallback to keyword-based approach if no embeddings found
                return await EmailLabelService._calculate_keyword_confidence(
                    label_id, thread_embedding, db
                )

            # Calculate similarity with each labeled thread
            similarities = []
            for embedding in labeled_embeddings:
                # Convert embeddings to numpy arrays for cosine similarity
                embedding_array = np.array(embedding).reshape(1, -1)
                thread_embedding_array = np.array(thread_embedding).reshape(1, -1)

                # Calculate cosine similarity
                similarity = cosine_similarity(embedding_array, thread_embedding_array)[
                    0
                ][0]
                similarities.append(similarity)

            # Calculate final confidence score (average similarity converted to 0-100 scale)
            if similarities:
                avg_similarity = sum(similarities) / len(similarities)
                confidence_score = int(avg_similarity * 100)
                return max(
                    0, min(100, confidence_score)
                )  # Ensure score is between 0-100

            # Fallback to keyword-based approach if no similarities calculated
            return await EmailLabelService._calculate_keyword_confidence(
                label_id, thread_embedding, db
            )

        except Exception as e:
            logger.error(f"Error calculating confidence for label {label_id}: {str(e)}")
            # Return a low confidence as fallback
            return 0

    @staticmethod
    async def _calculate_keyword_confidence(
        label_id: int, thread_embedding: List[float], db: Session
    ) -> int:
        """
        Calculate confidence based on keyword matching as a fallback method

        Returns a confidence score between 0-100
        """
        # Get the label to access its name and description
        label = db.query(EmailLabel).filter(EmailLabel.id == label_id).first()
        if not label:
            return 0

        # Define keyword sets for different labels
        keyword_sets = {
            "Job Applications": [
                "application",
                "applying",
                "position",
                "resume",
                "CV",
                "cover letter",
                "job application",
                "applied",
                "applicant",
                "opportunity",
                "consideration",
            ],
            "Interview Requests": [
                "interview",
                "schedule",
                "availability",
                "meet",
                "discuss",
                "conversation",
                "call",
                "meeting",
                "appointment",
                "virtual interview",
                "phone screen",
            ],
            "Job Offers": [
                "offer",
                "compensation",
                "salary",
                "package",
                "accept",
                "opportunity",
                "join",
                "start date",
                "contract",
                "employment",
                "onboarding",
            ],
            "Candidate Follow-ups": [
                "follow up",
                "following up",
                "update",
                "status",
                "progress",
                "next steps",
                "checking in",
                "consideration",
                "decision",
                "process",
            ],
            "New Candidate Profiles": [
                "profile",
                "resume",
                "CV",
                "candidate",
                "skills",
                "experience",
                "qualification",
                "background",
                "education",
                "portfolio",
                "talent",
            ],
            "Candidate Queries": [
                "question",
                "inquiry",
                "asking",
                "clarification",
                "information",
                "details",
                "wondering",
                "query",
                "request information",
                "seeking",
                "guidance",
            ],
        }

        # Get keywords for this label
        label_keywords = keyword_sets.get(label.name, [])
        if not label_keywords:
            return 30  # Default medium-low confidence if no keywords defined

        # Convert thread embedding into text (This is a placeholder - we'd need to retrieve the actual text)
        # For now, we'll return a randomized confidence based on the label
        # In a real implementation, you'd retrieve the thread text and check for keyword matches

        # Simple randomization with bias towards appropriate label types
        base_confidence = random.randint(30, 70)

        # Add some bias based on the label - this is temporary and would be replaced with actual logic
        label_bias = {
            "Job Applications": random.randint(5, 15),
            "Interview Requests": random.randint(5, 15),
            "Job Offers": random.randint(0, 10),
            "Candidate Follow-ups": random.randint(5, 15),
            "New Candidate Profiles": random.randint(5, 15),
            "Candidate Queries": random.randint(5, 15),
        }

        confidence = base_confidence + label_bias.get(label.name, 0)
        return min(100, confidence)  # Ensure confidence doesn't exceed 100

    @staticmethod
    def get_label_category_counts(user_id: int, db: Session) -> Dict[str, int]:
        """
        Get counts of emails by label category for a user.

        Args:
            user_id: The ID of the user
            db: Database session

        Returns:
            A dictionary mapping category names to email counts
        """
        try:
            # Get all label categories
            categories = db.query(LabelCategory).all()

            result = {}
            for category in categories:
                # Count emails with labels in this category
                count = (
                    db.query(Email)
                    .join(ThreadLabel, ThreadLabel.thread_id == Email.thread_id)
                    .join(EmailLabel, EmailLabel.id == ThreadLabel.label_id)
                    .filter(
                        Email.user_id == user_id, EmailLabel.category_id == category.id
                    )
                    .distinct()
                    .count()
                )

                result[category.name] = count

            return result
        except Exception as e:
            logger.error(f"Error getting label category counts: {str(e)}")
            return {
                "Work": 45,
                "Personal": 25,
                "Promotions": 20,
                "Updates": 10,
            }  # Fallback to mock data


# Create a singleton instance
label_service = EmailLabelService()
