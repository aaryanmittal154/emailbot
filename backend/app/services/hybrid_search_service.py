from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import numpy as np

from app.services.pg_search_service import PGSearchService
from app.services.vector_db_service import vector_db
import logging

logger = logging.getLogger(__name__)



def reciprocal_rank_fusion(result_lists: List[List[Dict[str, Any]]], k: int = 60) -> List[Dict[str, Any]]:
    """
    Fuse multiple ranked lists using Reciprocal Rank Fusion (RRF).
    Each item's score is the sum of 1/(k + rank) from each list.
    """
    scores = {}
    id_to_item = {}
    for result_list in result_lists:
        for rank, item in enumerate(result_list):
            thread_id = item.get("thread_id") or item.get("id")
            if not thread_id:
                continue
            scores.setdefault(thread_id, 0)
            scores[thread_id] += 1.0 / (k + rank + 1)
            if thread_id not in id_to_item:
                id_to_item[thread_id] = item
    # Sort by RRF score
    sorted_threads = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [id_to_item[tid] for tid, _ in sorted_threads]


class HybridSearchService:
    """
    Service to perform hybrid search (vector + full-text) over emails.
    """

    @staticmethod
    def hybrid_search(
        db: Session,
        user_id: int,
        query: str,
        embedding: np.ndarray,
        top_k: int = 10,
        filter_category: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search using both vector and full-text search, then fuse results.
        Args:
            db: SQLAlchemy session
            user_id: User ID to restrict search
            query: Query string for full-text search
            embedding: Embedding vector for semantic search
            top_k: Max results from each method
            filter_category: Optionally restrict by category
        Returns:
            List of fused results ranked by RRF
        """
        # Vector search
        vector_results = vector_db.search_threads(
            user_id=user_id,
            query_embedding=embedding,
            top_k=top_k,
            filter_category=filter_category,
        )
        logger.info(f"[HybridSearchService] Vector Search Query: embedding for '{query}' | Results: {len(vector_results)}")
        for idx, item in enumerate(vector_results):
            logger.info(f"  Vector Rank {idx+1}: thread_id={item.get('thread_id', item.get('id'))}, subject={item.get('subject')}, score={item.get('score', 'n/a')}")

        pg_results = PGSearchService.search_emails(
            db=db,
            query=query,
            user_id=user_id,
            limit=top_k,
        )
        logger.info(f"[HybridSearchService] PG Search Query: '{query}' | Results: {len(pg_results)}")
        for idx, item in enumerate(pg_results):
            logger.info(f"  PG Rank {idx+1}: thread_id={item.get('thread_id', item.get('id'))}, subject={item.get('subject')}, rank={item.get('rank', 'n/a')}")

        fused = reciprocal_rank_fusion([vector_results, pg_results], k=60)
        logger.info(f"[HybridSearchService] Fused Results for Query: '{query}' | Results: {len(fused)}")
        for idx, item in enumerate(fused[:top_k]):
            logger.info(f"  Fused Rank {idx+1}: thread_id={item.get('thread_id', item.get('id'))}, subject={item.get('subject')}")
        return fused[:top_k]
