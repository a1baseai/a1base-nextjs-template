-- Email-Specific Schema for A1Framework
-- This creates dedicated tables for email handling with proper structure

-- 1. Email threads table (groups emails by conversation)
CREATE TABLE public.email_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  sender_email text NOT NULL,
  recipient_email text NOT NULL,
  subject text NULL, -- Initial subject, may change in thread
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'spam')),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT email_threads_pkey PRIMARY KEY (id)
);

-- Indexes for email threads
CREATE INDEX idx_email_threads_sender ON public.email_threads USING btree (sender_email);
CREATE INDEX idx_email_threads_recipient ON public.email_threads USING btree (recipient_email);
CREATE INDEX idx_email_threads_updated ON public.email_threads USING btree (updated_at DESC);

-- 2. Email messages table
CREATE TABLE public.email_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  email_id text NOT NULL UNIQUE, -- External email ID from webhook
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address text NOT NULL,
  to_address text NOT NULL,
  cc_addresses text[] DEFAULT ARRAY[]::text[],
  bcc_addresses text[] DEFAULT ARRAY[]::text[],
  subject text NOT NULL,
  body_text text NULL, -- Plain text version
  body_html text NULL, -- HTML version
  raw_email text NULL, -- Complete raw email data
  headers jsonb DEFAULT '{}'::jsonb, -- Parsed email headers
  metadata jsonb DEFAULT '{}'::jsonb, -- Additional metadata
  is_read boolean DEFAULT false,
  is_replied boolean DEFAULT false,
  replied_at timestamp with time zone NULL,
  CONSTRAINT email_messages_pkey PRIMARY KEY (id),
  CONSTRAINT email_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.email_threads(id) ON DELETE CASCADE
);

-- Indexes for email messages
CREATE INDEX idx_email_messages_thread_id ON public.email_messages USING btree (thread_id);
CREATE INDEX idx_email_messages_email_id ON public.email_messages USING btree (email_id);
CREATE INDEX idx_email_messages_created_at ON public.email_messages USING btree (created_at DESC);
CREATE INDEX idx_email_messages_from ON public.email_messages USING btree (from_address);
CREATE INDEX idx_email_messages_direction ON public.email_messages USING btree (direction);

-- 3. Email attachments table (for future use)
CREATE TABLE public.email_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  filename text NOT NULL,
  content_type text NULL,
  size_bytes bigint NULL,
  url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT email_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.email_messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_email_attachments_message_id ON public.email_attachments USING btree (message_id);

-- 4. Update thread timestamp trigger
CREATE OR REPLACE FUNCTION update_email_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_threads 
  SET updated_at = NOW() 
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_timestamp
AFTER INSERT ON email_messages
FOR EACH ROW
EXECUTE FUNCTION update_email_thread_timestamp();

-- 5. Function to get or create email thread
CREATE OR REPLACE FUNCTION get_or_create_email_thread(
  p_sender_email text,
  p_recipient_email text,
  p_subject text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  -- Look for existing thread between these two parties
  SELECT id INTO v_thread_id
  FROM email_threads
  WHERE 
    ((sender_email = p_sender_email AND recipient_email = p_recipient_email)
    OR (sender_email = p_recipient_email AND recipient_email = p_sender_email))
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- Create new thread if not found
  IF v_thread_id IS NULL THEN
    INSERT INTO email_threads (sender_email, recipient_email, subject)
    VALUES (p_sender_email, p_recipient_email, p_subject)
    RETURNING id INTO v_thread_id;
  END IF;
  
  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to store email message
CREATE OR REPLACE FUNCTION store_email_message(
  p_thread_id uuid,
  p_email_id text,
  p_direction text,
  p_from_address text,
  p_to_address text,
  p_subject text,
  p_body_text text,
  p_raw_email text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_message_id uuid;
BEGIN
  INSERT INTO email_messages (
    thread_id, email_id, direction, from_address, to_address, 
    subject, body_text, raw_email, metadata
  )
  VALUES (
    p_thread_id, p_email_id, p_direction, p_from_address, p_to_address,
    p_subject, p_body_text, p_raw_email, p_metadata
  )
  RETURNING id INTO v_message_id;
  
  -- Mark as replied if this is an outbound message
  IF p_direction = 'outbound' THEN
    UPDATE email_messages 
    SET is_replied = true, replied_at = NOW()
    WHERE thread_id = p_thread_id 
      AND direction = 'inbound' 
      AND is_replied = false;
  END IF;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- 7. View for email conversations with last message
CREATE OR REPLACE VIEW email_conversations_view AS
SELECT 
  t.id as thread_id,
  t.sender_email,
  t.recipient_email,
  t.subject as thread_subject,
  t.status,
  t.created_at as thread_started,
  t.updated_at as last_activity,
  COUNT(m.id) as message_count,
  COUNT(CASE WHEN m.direction = 'inbound' AND NOT m.is_read THEN 1 END) as unread_count,
  (
    SELECT jsonb_build_object(
      'id', last_msg.id,
      'subject', last_msg.subject,
      'from', last_msg.from_address,
      'preview', LEFT(last_msg.body_text, 100),
      'created_at', last_msg.created_at,
      'direction', last_msg.direction
    )
    FROM email_messages last_msg
    WHERE last_msg.thread_id = t.id
    ORDER BY last_msg.created_at DESC
    LIMIT 1
  ) as last_message
FROM email_threads t
LEFT JOIN email_messages m ON t.id = m.thread_id
GROUP BY t.id;

-- 8. Full-text search for emails
CREATE OR REPLACE FUNCTION search_emails(
  p_search_term text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  message_id uuid,
  thread_id uuid,
  subject text,
  from_address text,
  to_address text,
  body_preview text,
  created_at timestamp with time zone,
  direction text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.thread_id,
    m.subject,
    m.from_address,
    m.to_address,
    LEFT(m.body_text, 200) as body_preview,
    m.created_at,
    m.direction
  FROM email_messages m
  WHERE 
    m.subject ILIKE '%' || p_search_term || '%'
    OR m.body_text ILIKE '%' || p_search_term || '%'
    OR m.from_address ILIKE '%' || p_search_term || '%'
    OR m.to_address ILIKE '%' || p_search_term || '%'
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 9. Enable RLS
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies (adjust based on your auth strategy)
CREATE POLICY "Users can view email threads" ON public.email_threads
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create email threads" ON public.email_threads
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update email threads" ON public.email_threads
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view email messages" ON public.email_messages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create email messages" ON public.email_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view email attachments" ON public.email_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.email_threads TO authenticated;
GRANT SELECT, INSERT ON public.email_messages TO authenticated;
GRANT SELECT ON public.email_attachments TO authenticated;
GRANT SELECT ON email_conversations_view TO authenticated; 