-- Multimedia Support Migration for A1Framework
-- This migration adds support for storing multimedia messages in the database

-- Add media-specific columns to the messages table if they don't exist
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS media_url text NULL,
ADD COLUMN IF NOT EXISTS media_type text NULL CHECK (media_type IN ('image', 'video', 'audio', 'document', 'location')),
ADD COLUMN IF NOT EXISTS media_caption text NULL,
ADD COLUMN IF NOT EXISTS media_metadata jsonb NULL DEFAULT '{}'::jsonb;

-- Create an index on media_type for faster queries on media messages
CREATE INDEX IF NOT EXISTS idx_messages_media_type ON public.messages USING btree (media_type) WHERE media_type IS NOT NULL;

-- Create a table for storing media file metadata (optional, for advanced use cases)
CREATE TABLE IF NOT EXISTS public.media_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NULL,
  mime_type text NULL,
  thumbnail_url text NULL,
  duration_seconds integer NULL, -- for video/audio
  dimensions jsonb NULL, -- {"width": 1920, "height": 1080} for images/videos
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  CONSTRAINT media_files_pkey PRIMARY KEY (id),
  CONSTRAINT media_files_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE
) WITH (OIDS=FALSE);

-- Create indexes for media_files table
CREATE INDEX IF NOT EXISTS idx_media_files_message_id ON public.media_files USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON public.media_files USING btree (file_type);

-- Update the rich_content column to better support multimedia data
-- This is already a jsonb column, so we just need to document the expected structure
COMMENT ON COLUMN public.messages.rich_content IS 'Stores structured message content including multimedia data. Expected formats:
- Text: {"text": "message content"}
- Image: {"data": "base64_data", "caption": "optional caption"}
- Video: {"data": "base64_data", "caption": "optional caption"}
- Audio: {"data": "base64_data"}
- Document: {"data": "base64_data", "filename": "document.pdf", "caption": "optional caption"}
- Location: {"latitude": 0.0, "longitude": 0.0, "name": "Location Name", "address": "Full Address"}
- Media with URL: {"media_url": "https://...", "media_type": "image", "caption": "optional"}';

-- Add a function to extract media URLs from messages for analytics
CREATE OR REPLACE FUNCTION get_media_messages(
  p_chat_id uuid DEFAULT NULL,
  p_media_type text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  message_id uuid,
  chat_id uuid,
  sender_name text,
  media_type text,
  media_url text,
  caption text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.chat_id,
    u.name as sender_name,
    m.media_type,
    m.media_url,
    m.media_caption as caption,
    m.created_at
  FROM public.messages m
  LEFT JOIN public.conversation_users u ON m.sender_id = u.id
  WHERE 
    (p_chat_id IS NULL OR m.chat_id = p_chat_id)
    AND (p_media_type IS NULL OR m.media_type = p_media_type)
    AND m.media_type IS NOT NULL
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add a trigger to automatically extract media info from rich_content to dedicated columns
CREATE OR REPLACE FUNCTION extract_media_info()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract media information from rich_content if present
  IF NEW.rich_content IS NOT NULL THEN
    -- Check for media_url in rich_content
    IF NEW.rich_content->>'media_url' IS NOT NULL THEN
      NEW.media_url := NEW.rich_content->>'media_url';
      NEW.media_type := NEW.rich_content->>'media_type';
      NEW.media_caption := NEW.rich_content->>'caption';
    END IF;
    
    -- Handle location messages
    IF NEW.message_type = 'location' AND NEW.rich_content->>'latitude' IS NOT NULL THEN
      NEW.media_type := 'location';
      -- Store location data in media_metadata
      NEW.media_metadata := jsonb_build_object(
        'latitude', NEW.rich_content->>'latitude',
        'longitude', NEW.rich_content->>'longitude',
        'name', NEW.rich_content->>'name',
        'address', NEW.rich_content->>'address'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS extract_media_info_trigger ON public.messages;
CREATE TRIGGER extract_media_info_trigger
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION extract_media_info();

-- Add RLS policies for the media_files table
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view media files
CREATE POLICY "Users can view media files" ON public.media_files
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy for authenticated users to insert media files
CREATE POLICY "Users can insert media files" ON public.media_files
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Add helpful views for media analytics
CREATE OR REPLACE VIEW media_message_stats AS
SELECT 
  chat_id,
  media_type,
  COUNT(*) as message_count,
  MIN(created_at) as first_media_at,
  MAX(created_at) as last_media_at
FROM public.messages
WHERE media_type IS NOT NULL
GROUP BY chat_id, media_type;

-- Grant permissions on the new view
GRANT SELECT ON media_message_stats TO authenticated; 