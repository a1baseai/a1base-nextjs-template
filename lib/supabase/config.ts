import { createClient } from '@supabase/supabase-js'
import { Database } from './types'
import { SupabaseAdapter } from './adapter'

/**
 * Environment variables for Supabase configuration
 * These should be set in your .env.local file
 */
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

/**
 * Export table names as constants to maintain consistency
 * across the application
 */
export const CONVERSATION_USERS_TABLE = 'conversation_users' as const
export const CHATS_TABLE = 'chats' as const

// Track the initialized adapter instance
let initializedAdapter: SupabaseAdapter | null = null

/**
 * Check if Supabase is configured in the environment
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey)
}

/**
 * Initialize and get the Supabase adapter instance if configured
 * Returns null if Supabase is not configured
 */
export async function initializeDatabase(): Promise<SupabaseAdapter | null> {
  // If already initialized, return the existing instance
  if (initializedAdapter) {
    return initializedAdapter
  }

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, using in-memory storage')
    return null
  }

  try {
    console.log('Initializing Supabase connection...')
    const adapter = new SupabaseAdapter(supabaseUrl!, supabaseKey!)
    await adapter.init()
    
    // Store the initialized instance
    initializedAdapter = adapter
    console.log('Successfully initialized Supabase database')
    return adapter
  } catch (error) {
    console.error('Failed to initialize Supabase adapter:', error)
    return null
  }
}

/**
 * Get the initialized adapter instance or null if not initialized
 * This should be used after initializeDatabase() has been called
 */
export function getInitializedAdapter(): SupabaseAdapter | null {
  return initializedAdapter
}

/**
 * Export a typed Supabase client for direct database operations
 * Only available if Supabase is configured
 */
export const supabase = isSupabaseConfigured() 
  ? createClient<Database>(supabaseUrl!, supabaseKey!)
  : null 