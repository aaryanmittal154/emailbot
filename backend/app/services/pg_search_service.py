from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.email import Email
import logging

logger = logging.getLogger(__name__)


class PGSearchService:
    """
    Service for performing full-text search over emails using PostgreSQL's native capabilities.
    """

    @staticmethod
    def search_emails(
        db: Session,
        query: str,
        user_id: Optional[int] = None,
        limit: int = 20,
        offset: int = 0,
        content_field: str = "full_content"
    ) -> List[Dict[str, Any]]:
        """
        Perform a full-text search over the emails table.
        Args:
            db: SQLAlchemy session
            query: The search query string
            user_id: If provided, restrict search to a specific user
            limit: Max number of results
            offset: Pagination offset
            content_field: Which field to search (default: full_content)
        Returns:
            List of dicts representing matched emails, ordered by relevance
        """
        # Use PostgreSQL's to_tsvector and plainto_tsquery for full-text search
        # Use COALESCE to fallback to snippet if full_content is null
        sql = f"""
            SELECT *,
                ts_rank_cd(
                    to_tsvector('english', COALESCE({content_field}, snippet)),
                    plainto_tsquery('english', :query)
                ) AS rank
            FROM email_metadata
            WHERE to_tsvector('english', COALESCE({content_field}, snippet)) @@ plainto_tsquery('english', :query)
            {('AND user_id = :user_id' if user_id is not None else '')}
            ORDER BY rank DESC, date DESC
            LIMIT :limit OFFSET :offset
        """
        params = {"query": query, "limit": limit, "offset": offset}
        if user_id is not None:
            params["user_id"] = user_id
        result = db.execute(text(sql), params)
        emails = [dict(row) for row in result.mappings().all()]
        logger.info(f"[PGSearchService.{__name__}] Query: '{query}' | Results: {len(emails)}")
        for idx, email in enumerate(emails):
            logger.info(f"  Rank {idx+1}: thread_id={email.get('thread_id', email.get('id'))}, subject={email.get('subject')}, rank={email.get('rank')}")
        return emails

    @staticmethod
    def search_subjects(
        db: Session,
        query: str,
        user_id: Optional[int] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Perform a full-text search over the subject field only.
        """
        sql = """
            SELECT *,
                ts_rank_cd(
                    to_tsvector('english', subject),
                    plainto_tsquery('english', :query)
                ) AS rank
            FROM email_metadata
            WHERE to_tsvector('english', subject) @@ plainto_tsquery('english', :query)
            {0}
            ORDER BY rank DESC, date DESC
            LIMIT :limit OFFSET :offset
        """.format('AND user_id = :user_id' if user_id is not None else '')
        params = {"query": query, "limit": limit, "offset": offset}
        if user_id is not None:
            params["user_id"] = user_id
        result = db.execute(text(sql), params)
        emails = [dict(row) for row in result.mappings().all()]
        logger.info(f"[PGSearchService.{__name__}] Query: '{query}' | Results: {len(emails)}")
        for idx, email in enumerate(emails):
            logger.info(f"  Rank {idx+1}: thread_id={email.get('thread_id', email.get('id'))}, subject={email.get('subject')}, rank={email.get('rank')}")
        return emails
