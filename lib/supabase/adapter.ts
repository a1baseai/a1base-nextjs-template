import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './types'
import { CONVERSATION_USERS_TABLE, CHATS_TABLE } from './config'

/**
 * SupabaseAdapter class provides an interface for database operations
 * using Supabase as the backend database.
 */
// Import WebhookPayload type
import { WebhookPayload } from '@/app/api/messaging/incoming/route'

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
      const { error: userTableError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select('id')
        .limit(1);

      if (userTableError && userTableError.code !== 'PGRST116') {
        // Table does not exist, create it
        await this.createUsersTable();
      }

      const { error: threadsTableError } = await this.supabase
        .from(CHATS_TABLE)
        .select('id')
        .limit(1);

      if (threadsTableError && threadsTableError.code !== 'PGRST116') {
        // Table does not exist, create it
        await this.createThreadsTable();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize SupabaseAdapter:', error);
      throw error;
    }
  }

  private async createUsersTable(): Promise<void> {
    const { error } = await this.supabase.rpc('create_users_table');
    if (error) {
      console.error('Error creating users table:', error);
      throw error;
    }
  }

  private async createThreadsTable(): Promise<void> {
    const { error } = await this.supabase.rpc('create_threads_table');
    if (error) {
      console.error('Error creating threads table:', error);
      throw error;
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
        .from(CONVERSATION_USERS_TABLE)
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
  
  /**
   * Get or create a user from webhook payload
   */
  async getUserFromWebhook(
    senderNumber: string, 
    senderName: string, 
    service: string,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    this.ensureInitialized();
    
    // Remove + from phone number for consistent storage
    const normalizedNumber = senderNumber.replace(/\+/g, "");
    
    try {
      // First try to find existing user
      const { data: existingUser, error: findError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select('id')
        .eq('phone_number', normalizedNumber)
        .single();
      
      if (!findError && existingUser) {
        return existingUser.id;
      }
      
      // Create new user if not found
      const { data: newUser, error: insertError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .insert({
          name: senderName,
          phone_number: normalizedNumber,
          service: service,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      return newUser.id;
    } catch (error) {
      console.error('Error in getUserFromWebhook:', error);
      return null;
    }
  }

  async updateUser(phoneNumber: number, updates: { name?: string }): Promise<boolean> {
    this.ensureInitialized()
    try {
      const { error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
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
        .from(CONVERSATION_USERS_TABLE)
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
   * Thread/Chat Operations
   */

  async createThread(threadId: string, messages: Record<string, unknown>[] = [], participants: Record<string, unknown>[] = [], threadType: string = 'chat'): Promise<string | null> {
    this.ensureInitialized()
    try {
      // First create the chat entry
      const { data, error } = await this.supabase
        .from(CHATS_TABLE)
        .insert({
          id: threadId,
          type: threadType,
          name: '', // Default name
          external_id: threadId, // Use threadId as external_id for consistency
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) throw error
      
      // Then add any messages to the messages table
      if (messages.length > 0) {
        const messagesWithChatId = messages.map(message => ({
          chat_id: data.id,
          content: typeof message.text === 'string' ? message.text : JSON.stringify(message),
          created_at: new Date().toISOString()
        }))
        
        const { error: messagesError } = await this.supabase
          .from('messages')
          .insert(messagesWithChatId)
        
        if (messagesError) throw messagesError
      }

      return data.id
    } catch (error) {
      console.error('Error creating thread:', error)
      return null
    }
  }

  async getThread(threadId: string) {
    this.ensureInitialized()
    try {
      // Get the chat data
      const { data: chatData, error: chatError } = await this.supabase
        .from(CHATS_TABLE)
        .select('*')
        .eq('id', threadId)
        .single()

      if (chatError) throw chatError
      
      // Get the messages for this chat
      const { data: messagesData, error: messagesError } = await this.supabase
        .from('messages')
        .select('*')
        .eq('chat_id', threadId)
        .order('created_at', { ascending: true })
      
      if (messagesError) throw messagesError
      
      // Combine the data
      return {
        ...chatData,
        messages: messagesData || []
      }
    } catch (error) {
      console.error('Error getting thread:', error)
      return null
    }
  }

  async updateThreadMessages(threadId: string, messages: Record<string, unknown>[]): Promise<boolean> {
    this.ensureInitialized()
    try {
      // Delete existing messages for this thread
      const { error: deleteError } = await this.supabase
        .from('messages')
        .delete()
        .eq('chat_id', threadId)
      
      if (deleteError) throw deleteError
      
      // Insert new messages
      if (messages.length > 0) {
        const messagesWithChatId = messages.map(message => ({
          chat_id: threadId,
          content: typeof message.text === 'string' ? message.text : JSON.stringify(message),
          created_at: new Date().toISOString()
        }))
        
        const { error: insertError } = await this.supabase
          .from('messages')
          .insert(messagesWithChatId)
        
        if (insertError) throw insertError
      }

      return true
    } catch (error) {
      console.error('Error updating thread messages:', error)
      return false
    }
  }

  async updateThreadParticipants(threadId: string, participants: Record<string, unknown>[]): Promise<boolean> {
    this.ensureInitialized()
    try {
      const { error } = await this.supabase
        .from(CHATS_TABLE)
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
  
  /**
   * Get or create a chat from webhook payload
   */
  async getChatFromWebhook(
    threadId: string,
    threadType: string,
    service: string,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    this.ensureInitialized();
    
    try {
      // First try to find existing chat by external_id
      const { data: existingChat, error: findError } = await this.supabase
        .from('chats')
        .select('id')
        .eq('external_id', threadId)
        .single();
      
      if (!findError && existingChat) {
        return existingChat.id;
      }
      
      // Create new chat if not found
      const { data: newChat, error: insertError } = await this.supabase
        .from('chats')
        .insert({
          external_id: threadId,
          type: threadType,
          service: service,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      return newChat.id;
    } catch (error) {
      console.error('Error in getChatFromWebhook:', error);
      return null;
    }
  }
  
  /**
   * Add participant to chat
   */
  async addParticipantToChat(chatId: string, userId: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      // Check if participant already exists
      const { data: existingParticipant, error: findError } = await this.supabase
        .from('chat_participants')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .single();
      
      if (!findError && existingParticipant) {
        // Already exists
        return true;
      }
      
      // Add participant
      const { error: insertError } = await this.supabase
        .from('chat_participants')
        .insert({
          chat_id: chatId,
          user_id: userId
        });
      
      if (insertError) throw insertError;
      return true;
    } catch (error) {
      console.error('Error in addParticipantToChat:', error);
      return false;
    }
  }
  
  /**
   * Store message from webhook payload
   */
  async storeMessage(
    chatId: string,
    senderId: string | null,
    messageId: string,
    content: string,
    messageType: string,
    service: string,
    richContent: Record<string, any>
  ): Promise<string | null> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          external_id: messageId,
          content: content,
          message_type: messageType,
          service: service,
          rich_content: richContent,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error in storeMessage:', error);
      return null;
    }
  }
  
  /**
   * Process entire webhook payload
   */
  async processWebhookPayload(payload: WebhookPayload): Promise<boolean> {
    try {
      // 1. Get or create user
      const userId = await this.getUserFromWebhook(
        payload.sender_number, 
        payload.sender_name,
        payload.service,
        { a1_account_id: payload.a1_account_id }
      );
      
      if (!userId) throw new Error("Failed to get or create user");
      
      // 2. Get or create chat
      const chatId = await this.getChatFromWebhook(
        payload.thread_id,
        payload.thread_type,
        payload.service,
        { a1_account_id: payload.a1_account_id }
      );
      
      if (!chatId) throw new Error("Failed to get or create chat");
      
      // 3. Add user as participant 
      const participantAdded = await this.addParticipantToChat(chatId, userId);
      if (!participantAdded) throw new Error("Failed to add participant to chat");
      
      // 4. Store the message
      const textContent = payload.message_content.text || '';
      const messageId = await this.storeMessage(
        chatId,
        userId,
        payload.message_id,
        textContent,
        payload.message_type,
        payload.service,
        payload.message_content
      );
      
      if (!messageId) throw new Error("Failed to store message");
      
      return true;
    } catch (error) {
      console.error('Error processing webhook payload:', error);
      return false;
    }
  }
} 