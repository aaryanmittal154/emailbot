import os
from typing import List, Dict, Any, Optional
from pinecone import Pinecone, ServerlessSpec
import time
import json
from app.services.embedding_service import EMBEDDING_DIMENSIONS
import logging

# Constants
INDEX_NAME = "supperconnector"
PINECONE_NAMESPACE = "email_threads"

# Configure logger
logger = logging.getLogger(__name__)


class VectorDBService:
    """Service to handle interactions with Pinecone vector database"""

    def __init__(self):
        """Initialize the Pinecone client and ensure index exists"""
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.pc = Pinecone(api_key=self.api_key)

        # Define serverless spec (can be configured via env variables)
        cloud = os.getenv("PINECONE_CLOUD", "aws")
        region = os.getenv("PINECONE_REGION", "us-west-2")
        self.spec = ServerlessSpec(cloud=cloud, region=region)

        # Initialize index
        self._init_index()

        # Connect to index
        self.index = self.pc.Index(INDEX_NAME)

    def _init_index(self) -> None:
        """Initialize the Pinecone index if it doesn't exist"""
        try:
            # Check if index already exists
            if INDEX_NAME not in self.pc.list_indexes().names():
                print(f"Creating index '{INDEX_NAME}'...")
                # Create index with appropriate dimensions for text-embedding-3-small
                self.pc.create_index(
                    name=INDEX_NAME,
                    dimension=EMBEDDING_DIMENSIONS,
                    metric="cosine",
                    spec=self.spec,
                )

                # Wait for index to be ready
                while not self.pc.describe_index(INDEX_NAME).status["ready"]:
                    time.sleep(1)

                print(f"Index '{INDEX_NAME}' created successfully")
            else:
                print(f"Index '{INDEX_NAME}' already exists")

        except Exception as e:
            print(f"Error initializing Pinecone index: {str(e)}")

    def upsert_thread(self, user_id: int, thread_data: Dict[str, Any]) -> bool:
        """
        Upsert an email thread to Pinecone

        Args:
            user_id: The ID of the user who owns the thread
            thread_data: The thread data with embedding

        Returns:
            bool: Success status
        """
        try:
            # Skip storing irrelevant emails (promotional/security)
            if thread_data.get("category", "").lower() == "irrelevant":
                print(
                    f"Skipping storage of irrelevant email (thread {thread_data['thread_id']})"
                )
                return True  # Return true to avoid error logs, but we're not actually storing

            # Create a unique ID that combines user_id and thread_id
            vector_id = f"user_{user_id}_{thread_data['thread_id']}"

            # Extract the embedding
            embedding = thread_data.get("embedding")
            if not embedding:
                print(f"No embedding found for thread {thread_data['thread_id']}")
                return False

            # Prepare metadata (exclude the embedding to save space)
            metadata = {
                "user_id": user_id,
                "thread_id": thread_data["thread_id"],
                "subject": thread_data["subject"],
                "participants": json.dumps(thread_data["participants"]),
                "message_count": thread_data["message_count"],
                "last_updated": thread_data["last_updated"],
                # Store the full text content instead of just a preview
                "full_content": thread_data["text_content"],
                # Keep a preview for quick display in search results
                "text_preview": (
                    thread_data["text_content"][:1000]
                    if "text_content" in thread_data
                    else ""
                ),
                # Store the category if available
                "category": thread_data.get("category", ""),
            }

            # Upsert to Pinecone
            self.index.upsert(
                vectors=[(vector_id, embedding, metadata)],
                namespace=f"{PINECONE_NAMESPACE}_{user_id}",  # Namespace per user for isolation
            )

            print(
                f"Thread {thread_data['thread_id']} with full content upserted to Pinecone for user {user_id}"
            )
            return True

        except Exception as e:
            print(f"Error upserting thread to Pinecone: {str(e)}")
            return False

    def delete_thread(self, user_id: int, thread_id: str) -> bool:
        """Delete a thread from Pinecone"""
        try:
            vector_id = f"user_{user_id}_{thread_id}"
            self.index.delete(
                ids=[vector_id], namespace=f"{PINECONE_NAMESPACE}_{user_id}"
            )
            print(f"Thread {thread_id} deleted from Pinecone for user {user_id}")
            return True
        except Exception as e:
            print(f"Error deleting thread from Pinecone: {str(e)}")
            return False

    def search_threads(
        self,
        user_id: int,
        query_embedding: List[float],
        top_k: int = 10,
        filter_category: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar email threads using vector similarity

        Args:
            user_id: The ID of the user performing the search
            query_embedding: The embedding vector of the search query
            top_k: Number of results to return
            filter_category: Optionally filter results to a specific category (e.g., "Job Posting" or "Candidate")

        Returns:
            List of thread metadata ordered by relevance
        """
        try:
            # Prepare filter conditions
            filter_condition = {}

            # Always filter by user_id
            filter_condition["user_id"] = user_id

            # Optionally filter by category
            if filter_category:
                filter_condition["category"] = filter_category
                print(f"Filtering by category: {filter_category}")

            # Execute the query with error handling
            try:
                results = self.index.query(
                    vector=query_embedding,
                    top_k=top_k * 3,  # Fetch more items to account for filtering
                    namespace=f"{PINECONE_NAMESPACE}_{user_id}",
                    include_metadata=True,
                    filter=filter_condition,
                )
            except Exception as query_error:
                print(f"Vector query error: {str(query_error)}")
                # Return empty results instead of failing completely
                return []

            # Format the results
            formatted_results = []
            for match in results["matches"]:
                try:
                    # Convert participants back from JSON string
                    participants = json.loads(
                        match["metadata"].get("participants", "[]")
                    )

                    formatted_results.append(
                        {
                            "thread_id": match["metadata"]["thread_id"],
                            "subject": match["metadata"]["subject"],
                            "participants": participants,
                            "message_count": int(match["metadata"]["message_count"]),
                            "last_updated": match["metadata"]["last_updated"],
                            "text_preview": match["metadata"].get("text_preview", ""),
                            "full_content": match["metadata"].get(
                                "full_content", ""
                            ),  # Include full content in results
                            "category": match["metadata"].get(
                                "category", ""
                            ),  # Include category in results
                            "score": match["score"],  # Similarity score
                        }
                    )

                    # Limit to requested number of results after filtering
                    if len(formatted_results) >= top_k:
                        break
                except Exception as format_error:
                    # Skip malformed results rather than failing completely
                    print(f"Error formatting search result: {str(format_error)}")
                    continue

            print(f"Found {len(formatted_results)} results matching the query")
            return formatted_results

        except Exception as e:
            print(f"Error searching threads: {str(e)}")
            return []  # Return empty list instead of failing

    def get_stats(self) -> Dict[str, Any]:
        """Get stats about the Pinecone index"""
        try:
            return self.index.describe_index_stats()
        except Exception as e:
            print(f"Error getting index stats: {str(e)}")
            return {}

    def get_thread_by_id(
        self, user_id: int, thread_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve a specific thread by ID from the vector database

        Args:
            user_id: The ID of the user who owns the thread
            thread_id: The ID of the thread to retrieve

        Returns:
            Thread metadata if found, None otherwise
        """
        try:
            vector_id = f"user_{user_id}_{thread_id}"
            fetch_response = self.index.fetch(
                ids=[vector_id], namespace=f"{PINECONE_NAMESPACE}_{user_id}"
            )

            # Check if the vector was found in the response
            if vector_id in fetch_response.vectors:
                vector_data = fetch_response.vectors[vector_id]
                # Access metadata directly from the vector data object
                metadata = vector_data.metadata

                if not metadata:
                    logger.warning(f"Vector {vector_id} found but has no metadata.")
                    return None

                # Convert participants back from JSON string
                try:
                    participants = json.loads(metadata.get("participants", "[]"))
                except json.JSONDecodeError:
                    logger.warning(
                        f"Could not decode participants JSON for thread {thread_id}"
                    )
                    participants = []  # Default to empty list

                return {
                    "thread_id": metadata.get(
                        "thread_id", thread_id
                    ),  # Use provided thread_id as fallback
                    "subject": metadata.get("subject", ""),
                    "participants": participants,
                    "message_count": int(metadata.get("message_count", 0)),
                    "last_updated": metadata.get("last_updated", ""),
                    "text_preview": metadata.get("text_preview", ""),
                    "full_content": metadata.get("full_content", ""),
                    "category": metadata.get("category", ""),
                }
            else:
                # Vector ID not found in the response vectors
                logger.info(
                    f"Thread {thread_id} (vector {vector_id}) not found in Pinecone fetch response."
                )
                return None

        except Exception as e:
            # Use logger for consistency
            logger.error(
                f"Error retrieving thread {thread_id} from Pinecone: {str(e)}",
                exc_info=True,
            )
            return None


# Create a singleton instance
vector_db = VectorDBService()
