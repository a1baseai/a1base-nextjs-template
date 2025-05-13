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
  service text NULL,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.conversation_users(id)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages USING btree (external_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages USING btree (created_at);

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
  is_live boolean NULL,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS idx_projects_chat_id ON public.projects USING btree (chat_id);

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