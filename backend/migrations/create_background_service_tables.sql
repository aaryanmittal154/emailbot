-- Migration for EmailBot Background Service
-- Creates the necessary tables to support 24/7 background auto-replies

-- Table for storing user preferences for background service
CREATE TABLE IF NOT EXISTS user_background_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  background_enabled BOOLEAN DEFAULT FALSE,
  schedule_start_time TIME,
  schedule_end_time TIME,
  active_days VARCHAR(255), -- e.g. "1,2,3,4,5" for weekdays
  max_daily_emails INTEGER DEFAULT 50,
  send_summary BOOLEAN DEFAULT TRUE,
  notify_important BOOLEAN DEFAULT TRUE,
  auto_pause_days INTEGER DEFAULT 7,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing OAuth refresh tokens securely
CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id VARCHAR(255) PRIMARY KEY,
  refresh_token VARCHAR(1024),
  access_token VARCHAR(1024),
  token_expiry TIMESTAMP,
  refresh_token_encrypted BOOLEAN DEFAULT TRUE,
  scope VARCHAR(1024),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for logging background service activity
CREATE TABLE IF NOT EXISTS background_service_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL, -- e.g. "token_refresh", "email_check", "auto_reply"
  status VARCHAR(255) NOT NULL, -- e.g. "success", "error"
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying logs by user and date
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON background_service_logs (user_id, DATE(created_at));

-- Index for querying logs by event type
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON background_service_logs (event_type);

-- Add foreign key constraints if users table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE user_background_preferences 
      ADD CONSTRAINT fk_user_preferences_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      
    ALTER TABLE oauth_tokens 
      ADD CONSTRAINT fk_oauth_tokens_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      
    ALTER TABLE background_service_logs 
      ADD CONSTRAINT fk_background_logs_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;
