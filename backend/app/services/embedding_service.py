from openai import OpenAI
import tiktoken
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Constants
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_ENCODING = "cl100k_base"
EMBEDDING_DIMENSIONS = 3072  # Dimensions for text-embedding-3-large
MAX_TOKENS = 8191  # Max tokens for the model


def get_token_count(text: str) -> int:
    """Count the number of tokens in a text string"""
    encoding = tiktoken.get_encoding(EMBEDDING_ENCODING)
    return len(encoding.encode(text))


class EmbeddingService:
    """Service for generating and managing embeddings"""

    def __init__(self):
        """Initialize the embedding service"""
        self.client = client
        self.model_name = EMBEDDING_MODEL
        self.encoding_name = EMBEDDING_ENCODING
        self.dimensions = EMBEDDING_DIMENSIONS
        self.max_tokens = MAX_TOKENS

    def get_token_count(self, text: str) -> int:
        """Count the number of tokens in a text string"""
        encoding = tiktoken.get_encoding(self.encoding_name)
        return len(encoding.encode(text))

    def format_thread_for_embedding(self, thread: Dict[str, Any]) -> str:
        """
        Format an email thread into a structured text for embedding.
        Creates a context that represents the full conversation thread.
        Preserves as much of the original email content as possible within token limits.
        """
        subject = thread.get("subject", "(No Subject)")

        # Give subject more weight by repeating it and including it in different ways
        formatted_text = f"Thread Subject: {subject}\n"
        formatted_text += f"Email Subject: {subject}\n"
        formatted_text += f"Topic: {subject}\n"
        formatted_text += f"About: {subject}\n\n"

        # Add participants
        participants = thread.get("participants", [])
        if participants:
            formatted_text += "Participants: " + ", ".join(participants) + "\n\n"

        # Add messages in chronological order
        messages = thread.get("messages", [])
        for i, message in enumerate(messages):
            # Format date
            date = message.get("date", "")
            if date:
                try:
                    # Convert ISO string to datetime for better formatting
                    date_obj = datetime.fromisoformat(date.replace("Z", "+00:00"))
                    formatted_date = date_obj.strftime("%Y-%m-%d %H:%M:%S")
                except:
                    formatted_date = date
            else:
                formatted_date = "(no date)"

            # Add message details
            formatted_text += f"--- Message {i+1} ---\n"
            formatted_text += f"From: {message.get('sender', '(unknown)')}\n"
            formatted_text += f"Date: {formatted_date}\n"

            # Add recipients if available
            recipients = message.get("recipients", [])
            if recipients:
                formatted_text += "To: " + ", ".join(recipients) + "\n"

            # Include subject for each message to enhance its weight in the embedding
            formatted_text += f"Subject: {subject}\n"

            # Add message body
            body = message.get("body", "").strip()
            if body:
                formatted_text += f"Content:\n{body}\n\n"
            else:
                formatted_text += "Content: (empty)\n\n"

        # Check token count and truncate if necessary
        token_count = self.get_token_count(formatted_text)
        if token_count > self.max_tokens:
            # Truncate text to fit within token limit
            # This is a simple approach; a more sophisticated approach would be to
            # preserve the most important parts (e.g., keep subject, latest messages)
            encoding = tiktoken.get_encoding(self.encoding_name)
            tokens = encoding.encode(formatted_text)
            # Keep a small buffer to ensure we don't exceed the limit
            safe_limit = self.max_tokens - 100
            truncated_tokens = tokens[:safe_limit]
            formatted_text = encoding.decode(truncated_tokens)
            formatted_text += "\n\n[Content truncated due to length]"

        return formatted_text

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate an embedding vector for the given text using OpenAI's API.

        Args:
            text: The text to embed

        Returns:
            Embedding vector as a list of floats
        """
        try:
            # Call the OpenAI API to generate embedding
            response = self.client.embeddings.create(input=text, model=self.model_name)

            # Extract the embedding vector
            embedding = response.data[0].embedding

            return embedding

        except Exception as e:
            print(f"Error generating embedding: {str(e)}")
            # Return a zero vector as fallback
            return [0.0] * self.dimensions

    def process_thread_for_semantic_search(
        self, thread: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a complete email thread for semantic search by:
        1. Formatting the thread into structured text
        2. Creating an embedding vector
        3. Returning the thread data enhanced with the embedding

        Args:
            thread: Email thread data

        Returns:
            Thread data with embedding
        """
        # Format the thread text
        thread_text = self.format_thread_for_embedding(thread)

        # Generate embedding
        embedding = self.generate_embedding(thread_text)

        # Add embedding to thread data
        result = {
            **thread,
            "embedding": embedding,
            "embedding_model": self.model_name,
            "token_count": self.get_token_count(thread_text),
            "text_content": thread_text,  # Add the formatted text content for Pinecone
        }

        return result


# For backward compatibility, provide standalone functions that use the class internally
_service = EmbeddingService()


def format_thread_for_embedding(thread: Dict[str, Any]) -> str:
    """
    Format an email thread into a structured text for embedding.
    Creates a context that represents the full conversation thread.
    Preserves as much of the original email content as possible within token limits.
    """
    return _service.format_thread_for_embedding(thread)


def create_thread_embedding(thread_text: str) -> List[float]:
    """
    Generate an embedding vector for the given thread text using OpenAI's API.
    """
    return _service.generate_embedding(thread_text)


def process_thread_for_semantic_search(thread: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a complete email thread for semantic search by:
    1. Formatting the thread into structured text
    2. Creating an embedding vector
    3. Returning the thread data enhanced with the embedding
    """
    return _service.process_thread_for_semantic_search(thread)
