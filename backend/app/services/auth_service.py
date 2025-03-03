from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
import os
import requests

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.models.token import Token
from app.schemas.token import TokenData

# OAuth2 scheme for token verification
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

    return encoded_jwt


def get_token_data(token: str = Depends(oauth2_scheme)):
    """Verify token and extract token data"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        print(f"Attempting to decode token: {token[:10]}...")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        print(f"Token decoded - email: {email}, user_id: {user_id}")

        if email is None or user_id is None:
            print("Token missing email or user_id")
            raise credentials_exception

        token_data = TokenData(email=email, user_id=user_id)
        return token_data
    except JWTError as e:
        print(f"JWT Error: {str(e)}")
        raise credentials_exception


def get_current_user(
    token_data: TokenData = Depends(get_token_data), db: Session = Depends(get_db)
):
    """Get current user from token data"""
    print(f"Looking up user with ID: {token_data.user_id}")
    user = db.query(User).filter(User.id == token_data.user_id).first()

    if user is None:
        print(f"User not found with ID: {token_data.user_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    print(f"User found: {user.email}")
    return user


def get_google_creds(user_id: int, db: Session = Depends(get_db)):
    """Get Google credentials for a user"""
    from google.oauth2.credentials import Credentials

    print(f"Getting Google credentials for user ID: {user_id}")
    # Get the token from the database
    token = db.query(Token).filter(Token.user_id == user_id).first()

    if not token:
        print(f"No token found for user ID: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Google credentials found for this user",
        )

    # Check if token is expired
    if token.is_expired():
        print(f"Token expired for user ID: {user_id}, attempting to refresh")

        # Try to refresh the token
        if token.refresh_token:
            try:
                # Make a request to the Google OAuth token endpoint
                refresh_data = {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": token.refresh_token,
                    "grant_type": "refresh_token",
                }

                response = requests.post(
                    "https://oauth2.googleapis.com/token", data=refresh_data
                )

                if response.status_code == 200:
                    token_data = response.json()

                    # Update the token in the database
                    token.access_token = token_data["access_token"]
                    # Calculate new expiry time (default to 1 hour if not provided)
                    expires_in = token_data.get("expires_in", 3600)
                    token.expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=expires_in
                    )

                    db.commit()
                    print(f"Successfully refreshed token for user ID: {user_id}")
                else:
                    print(f"Failed to refresh token: {response.text}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Failed to refresh Google token, please login again",
                    )
            except Exception as e:
                print(f"Error refreshing token: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Error refreshing Google token, please login again",
                )
        else:
            print(f"No refresh token available for user ID: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google token expired and no refresh token available, please login again",
            )

    print(f"Successfully retrieved Google credentials for user ID: {user_id}")
    # Create Google credentials object
    creds = Credentials(
        token=token.access_token,
        refresh_token=token.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )

    return creds
