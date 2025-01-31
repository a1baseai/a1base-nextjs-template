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
          id: string
          created_at: string
          name: string | null
          phone_number: number | null
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
          id: string
          created_at: string
          messages: Json | null
          participants: Json | null
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