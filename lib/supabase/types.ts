export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Database schema types for our Supabase implementation
 * This provides type safety for our database operations
 */
export interface Database {
  public: {
    Tables: {
      conversation_users: {
        Row: {
          id: string  // uuid stored as string
          created_at: string  // timestamptz stored as ISO string
          name: string | null
          phone_number: string | null  // stored as text
          service: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          name?: string | null
          phone_number?: string | null
          service?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string | null
          phone_number?: string | null
          service?: string | null
          metadata?: Json | null
        }
      }
      chats: {
        Row: {
          id: string  // uuid stored as string
          created_at: string  // timestamptz stored as ISO string
          external_id: string | null
          type: string | null
          name: string | null
          service: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          external_id?: string | null
          type?: string | null
          name?: string | null
          service?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          external_id?: string | null
          type?: string | null
          name?: string | null
          service?: string | null
          metadata?: Json | null
        }
      }
      chat_participants: {
        Row: {
          chat_id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          user_id: string
        }
        Update: {
          chat_id?: string
          user_id?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string | null
          external_id: string | null
          content: string | null
          message_type: string | null
          service: string | null
          rich_content: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id?: string | null
          external_id?: string | null
          content?: string | null
          message_type?: string | null
          service?: string | null
          rich_content?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string | null
          external_id?: string | null
          content?: string | null
          message_type?: string | null
          service?: string | null
          rich_content?: Json | null
          created_at?: string
        }
      }
    }
  }
}

// Interfaces moved from adapter.ts for better organization

/**
 * Interface for participant data in a thread
 */
export interface ThreadParticipant extends Record<string, unknown> {
  user_id: string;
  phone_number: string;
  name: string;
  service?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  preferences?: Record<string, any>;
}

/**
 * Interface for message data in a thread
 */
export interface ThreadMessage extends Record<string, unknown> {
  message_id: string;
  external_id?: string;
  content: string;
  message_type: string;
  message_content: Record<string, any>;
  service?: string;
  sender_id?: string;
  sender_number: string;
  sender_name: string;
  sender_service?: string;
  sender_metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Interface for project data associated with a thread
 */
export interface ThreadProject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  is_live?: boolean;
}

/**
 * Interface for thread data returned by getThread
 */
export interface ThreadData {
  id: string;
  external_id?: string;
  type?: string;
  name?: string;
  service?: string;
  created_at?: string;
  metadata?: Record<string, any>;
  messages: ThreadMessage[];
  participants: ThreadParticipant[];
  projects: ThreadProject[];
  sender?: ThreadParticipant | null;
}