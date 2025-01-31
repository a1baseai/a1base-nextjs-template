import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './types'
import { USERS_TABLE, THREADS_TABLE } from './config'

/**
 * SupabaseAdapter class provides an interface for database operations
 * using Supabase as the backend database.
 */
export class SupabaseAdapter {
  private supabase: SupabaseClient<Database>
  private isInitialized: boolean = false

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey)
  }

  /**
   * Initialize the adapter
   */
  async init(): Promise<void> {
    try {
      const { error } = await this.supabase.from(USERS_TABLE).select('id').limit(1)
      if (error && error.code !== 'PGRST116') { // Ignore "no rows returned" error
        throw error
      }
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize SupabaseAdapter:', error)
      throw error
    }
  }

  /**
   * Ensure the adapter is initialized before performing operations
   */
  private ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('SupabaseAdapter must be initialized before use. Call init() first.')
    }
  }

  /**
   * User Operations
   */

  async createUser(name: string, phoneNumber: number): Promise<string | null> {
    this.ensureInitialized()
    try {
      const { data, error } = await this.supabase
        .from(USERS_TABLE)
        .insert({ name, phone_number: phoneNumber })
        .select('id')
        .single()

      if (error) throw error
      return data.id
    } catch (error) {
      console.error('Error creating user:', error)
      return null
    }
  }
  // Note: Users are only saved when they send a message in a chat
  // Update to pull participants from a group chat coming soon.

  async updateUser(phoneNumber: number, updates: { name?: string }): Promise<boolean> {
    this.ensureInitialized()
    try {
      const { error } = await this.supabase
        .from(USERS_TABLE)
        .update(updates)
        .eq('phone_number', phoneNumber)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating user:', error)
      return false
    }
  }

  async getUserByPhone(phoneNumber: number) {
    this.ensureInitialized()
    try {
      const { data, error } = await this.supabase
        .from(USERS_TABLE)
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      return data
    } catch (error) {
      console.error('Error getting user by phone:', error)
      return null
    }
  }

  /**
   * Thread Operations 
   */

  async createThread(threadId: string, messages: any[], participants: any[]): Promise<string | null> {
    this.ensureInitialized()
    try {
      const { data, error } = await this.supabase
        .from(THREADS_TABLE)
        .insert({
          id: threadId,
          messages,
          participants
        })
        .select('id')
        .single()

      if (error) throw error
      return data.id
    } catch (error) {
      console.error('Error creating thread:', error)
      return null
    }
  }

  async getThread(threadId: string) {
    this.ensureInitialized()
    try {
      const { data, error } = await this.supabase
        .from(THREADS_TABLE)
        .select('*')
        .eq('id', threadId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      return data
    } catch (error) {
      console.error('Error getting thread:', error)
      return null
    }
  }

  async updateThreadMessages(threadId: string, messages: any[]): Promise<boolean> {
    this.ensureInitialized()
    try {
      const { error } = await this.supabase
        .from(THREADS_TABLE)
        .update({ 
          messages,
          created_at: new Date().toISOString()
        })
        .eq('id', threadId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating thread messages:', error)
      return false
    }
  }

  async updateThreadParticipants(threadId: string, participants: any[]): Promise<boolean> {
    this.ensureInitialized()
    try {
      const { error } = await this.supabase
        .from(THREADS_TABLE)
        .update({ 
          participants,
          created_at: new Date().toISOString()
        })
        .eq('id', threadId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating thread participants:', error)
      return false
    }
  }
} 