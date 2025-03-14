from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
import os
import requests
from sqlalchemy import text

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


def store_refresh_token(user_id: str, refresh_token: str, db: Session = Depends(get_db)):
    """
    Store or update a user's refresh token for background service
    
    Args:
        user_id: User ID
        refresh_token: OAuth refresh token
        db: Database session
    """
    # Check if token exists for this user
    token = db.query(Token).filter(Token.user_id == user_id).first()
    
    if token:
        # Update existing token
        token.refresh_token = refresh_token
        token.updated_at = datetime.now(timezone.utc)
    else:
        # Create new token
        token = Token(
            user_id=user_id,
            refresh_token=refresh_token,
            updated_at=datetime.now(timezone.utc)
        )
        db.add(token)
    
    db.commit()
    return token


def refresh_token(refresh_token: str, db: Session = None) -> str:
    """
    Refresh a Google access token using the refresh token
    
    Args:
        refresh_token: OAuth refresh token
        db: Optional database session
    
    Returns:
        New access token
    """
    try:
        # Request new access token from Google
        response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
        )
        
        # Check for successful response
        if response.status_code != 200:
            raise Exception(f"Failed to refresh token: {response.text}")
            
        # Parse response
        data = response.json()
        access_token = data.get("access_token")
        
        if not access_token:
            raise Exception("No access token in response")
            
        # If DB session provided, update token in database
        if db:
            # Find user by refresh token
            token = db.query(Token).filter(Token.refresh_token == refresh_token).first()
            if token:
                token.access_token = access_token
                expiry = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600))
                token.token_expiry = expiry
                token.updated_at = datetime.now(timezone.utc)
                db.commit()
        
        return access_token
        
    except Exception as e:
        print(f"Error refreshing token: {str(e)}")
        raise e


def enable_background_service(user_id: str, db: Session = Depends(get_db)) -> bool:
    """
    Enable background service for a user
    
    Args:
        user_id: User ID
        db: Database session
    
    Returns:
        Success status
    """
    try:
        # Check if user has a refresh token
        token_query = text("SELECT 1 FROM tokens WHERE user_id = :user_id AND refresh_token IS NOT NULL")
        token = db.execute(token_query, {"user_id": user_id}).fetchone()
        
        if not token:
            # Also check the legacy oauth_tokens table
            token_query = text("SELECT 1 FROM oauth_tokens WHERE user_id = :user_id AND refresh_token IS NOT NULL")
            token = db.execute(token_query, {"user_id": user_id}).fetchone()
            
        if not token:
            return False
        
        # Create or update preferences
        query = text("""
        INSERT INTO user_background_preferences
        (user_id, background_enabled, created_at, updated_at)
        VALUES (:user_id, TRUE, NOW(), NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            background_enabled = TRUE,
            updated_at = NOW()
        """)
        
        db.execute(query, {"user_id": user_id})
        db.commit()
        
        return True
        
    except Exception as e:
        print(f"Error enabling background service: {str(e)}")
        return False


def disable_background_service(user_id: str, db: Session = Depends(get_db)) -> bool:
    """
    Disable background service for a user
    
    Args:
        user_id: User ID
        db: Database session
    
    Returns:
        Success status
    """
    try:
        # Update preferences to disable background service
        query = text("""
        INSERT INTO user_background_preferences
        (user_id, background_enabled, created_at, updated_at)
        VALUES (:user_id, FALSE, NOW(), NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            background_enabled = FALSE,
            updated_at = NOW()
        """)
        
        db.execute(query, {"user_id": user_id})
        db.commit()
        
        return True
        
    except Exception as e:
        print(f"Error disabling background service: {str(e)}")
        return False


def invalidate_refresh_token(user_id: str, db: Session = Depends(get_db)) -> bool:
    """
    Invalidate a user's refresh token without affecting background service status
    
    Args:
        user_id: User ID
        db: Database session
        
    Returns:
        bool: Whether the operation was successful
    """
    try:
        # Clear the refresh token from the tokens table
        query = text("""
        UPDATE tokens 
        SET refresh_token = NULL, updated_at = NOW()
        WHERE user_id = :user_id
        """)
        db.execute(query, {"user_id": user_id})
        
        # Clear legacy tokens from the oauth_tokens table
        legacy_query = text("""
        UPDATE oauth_tokens 
        SET refresh_token = NULL, updated_at = NOW()
        WHERE user_id = :user_id
        """)
        db.execute(legacy_query, {"user_id": user_id})
        
        # Get the background preferences
        query = text("""
        SELECT background_enabled
        FROM user_background_preferences
        WHERE user_id = :user_id
        """)
        result = db.execute(query, {"user_id": user_id}).fetchone()
        
        if result:
            background_enabled = result[0]
        else:
            background_enabled = False
        
        # Only preserve background_enabled if it was explicitly enabled by the user
        # Update the background preferences if necessary
        if not background_enabled:
            # If service was disabled, ensure tokens are completely cleared to prevent any processing
            clear_token_query = text("""
            DELETE FROM tokens WHERE user_id = :user_id
            """)
            db.execute(clear_token_query, {"user_id": user_id})
            
            clear_oauth_query = text("""
            DELETE FROM oauth_tokens WHERE user_id = :user_id
            """)
            db.execute(clear_oauth_query, {"user_id": user_id})
        
        db.commit()
        return True
        
    except Exception as e:
        print(f"Error invalidating refresh token: {str(e)}")
        return False


