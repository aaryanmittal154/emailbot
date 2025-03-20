"""API routes for managing custom prompts for email classification and auto-reply"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging

from app.db.database import get_db
from app.models.user import User
from app.models.custom_prompt import CustomPrompt
from app.services.auth_service import get_current_user
from app.services.email_classifier_service import EmailClassifierService
from app.services.auto_reply_service import AutoReplyManager

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter()

# Define valid categories and prompt types for validation
VALID_CATEGORIES = [
    "Job Posting",
    "Candidate",
    "Event",
    "Questions",
    "Discussion Topics",
    "Irrelevant",
    "Other",
    "Follow-ups",
]

VALID_PROMPT_TYPES = ["classification", "auto_reply"]

# Default prompts
DEFAULT_CLASSIFICATION_PROMPT = (
    EmailClassifierService.get_default_classification_prompt()
)
DEFAULT_AUTO_REPLY_PROMPTS = {
    "general": AutoReplyManager.get_default_auto_reply_prompt(),
    "context_only": AutoReplyManager.get_default_context_only_prompt(),
    "job_posting": AutoReplyManager.get_default_job_posting_prompt(),
    "candidate": AutoReplyManager.get_default_candidate_prompt(),
}


@router.get("/prompts", response_model=List[Dict[str, Any]])
async def get_prompts(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all custom prompts for the current user"""
    try:
        # Get all custom prompts for the user
        custom_prompts = (
            db.query(CustomPrompt).filter(CustomPrompt.user_id == user.id).all()
        )

        # Format the response
        return [
            {
                "id": prompt.id,
                "category": prompt.category,
                "prompt_type": prompt.prompt_type,
                "content": prompt.content,
                "created_at": prompt.created_at,
                "updated_at": prompt.updated_at,
            }
            for prompt in custom_prompts
        ]
    except Exception as e:
        logger.error(f"Error getting custom prompts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting custom prompts: {str(e)}",
        )


@router.get("/prompts/defaults", response_model=Dict[str, Any])
async def get_default_prompts():
    """Get the default prompts for all categories"""
    try:
        return {
            "classification": DEFAULT_CLASSIFICATION_PROMPT,
            "auto_reply": DEFAULT_AUTO_REPLY_PROMPTS,
        }
    except Exception as e:
        logger.error(f"Error getting default prompts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting default prompts: {str(e)}",
        )


@router.post("/prompts", response_model=Dict[str, Any])
async def create_prompt(
    prompt_data: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new custom prompt"""
    try:
        # Extract fields from the request body
        category = prompt_data.get("category")
        prompt_type = prompt_data.get("prompt_type")
        content = prompt_data.get("content")

        # Validate required fields
        if not all([category, prompt_type, content]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: category, prompt_type, content",
            )

        # Validate the category
        if category not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
            )

        # Validate the prompt type
        if prompt_type not in VALID_PROMPT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid prompt type. Must be one of: {', '.join(VALID_PROMPT_TYPES)}",
            )

        # Check if a prompt already exists for this category and type
        existing_prompt = (
            db.query(CustomPrompt)
            .filter(
                CustomPrompt.user_id == user.id,
                CustomPrompt.category == category,
                CustomPrompt.prompt_type == prompt_type,
            )
            .first()
        )

        if existing_prompt:
            # Update the existing prompt
            existing_prompt.content = content
            db.commit()
            db.refresh(existing_prompt)

            return {
                "id": existing_prompt.id,
                "category": existing_prompt.category,
                "prompt_type": existing_prompt.prompt_type,
                "content": existing_prompt.content,
                "created_at": existing_prompt.created_at,
                "updated_at": existing_prompt.updated_at,
                "message": "Prompt updated successfully",
            }

        # Create a new prompt
        new_prompt = CustomPrompt(
            user_id=user.id, category=category, prompt_type=prompt_type, content=content
        )

        db.add(new_prompt)
        db.commit()
        db.refresh(new_prompt)

        return {
            "id": new_prompt.id,
            "category": new_prompt.category,
            "prompt_type": new_prompt.prompt_type,
            "content": new_prompt.content,
            "created_at": new_prompt.created_at,
            "updated_at": new_prompt.updated_at,
            "message": "Prompt created successfully",
        }
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error creating custom prompt: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating custom prompt: {str(e)}",
        )


@router.delete("/prompts/{prompt_id}", response_model=Dict[str, str])
async def delete_prompt(
    prompt_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a custom prompt"""
    try:
        # Get the prompt
        prompt = (
            db.query(CustomPrompt)
            .filter(CustomPrompt.id == prompt_id, CustomPrompt.user_id == user.id)
            .first()
        )

        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Custom prompt not found"
            )

        # Delete the prompt
        db.delete(prompt)
        db.commit()

        return {"message": "Prompt deleted successfully"}
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error deleting custom prompt: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting custom prompt: {str(e)}",
        )


@router.get("/prompts/{category}/{prompt_type}", response_model=Dict[str, Any])
async def get_prompt(
    category: str,
    prompt_type: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific custom prompt"""
    try:
        # Validate the category
        if category not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
            )

        # Validate the prompt type
        if prompt_type not in VALID_PROMPT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid prompt type. Must be one of: {', '.join(VALID_PROMPT_TYPES)}",
            )

        # Get the prompt
        prompt = (
            db.query(CustomPrompt)
            .filter(
                CustomPrompt.user_id == user.id,
                CustomPrompt.category == category,
                CustomPrompt.prompt_type == prompt_type,
            )
            .first()
        )

        if not prompt:
            # Return the default prompt if no custom prompt is found
            if prompt_type == "classification":
                content = DEFAULT_CLASSIFICATION_PROMPT
            else:  # auto_reply
                if category in ["Job Posting", "Candidate"]:
                    prompt_key = category.lower().replace(" ", "_")
                    content = DEFAULT_AUTO_REPLY_PROMPTS.get(
                        prompt_key, DEFAULT_AUTO_REPLY_PROMPTS["general"]
                    )
                elif category in ["Questions", "Discussion Topics", "Event"]:
                    content = DEFAULT_AUTO_REPLY_PROMPTS["context_only"]
                else:
                    content = DEFAULT_AUTO_REPLY_PROMPTS["general"]

            return {
                "id": None,
                "category": category,
                "prompt_type": prompt_type,
                "content": content,
                "is_default": True,
            }

        return {
            "id": prompt.id,
            "category": prompt.category,
            "prompt_type": prompt.prompt_type,
            "content": prompt.content,
            "created_at": prompt.created_at,
            "updated_at": prompt.updated_at,
            "is_default": False,
        }
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error getting custom prompt: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting custom prompt: {str(e)}",
        )
