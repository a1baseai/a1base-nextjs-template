-- To setup your Supabase database, copy and paste this SQL code into
-- https://app.supabase.io/project/YOUR_PROJECT_ID/settings/database/SQL

-- Table: conversation_users (no dependencies)
CREATE TABLE public.conversation_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    name text NULL,
    phone_number text NULL,  -- Changed to text for international format support
    service TEXT NULL,       -- Service identifier (e.g., 'whatsapp', 'telegram')
    metadata JSONB NULL      -- Additional user metadata from service
);

-- Table: chats (no dependencies)
CREATE TABLE public.chats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    type text NOT NULL CHECK (type IN ('individual', 'group')),
    name text NULL,        -- Optional name for group chats
    external_id TEXT NULL, -- External identifier (e.g., WhatsApp thread ID)
    service TEXT NULL,     -- Service identifier (e.g., 'whatsapp', 'telegram')
    metadata JSONB NULL    -- Additional chat metadata from service
);

-- Table: chat_participants (depends on chats and conversation_users)
CREATE TABLE public.chat_participants (
    chat_id uuid REFERENCES public.chats(id),
    user_id uuid REFERENCES public.conversation_users(id),
    PRIMARY KEY (chat_id, user_id)
);

-- Table: messages (depends on chats and conversation_users)
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid REFERENCES public.chats(id),
    sender_id uuid REFERENCES public.conversation_users(id),  -- NULL if sent by AI
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    message_type TEXT NULL,      -- Type of message (text, image, video, etc.)
    external_id TEXT NULL,       -- External message ID from the service
    rich_content JSONB NULL,     -- Rich content data (images, media, etc.)
    service TEXT NULL            -- Service the message came from
);

-- Table: cron_jobs (no dependencies)
CREATE TABLE public.cron_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name text NOT NULL,
    scheduled_time timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    result text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: user_preferences (depends on conversation_users)
CREATE TABLE public.user_preferences (
    user_id uuid PRIMARY KEY REFERENCES public.conversation_users(id),
    preferences jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Table: projects (depends on chats)
CREATE TABLE public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid REFERENCES public.chats(id),
    name text NOT NULL,
    description text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: project_history (depends on projects)
CREATE TABLE public.project_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id),
    event_type text NOT NULL,
    details text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for webhook data performance
CREATE INDEX idx_messages_external_id ON public.messages(external_id);
CREATE INDEX idx_chats_external_id ON public.chats(external_id);
CREATE INDEX idx_users_phone ON public.conversation_users(phone_number);

-- Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.conversation_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_history      ENABLE ROW LEVEL SECURITY;

-- Define RLS policies for each table

-- Policies for conversation_users
CREATE POLICY "conversation_users_select" 
  ON public.conversation_users
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "conversation_users_insert" 
  ON public.conversation_users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "conversation_users_update" 
  ON public.conversation_users
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Policies for chats
CREATE POLICY "chats_select" 
  ON public.chats
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "chats_insert" 
  ON public.chats
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "chats_update" 
  ON public.chats
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Policies for chat_participants
CREATE POLICY "chat_participants_select" 
  ON public.chat_participants
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "chat_participants_insert" 
  ON public.chat_participants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "chat_participants_update" 
  ON public.chat_participants
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Policies for messages
CREATE POLICY "messages_select" 
  ON public.messages
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "messages_insert" 
  ON public.messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "messages_update" 
  ON public.messages
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Policies for cron_jobs
CREATE POLICY "cron_jobs_select" 
  ON public.cron_jobs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "cron_jobs_insert" 
  ON public.cron_jobs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "cron_jobs_update" 
  ON public.cron_jobs
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Policies for user_preferences
CREATE POLICY "user_preferences_select" 
  ON public.user_preferences
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "user_preferences_insert" 
  ON public.user_preferences
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "user_preferences_update" 
  ON public.user_preferences
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Policies for projects
CREATE POLICY "projects_select" 
  ON public.projects
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "projects_insert" 
  ON public.projects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "projects_update" 
  ON public.projects
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Policies for project_history
CREATE POLICY "project_history_select" 
  ON public.project_history
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "project_history_insert" 
  ON public.project_history
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "project_history_update" 
  ON public.project_history
  FOR UPDATE
  TO anon, authenticated
  USING (true);