def update_background_preferences(
    user_id: str,
    background_enabled: bool = None,
    schedule_start_time: str = None,
    schedule_end_time: str = None,
    active_days: str = None,
    max_daily_emails: int = None,
    send_summary: bool = None,
    notify_important: bool = None,
    auto_pause_days: int = None,
    db: Session = Depends(get_db)
) -> bool:
    """
    Update background service preferences for a user
    
    Args:
        user_id: User ID
        background_enabled: Whether background service is enabled
        schedule_start_time: Daily start time (HH:MM:SS)
        schedule_end_time: Daily end time (HH:MM:SS)
        active_days: Active days (comma-separated 1-7 for Monday-Sunday)
        max_daily_emails: Maximum emails per day
        send_summary: Whether to send daily summary
        notify_important: Whether to notify of important replies
        auto_pause_days: Days of inactivity before auto-pause
        db: Database session
    
    Returns:
        Success status
    """
    try:
        # Prepare update fields
        update_fields = {}
        
        if background_enabled is not None:
            update_fields["background_enabled"] = background_enabled
            
        if schedule_start_time is not None:
            update_fields["schedule_start_time"] = schedule_start_time
            
        if schedule_end_time is not None:
            update_fields["schedule_end_time"] = schedule_end_time
            
        if active_days is not None:
            update_fields["active_days"] = active_days
            
        if max_daily_emails is not None:
            update_fields["max_daily_emails"] = max_daily_emails
            
        if send_summary is not None:
            update_fields["send_summary"] = send_summary
            
        if notify_important is not None:
            update_fields["notify_important"] = notify_important
            
        if auto_pause_days is not None:
            update_fields["auto_pause_days"] = auto_pause_days
            
        # Add updated_at timestamp
        update_fields["updated_at"] = datetime.now(timezone.utc)
        
        # If no updates needed, return success
        if not update_fields:
            return True
            
        # Check if record exists - use SQLAlchemy text() properly
        exists_query = text("SELECT 1 FROM user_background_preferences WHERE user_id = :user_id")
        exists = db.execute(exists_query, {"user_id": user_id}).fetchone()
        
        if exists:
            # Update existing record using SQLAlchemy text()
            set_parts = []
            params = {}
            
            # Build the SET clause and parameters
            for field, value in update_fields.items():
                set_parts.append(f"{field} = :{field}")
                params[field] = value
                
            # Add user_id to parameters
            params["user_id"] = user_id
            
            # Construct the full query
            update_query = text(f"""
                UPDATE user_background_preferences 
                SET {', '.join(set_parts)}
                WHERE user_id = :user_id
            """)
            
            # Execute the query with parameters
            db.execute(update_query, params)
            
        else:
            # Insert a new record using SQLAlchemy text()
            fields = ["user_id"] + list(update_fields.keys())
            value_placeholders = [f":{field}" for field in fields]
            
            # Prepare parameters
            params = {"user_id": user_id}
            for field, value in update_fields.items():
                params[field] = value
                
            # Construct the full query
            insert_query = text(f"""
                INSERT INTO user_background_preferences
                ({', '.join(fields)})
                VALUES ({', '.join(value_placeholders)})
            """)
            
            # Execute the query with parameters
            db.execute(insert_query, params)
            
        db.commit()
        return True
        
    except Exception as e:
        print(f"Error updating background preferences: {str(e)}")
        db.rollback()
        return False


def get_background_preferences(user_id: str, db: Session = Depends(get_db)):
    """
    Get background service preferences for a user
    
    Args:
        user_id: User ID
        db: Database session
    
    Returns:
        Preferences object or None
    """
    try:
        query = text("""
        SELECT *
        FROM user_background_preferences
        WHERE user_id = :user_id
        """)
        
        result = db.execute(query, {"user_id": user_id}).fetchone()
        
        if not result:
            # Return default preferences
            return {
                "user_id": user_id,
                "background_enabled": False,
                "schedule_start_time": None,
                "schedule_end_time": None,
                "active_days": "1,2,3,4,5,6,7",
                "max_daily_emails": 50,
                "send_summary": True,
                "notify_important": True,
                "auto_pause_days": 7,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        
        # Convert SQLAlchemy result to dictionary properly
        columns = result._mapping.keys()
        return {column: result[idx] for idx, column in enumerate(columns)}
        
    except Exception as e:
        print(f"Error getting background preferences: {str(e)}")
        return None
