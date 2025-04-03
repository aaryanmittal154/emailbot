from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.label_service import label_service
from app.services.email_classifier_service import email_classifier
from app.services.email_service import email_service
from app.schemas.label import (
    LabelCategoryResponse,
    LabelCategoryCreate,
    LabelCategoryUpdate,
    EmailLabelResponse,
    EmailLabelCreate,
    EmailLabelUpdate,
    ThreadLabelCreate,
    ThreadLabelResponse,
    LabelSuggestionRequest,
    LabelSuggestionResponse,
    LabelFeedbackCreate,
    LabelFeedbackResponse,
    ThreadClassifyRequest,
)

router = APIRouter(
    prefix="/labels",
    tags=["labels"],
    responses={404: {"description": "Not found"}},
)


@router.post("/initialize", status_code=status.HTTP_200_OK)
async def initialize_default_labels(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initialize default label categories and labels"""
    background_tasks.add_task(label_service.initialize_default_labels, db)
    return {"status": "success", "message": "Default labels initialization started"}


# Label Categories
@router.get("/categories", response_model=List[LabelCategoryResponse])
async def get_label_categories(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get all label categories"""
    return label_service.get_label_categories(db)


@router.post(
    "/categories",
    response_model=LabelCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_label_category(
    category: LabelCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new label category"""
    return label_service.create_label_category(category.dict(), db)


@router.put("/categories/{category_id}", response_model=LabelCategoryResponse)
async def update_label_category(
    category_id: int,
    category: LabelCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a label category"""
    updated_category = label_service.update_label_category(
        category_id, category.dict(exclude_unset=True), db
    )
    if not updated_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found",
        )
    return updated_category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a label category"""
    deleted = label_service.delete_label_category(category_id, db)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found",
        )
    return None


# Email Labels
@router.get("/", response_model=List[EmailLabelResponse])
async def get_all_labels(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get all email labels"""
    return label_service.get_all_labels(db)


@router.get("/category/{category_id}", response_model=List[EmailLabelResponse])
async def get_labels_by_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all labels in a category"""
    return label_service.get_labels_by_category(category_id, db)


@router.post(
    "/", response_model=EmailLabelResponse, status_code=status.HTTP_201_CREATED
)
async def create_label(
    label: EmailLabelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new email label"""
    return label_service.create_label(label.dict(), db)


@router.put("/{label_id}", response_model=EmailLabelResponse)
async def update_label(
    label_id: int,
    label: EmailLabelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an email label"""
    updated_label = label_service.update_label(
        label_id, label.dict(exclude_unset=True), db
    )
    if not updated_label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Label with ID {label_id} not found",
        )
    return updated_label


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label(
    label_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an email label"""
    deleted = label_service.delete_label(label_id, db)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Label with ID {label_id} not found",
        )
    return None


# Thread Labels
@router.get("/thread/{thread_id}", response_model=List[ThreadLabelResponse])
async def get_thread_labels(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all labels for a thread"""
    return label_service.get_thread_labels(thread_id, current_user.id, db)


@router.post(
    "/thread", response_model=ThreadLabelResponse, status_code=status.HTTP_201_CREATED
)
async def add_label_to_thread(
    thread_label: ThreadLabelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a label to a thread"""
    return label_service.add_label_to_thread(
        thread_id=thread_label.thread_id,
        label_id=thread_label.label_id,
        user_id=current_user.id,
        confidence=thread_label.confidence,
        is_confirmed=thread_label.is_confirmed,
        db=db,
    )


@router.delete(
    "/thread/{thread_id}/label/{label_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_label_from_thread(
    thread_id: str,
    label_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a label from a thread"""
    removed = label_service.remove_label_from_thread(
        thread_id, label_id, current_user.id, db
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Label {label_id} not found for thread {thread_id}",
        )
    return None


@router.post("/thread/{thread_id}/confirm/{label_id}", status_code=status.HTTP_200_OK)
async def confirm_thread_label(
    thread_id: str,
    label_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm a suggested label"""
    confirmed = label_service.confirm_label(thread_id, label_id, current_user.id, db)
    if not confirmed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Label {label_id} not found for thread {thread_id}",
        )
    return {"status": "success", "message": "Label confirmed"}


# Label Suggestions
@router.post("/suggest", response_model=LabelSuggestionResponse)
async def suggest_labels(
    request: LabelSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suggest labels for a thread based on content analysis"""
    suggestions = await label_service.suggest_labels_for_thread(
        thread_id=request.thread_id,
        user=current_user,
        db=db,
        max_suggestions=request.max_suggestions,
    )

    return {"thread_id": request.thread_id, "suggestions": suggestions}


# Label Feedback
@router.post(
    "/feedback",
    response_model=LabelFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_label_feedback(
    feedback: LabelFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add feedback for a label suggestion"""
    return label_service.add_label_feedback(
        thread_id=feedback.thread_id,
        suggested_label_id=feedback.suggested_label_id,
        user_id=current_user.id,
        correct_label_id=feedback.correct_label_id,
        feedback_text=feedback.feedback_text,
        db=db,
    )


@router.post("/classify-thread", response_model=Dict[str, Any])
async def classify_thread(
    request: ThreadClassifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Classify an email thread and extract structured fields"""
    try:
        # Get the thread data
        thread = email_service["get_thread"](
            thread_id=request.thread_id, user=current_user, db=db
        )

        # Classify the email
        classification_result = await email_classifier.classify_email(
            thread_data=thread, user=current_user, db=db
        )

        if not classification_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=classification_result["message"],
            )

        return classification_result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error classifying thread: {str(e)}",
        )
