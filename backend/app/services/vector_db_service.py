import os
from typing import List, Dict, Any, Optional
import pinecone
from pinecone import Pinecone, ServerlessSpec
import time
import json
from app.services.embedding_service import EMBEDDING_DIMENSIONS

# Constants
INDEX_NAME = "supperconnector"
PINECONE_NAMESPACE = "email_threads"


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
        self, user_id: int, query_embedding: List[float], top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for similar email threads using vector similarity

        Args:
            user_id: The ID of the user performing the search
            query_embedding: The embedding vector of the search query
            top_k: Number of results to return

        Returns:
            List of thread metadata ordered by relevance
        """
        try:
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                namespace=f"{PINECONE_NAMESPACE}_{user_id}",
                include_metadata=True,
            )

            # Format the results
            formatted_results = []
            for match in results["matches"]:
                # Convert participants back from JSON string
                participants = json.loads(match["metadata"].get("participants", "[]"))

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
                        "score": match["score"],  # Similarity score
                    }
                )

            return formatted_results

        except Exception as e:
            print(f"Error searching threads: {str(e)}")
            return []

    def get_stats(self) -> Dict[str, Any]:
        """Get stats about the Pinecone index"""
        try:
            return self.index.describe_index_stats()
        except Exception as e:
            print(f"Error getting index stats: {str(e)}")
            return {}


# Create a singleton instance
vector_db = VectorDBService()
