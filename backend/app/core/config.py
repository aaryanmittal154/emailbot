import os
from typing import List

# Update import to use pydantic-settings
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Manual parsing for ACCESS_TOKEN_EXPIRE_MINUTES
# Get raw value first
raw_expire_minutes = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200")
# Remove any comments if present
if raw_expire_minutes and "#" in raw_expire_minutes:
    raw_expire_minutes = raw_expire_minutes.split("#")[0].strip()
# Set as integer
ACCESS_TOKEN_EXPIRE_MINUTES_INT = int(raw_expire_minutes)


class Settings(BaseSettings):
    # App settings
    PROJECT_NAME: str = "Superconnector Email API"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = ENVIRONMENT == "development"
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://emailbot-ten.vercel.app")
    CORS_ORIGINS: List[str] = [
        "https://emailbot-ten.vercel.app",  # Frontend dev server
        "https://localhost:8080",  # Production deployment
        FRONTEND_URL,  # Dynamic frontend URL
    ]

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./test.db")

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey")
    # Use our manually parsed value to avoid .env loading issues
    ACCESS_TOKEN_EXPIRE_MINUTES: int = ACCESS_TOKEN_EXPIRE_MINUTES_INT

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "https://emailbot-k8s7.onrender.com/api/auth/callback"
    )

    # Google API - Official Gmail API scopes from the documentation
    GOOGLE_SCOPES: List[str] = [
        "https://www.googleapis.com/auth/gmail.readonly",  # View email messages and settings
        "https://www.googleapis.com/auth/gmail.send",  # Send email on user's behalf
        "openid",  # OpenID Connect
        "https://www.googleapis.com/auth/userinfo.email",  # View email address
        "profile",  # View basic profile info
    ]

    # Update Config to model_config for Pydantic v2
    model_config = {
        "case_sensitive": True,
        "env_file": None,  # Don't use Pydantic's .env loading
        "extra": "ignore",  # Ignore extra fields in the .env file
    }


settings = Settings()
