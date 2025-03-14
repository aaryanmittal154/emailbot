from typing import List, Dict, Any, Optional
import numpy as np
from app.models.email import EmailMetadata
from app.db.db import Database
from app.services.embedding_service import EmbeddingService

class VectorStore:
    """Service to handle vector embedding storage and retrieval for semantic search"""
    
    def __init__(self):
        """Initialize the vector store service"""
        self.db = Database()
        self.embedding_service = EmbeddingService()
    
    def search_vectors(
        self,
        query_text: str,
        include_labels: List[str] = [],
        exclude_labels: List[str] = [],
        exclude_thread_ids: List[str] = [],
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for vectors similar to the query text with category filtering
        
        Args:
            query_text: The text to search for
            include_labels: Categories to include (empty means all)
            exclude_labels: Categories to exclude
            exclude_thread_ids: Thread IDs to exclude from results
            limit: Maximum number of results to return
            
        Returns:
            List of search results with similarity scores
        """
        # Convert query text to embedding vector
        query_embedding = self.embedding_service.generate_embedding(query_text)
        
        # Construct the SQL query with category filtering
        query = """
            SELECT 
                t.thread_id,
                t.subject,
                t.snippet, 
                t.embedding,
                t.date,
                l.name as label,
                (
                    t.embedding <=> %(query_embedding)s
                ) as similarity_score
            FROM thread_embeddings t
            JOIN thread_labels tl ON t.thread_id = tl.thread_id
            JOIN labels l ON tl.label_id = l.id
            WHERE 1=1
        """
        
        params = {
            "query_embedding": query_embedding
        }
        
        # Add filtering for include_labels if provided
        if include_labels:
            query += " AND l.name IN %(include_labels)s"
            params["include_labels"] = tuple(include_labels)
            
        # Add filtering for exclude_labels if provided
        if exclude_labels:
            query += " AND l.name NOT IN %(exclude_labels)s"
            params["exclude_labels"] = tuple(exclude_labels)
            
        # Add filtering for excluded thread IDs
        if exclude_thread_ids:
            query += " AND t.thread_id NOT IN %(exclude_thread_ids)s"
            params["exclude_thread_ids"] = tuple(exclude_thread_ids)
            
        # Order by similarity score and limit results
        query += """
            ORDER BY similarity_score ASC
            LIMIT %(limit)s
        """
        params["limit"] = limit
        
        # Execute the query
        results = self.db.execute_query(query, params)
        
        # Format results for return
        formatted_results = []
        for row in results:
            formatted_results.append({
                "thread_id": row["thread_id"],
                "subject": row["subject"],
                "snippet": row["snippet"],
                "date": row["date"],
                "label": row["label"],
                "score": float(row["similarity_score"])
            })
            
        return formatted_results
    
    def index_thread(self, thread_id: str, thread_text: str) -> bool:
        """
        Index a thread by generating and storing its embedding
        
        Args:
            thread_id: The ID of the thread to index
            thread_text: The text content of the thread to embed
            
        Returns:
            True if indexing was successful, False otherwise
        """
        try:
            # Generate embedding for the thread text
            embedding = self.embedding_service.generate_embedding(thread_text)
            
            # Store the embedding in the database
            query = """
                INSERT INTO thread_embeddings (thread_id, embedding, embedding_model)
                VALUES (%(thread_id)s, %(embedding)s, %(model)s)
                ON CONFLICT (thread_id) 
                DO UPDATE SET 
                    embedding = %(embedding)s,
                    embedding_model = %(model)s,
                    updated_at = NOW()
            """
            
            params = {
                "thread_id": thread_id,
                "embedding": embedding,
                "model": self.embedding_service.model_name
            }
            
            self.db.execute_query(query, params)
            return True
            
        except Exception as e:
            print(f"Error indexing thread {thread_id}: {str(e)}")
            return False
            
    def batch_index_threads(self, threads: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Index multiple threads in batch
        
        Args:
            threads: List of thread objects with thread_id and text content
            
        Returns:
            Dictionary with success count and failed count
        """
        success_count = 0
        failed_count = 0
        
        for thread in threads:
            thread_id = thread.get("thread_id")
            thread_text = self._prepare_thread_text(thread)
            
            if self.index_thread(thread_id, thread_text):
                success_count += 1
            else:
                failed_count += 1
                
        return {
            "success_count": success_count,
            "failed_count": failed_count,
            "total": len(threads)
        }
        
    def _prepare_thread_text(self, thread: Dict[str, Any]) -> str:
        """Prepare thread text for embedding"""
        parts = []
        
        # Add subject
        if thread.get("subject"):
            parts.append(f"Subject: {thread['subject']}")
            
        # Add snippet/body
        if thread.get("snippet"):
            parts.append(thread["snippet"])
        elif thread.get("body"):
            parts.append(thread["body"])
            
        # Add labels if available
        if thread.get("labels"):
            labels_str = ", ".join(thread["labels"])
            parts.append(f"Labels: {labels_str}")
            
        return "\n\n".join(parts)
