-- Migration to add full_content column to email_metadata table
ALTER TABLE email_metadata ADD COLUMN IF NOT EXISTS full_content TEXT;
