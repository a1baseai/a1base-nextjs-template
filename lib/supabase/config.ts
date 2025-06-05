import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './types'
import { SupabaseAdapter } from './adapter'

export { SupabaseAdapter }

/**
 * Environment variables for Supabase configuration
 * These should be set in your .env.local file
 */
const supabaseUrl = process.env.SUPABASE_URL
let supabaseKey = process.env.SUPABASE_KEY
let keySource = "SUPABASE_KEY";

if (!supabaseKey) {
  console.log("[SupabaseConfig] SUPABASE_KEY not found, attempting to use SUPABASE_ANON_KEY.");
  supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (supabaseKey) {
    keySource = "SUPABASE_ANON_KEY";
  } else {
    keySource = "None";
  }
}

if (supabaseUrl && supabaseKey) {
  console.log(`[SupabaseConfig] Using Supabase URL: ${supabaseUrl}`);
  console.log(`[SupabaseConfig] Using Supabase Key from: ${keySource}`);
} else {
  if (!supabaseUrl) {
    console.warn("[SupabaseConfig] SUPABASE_URL is not set in environment variables.");
  }
  if (!supabaseKey) {
    console.warn("[SupabaseConfig] Neither SUPABASE_KEY nor SUPABASE_ANON_KEY is set in environment variables.");
  }
}

/**
 * Export table names as constants to maintain consistency
 * across the application
 */
export const CONVERSATION_USERS_TABLE = 'conversation_users' as const
export const CHATS_TABLE = 'chats' as const

/**
 * Check if Supabase is configured in the environment
 */
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseKey
}

let initializedAdapter: SupabaseAdapter | null = null

/**
 * Initializes and returns the Supabase adapter instance.
 * Ensures that the adapter is initialized only once.
 */
export const getInitializedAdapter = async (): Promise<SupabaseAdapter | null> => {
  if (!isSupabaseConfigured()) {
    console.warn("[SupabaseAdapter] Initialization skipped: Supabase is not configured. Check SUPABASE_URL and SUPABASE_KEY/SUPABASE_ANON_KEY environment variables.");
    return null
  }

  if (initializedAdapter) {
    return initializedAdapter
  }

  try {
    const adapter = new SupabaseAdapter(supabaseUrl!, supabaseKey!)
    await adapter.init()
    initializedAdapter = adapter
    console.log("[SupabaseAdapter] Supabase adapter class instance initialized and ready.")
    return initializedAdapter
  } catch (error) {
    console.error("[SupabaseAdapter] Supabase adapter class instance failed to initialize:", error)
    return null
  }
}

/**
 * Initializes the database if Supabase is configured.
 * This function primarily demonstrates initializing the adapter.
 */
export async function initializeDatabase() {
  if (isSupabaseConfigured()) {
    await getInitializedAdapter()
  }
}

/**
 * Export a typed Supabase client for direct database operations
 * Only available if Supabase is configured
 */
export const supabase = isSupabaseConfigured() 
  ? createClient<Database>(supabaseUrl!, supabaseKey!)
  : null