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
      users: {
        Row: {
          id: string  // uuid stored as string
          created_at: string  // timestamptz stored as ISO string
          name: string | null
          phone_number: number | null  // numeric stored as number
        }
        Insert: {
          id?: string
          created_at?: string
          name?: string | null
          phone_number?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string | null
          phone_number?: number | null
        }
      }
      threads: {
        Row: {
          id: string  // uuid stored as string
          created_at: string  // timestamptz stored as ISO string
          messages: Json | null  // jsonb stored as Json type
          participants: Json | null  // jsonb stored as Json type
        }
        Insert: {
          id?: string
          created_at?: string
          messages?: Json | null
          participants?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          messages?: Json | null
          participants?: Json | null
        }
      }
    }
  }
} 