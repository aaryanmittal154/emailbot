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


def format_thread_for_embedding(thread: Dict[str, Any]) -> str:
    """
    Format an email thread into a structured text for embedding.
    Creates a context that represents the full conversation thread.
    Preserves as much of the original email content as possible within token limits.
    """
    formatted_text = f"Thread Subject: {thread.get('subject', '(No Subject)')}\n\n"

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
        formatted_text += f"--- Message {i+1}/{len(messages)} ---\n"
        formatted_text += f"From: {message.get('sender', '(Unknown)')}\n"
        formatted_text += f"Date: {formatted_date}\n"
        formatted_text += f"{'Read' if message.get('is_read') else 'Unread'}\n"

        # Add message content (prefer full body if available, else snippet)
        if message.get("body"):
            # Strip HTML for cleaner text
            import re

            # More comprehensive HTML stripping
            body = re.sub(
                r"<style.*?>.*?</style>", "", message.get("body", ""), flags=re.DOTALL
            )
            body = re.sub(r"<script.*?>.*?</script>", "", body, flags=re.DOTALL)
            body = re.sub(r"<[^>]+>", " ", body)
            body = re.sub(r"&nbsp;", " ", body)
            body = re.sub(r"\s+", " ", body).strip()
            formatted_text += f"Content: {body}\n\n"
        else:
            formatted_text += f"Content: {message.get('snippet', '(No content)')}\n\n"

    # Check token count
    token_count = get_token_count(formatted_text)

    # If we're below the limit, we can return the full text
    if token_count <= MAX_TOKENS:
        return formatted_text

    # Otherwise, truncate while preserving structure
    encoding = tiktoken.get_encoding(EMBEDDING_ENCODING)
    tokens = encoding.encode(formatted_text)

    # Keep tokens up to MAX_TOKENS - 100 for safety
    truncated_tokens = tokens[: MAX_TOKENS - 100]
    formatted_text = encoding.decode(truncated_tokens)
    formatted_text += "...[truncated due to length]"

    return formatted_text


def create_thread_embedding(thread_text: str) -> List[float]:
    """
    Generate an embedding vector for the given thread text using OpenAI's API.
    """
    try:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL, input=thread_text, encoding_format="float"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error creating embedding: {str(e)}")
        # Return empty vector in case of error
        return [0] * EMBEDDING_DIMENSIONS


def process_thread_for_semantic_search(thread: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a complete email thread for semantic search by:
    1. Formatting the thread into structured text
    2. Creating an embedding vector
    3. Returning the thread data enhanced with the embedding
    """
    # Format thread into a structured text representation
    thread_text = format_thread_for_embedding(thread)

    # Generate embedding vector
    embedding = create_thread_embedding(thread_text)

    # Create a result object with thread info and embedding
    result = {
        "thread_id": thread.get("thread_id"),
        "subject": thread.get("subject", "(No Subject)"),
        "participants": thread.get("participants", []),
        "message_count": thread.get("message_count", 0),
        "last_updated": thread.get("last_updated"),
        "embedding": embedding,
        "text_content": thread_text,  # Store the text content for reference
    }

    return result
