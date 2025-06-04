-- To setup your Supabase database, copy and paste this SQL code into
-- https://app.supabase.io/project/YOUR_PROJECT_ID/settings/database/SQL

-- Note: Row Level Security (RLS) policies are already enabled on all
-- tables for authenticated users.

-- Create tables
CREATE TABLE public.conversation_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NULL,
  phone_number text NULL,
  service text NULL,
  metadata jsonb NULL,
  memory jsonb NULL DEFAULT '{}'::jsonb,
  CONSTRAINT conversation_users_pkey PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.conversation_users USING btree (phone_number);

CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  type text NOT NULL,
  name text NULL,
  external_id text NULL,
  service text NULL,
  metadata jsonb NULL,
  memory jsonb NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_type_check CHECK ((type = ANY (ARRAY['individual'::text, 'group'::text])))
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_chats_external_id ON public.chats USING btree (external_id);

CREATE TABLE public.chat_participants (
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT chat_participants_pkey PRIMARY KEY (chat_id, user_id),
  CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conversation_users(id)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON public.chat_participants USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON public.chat_participants USING btree (user_id);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NULL,
  sender_id uuid NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  message_type text NULL,
  external_id text NULL,
  rich_content jsonb NULL,
  service text NULL DEFAULT 'whatsapp',
  status text NULL DEFAULT 'sent',
  status_updated_at timestamp with time zone NULL,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.conversation_users(id)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages USING btree (external_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_service ON public.messages USING btree (service);

CREATE TABLE public.cron_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  scheduled_time timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  result text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cron_jobs_pkey PRIMARY KEY (id)
) WITH (OIDS=FALSE);

CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conversation_users(id)
) WITH (OIDS=FALSE);

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NULL,
  name text NOT NULL,
  description text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_live boolean NULL DEFAULT true,
  attributes jsonb NULL DEFAULT '{}'::jsonb,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_projects_chat_id ON public.projects USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_projects_chat_live_created ON public.projects (chat_id, is_live, created_at);
CREATE INDEX IF NOT EXISTS idx_projects_is_live ON public.projects USING btree (is_live);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.project_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NULL,
  event_type text NOT NULL,
  details text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_history_pkey PRIMARY KEY (id),
  CONSTRAINT project_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_project_history_project_id ON public.project_history USING btree (project_id);

-- Project events table for tracking actions/tasks
CREATE TABLE public.project_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  event_type text NOT NULL,
  description text NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_events_pkey PRIMARY KEY (id),
  CONSTRAINT project_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_project_events_project_id ON public.project_events USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_project_events_created_at ON public.project_events USING btree (created_at);

-- Email scheduled reports table
CREATE TABLE public.email_scheduled_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  scheduled_time time NOT NULL DEFAULT '09:00'::time,
  timezone text NOT NULL DEFAULT 'UTC',
  is_active boolean NOT NULL DEFAULT true,
  report_type text NOT NULL DEFAULT 'project_status',
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_sent_at timestamp with time zone NULL,
  next_send_at timestamp with time zone NULL,
  CONSTRAINT email_scheduled_reports_pkey PRIMARY KEY (id),
  CONSTRAINT email_scheduled_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conversation_users(id) ON DELETE CASCADE
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_email_scheduled_reports_user_id ON public.email_scheduled_reports USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_scheduled_reports_is_active ON public.email_scheduled_reports USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_email_scheduled_reports_next_send ON public.email_scheduled_reports USING btree (next_send_at) WHERE is_active = true;

-- Add trigger to update updated_at timestamp for scheduled reports
CREATE TRIGGER update_email_scheduled_reports_updated_at BEFORE UPDATE ON public.email_scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email report history table
CREATE TABLE public.email_report_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scheduled_report_id uuid NULL,
  email_address text NOT NULL,
  report_type text NOT NULL,
  frequency text NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  subject text NULL,
  error_message text NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_report_history_pkey PRIMARY KEY (id),
  CONSTRAINT email_report_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conversation_users(id) ON DELETE CASCADE,
  CONSTRAINT email_report_history_scheduled_report_id_fkey FOREIGN KEY (scheduled_report_id) REFERENCES public.email_scheduled_reports(id) ON DELETE SET NULL
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_email_report_history_user_id ON public.email_report_history USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_report_history_sent_at ON public.email_report_history USING btree (sent_at);
CREATE INDEX IF NOT EXISTS idx_email_report_history_status ON public.email_report_history USING btree (status);