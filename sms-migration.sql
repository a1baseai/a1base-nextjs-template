-- SMS Migration for A1Base Framework
-- Run this SQL in your Supabase database to add SMS support to an existing installation
-- https://app.supabase.io/project/YOUR_PROJECT_ID/settings/database/SQL

-- Add service column to messages table if not exists
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS service VARCHAR(20) DEFAULT 'whatsapp';

-- Add message status tracking columns
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for service-based queries (improves performance)
CREATE INDEX IF NOT EXISTS idx_messages_service ON messages(service);

-- Optional: Update existing messages to explicitly set service as whatsapp
-- This ensures consistency if you have existing messages without a service value
UPDATE messages 
SET service = 'whatsapp' 
WHERE service IS NULL;

-- Verify the migration was successful
-- You should see the new columns: service, status, status_updated_at
SELECT 
  column_name, 
  data_type, 
  column_default
FROM 
  information_schema.columns 
WHERE 
  table_name = 'messages' 
  AND column_name IN ('service', 'status', 'status_updated_at')
ORDER BY 
  column_name; 