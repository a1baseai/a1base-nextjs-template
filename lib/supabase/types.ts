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