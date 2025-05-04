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

  async createUser(name: string, phoneNumber: string): Promise<string | null> {
    this.ensureInitialized()
    try {
      const { data, error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .insert({ 
          name, 
          phone_number: phoneNumber,
          created_at: new Date().toISOString()
        })
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
      
      // Check if user exists - note single() throws error if no results
      if (!findError && existingUser) {
        console.log(`Found existing user with ID: ${existingUser.id}`);
        return existingUser.id;
      }
      
      console.log(`Creating new user with phone: ${normalizedNumber}`);
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
      
      if (insertError) {
        console.error('Error inserting new user:', insertError);
        throw insertError;
      }
      console.log(`Created new user with ID: ${newUser.id}`);
      return newUser.id;
    } catch (error) {
      console.error('Error in getUserFromWebhook:', error);
      return null;
    }
  }

  async updateUser(phoneNumber: string, updates: { name?: string }): Promise<boolean> {
    this.ensureInitialized()

    try {
      const { error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .update(updates)
        .eq('phone_number', phoneNumber)

      return !error
    } catch (error) {
      console.error('Error updating user:', error)
      return false
    }
  }

  async getUserByPhone(phoneNumber: string) {
    this.ensureInitialized()

    try {
      const { data, error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null
        }
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
      // First check if a thread with this ID already exists
      const { data: existingThread, error: findError } = await this.supabase
        .from(CHATS_TABLE)
        .select('id')
        .eq('id', threadId)
        .single()
      
      // If thread already exists, just return its ID
      if (!findError && existingThread) {
        console.log(`Thread ${threadId} already exists, skipping creation`);
        return existingThread.id;
      }
      
      // If error is not a "not found" error, it's a real error
      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }

      // Create the chat entry since it doesn't exist
      console.log(`Creating new thread with ID ${threadId}`);
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
      // First, find the chat by external_id with all its information
      const { data: chat, error: chatError } = await this.supabase
        .from('chats')
        .select('id, created_at, type, name, external_id, service, metadata')
        .eq('external_id', threadId)
        .single()

      // If chat not found, return null (it's a new thread)
      if (chatError) {
        if (chatError.code === 'PGRST116') {
          // No rows returned - this is a new thread, not an error
          return null;
        }
        throw chatError
      }

      // Get all messages for the thread with complete user information
      const { data: messages, error: messagesError } = await this.supabase
        .from('messages')
        .select(`
          id, chat_id, sender_id, content, created_at, message_type, external_id, rich_content, service,
          conversation_users:sender_id(id, created_at, name, phone_number, service, metadata)
        `)
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(40)
        .then(result => {
          // Reverse back to ascending order after getting the most recent 40
          if (result.data) {
            result.data = result.data.reverse();
          }
          return result;
        })

      if (messagesError) throw messagesError

      // Get participants for the thread with complete user information
      const { data: participants, error: participantsError } = await this.supabase
        .from('chat_participants')
        .select(`
          chat_id, user_id,
          conversation_users:user_id(id, created_at, name, phone_number, service, metadata)
        `)
        .eq('chat_id', chat.id)

      if (participantsError) throw participantsError

      // Get any projects associated with this chat
      const { data: projects, error: projectsError } = await this.supabase
        .from('projects')
        .select('id, name, description, created_at, is_live')
        .eq('chat_id', chat.id)

      if (projectsError) throw projectsError
    
      // Get user preferences for all participants
      const participantUserIds = participants.map((p: any) => p.user_id);
      let userPreferences: Array<{user_id: string, preferences: Record<string, any>}> = [];
      
      if (participantUserIds.length > 0) {
        const { data: preferences, error: preferencesError } = await this.supabase
          .from('user_preferences')
          .select('user_id, preferences')
          .in('user_id', participantUserIds)
        
        if (!preferencesError) {
          userPreferences = preferences || [];
        }
      }

      // Format the messages and participants with enhanced data
      const formattedMessages = messages.map((msg: any) => {
        // Log the raw message data for debugging
        console.log(`[DB Data Debug] Message raw data:`, JSON.stringify({
          id: msg.id,
          chat_id: msg.chat_id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          message_type: msg.message_type,
          external_id: msg.external_id,
          rich_content: msg.rich_content,
          service: msg.service,
          conversation_users: msg.conversation_users
        }, null, 2));
        
        const formattedMsg = {
          message_id: msg.id,
          external_id: msg.external_id,
          content: msg.content,
          message_type: msg.message_type,
          message_content: msg.rich_content,
          service: msg.service,
          sender_id: msg.sender_id,
          sender_number: msg.conversation_users?.phone_number || '',
          sender_name: msg.conversation_users?.name || '',
          sender_service: msg.conversation_users?.service || '',
          sender_metadata: msg.conversation_users?.metadata || {},
          timestamp: msg.created_at,
        };
        
        // Log the formatted message for comparison
        console.log(`[DB Data Debug] Formatted message data:`, JSON.stringify(formattedMsg, null, 2));
        
        return formattedMsg;
      })

      const formattedParticipants = participants.map((p: any) => {
        // Find preferences for this user if any
        const userPref = userPreferences.find((pref: any) => pref.user_id === p.user_id);
        
        // Log the raw participant data for debugging
        console.log(`[DB Data Debug] Participant raw data:`, JSON.stringify({
          chat_id: p.chat_id,
          user_id: p.user_id,
          conversation_users: p.conversation_users,
          preferences: userPref
        }, null, 2));
        
        const formattedParticipant = {
          user_id: p.user_id,
          phone_number: p.conversation_users?.phone_number || '',
          name: p.conversation_users?.name || '',
          service: p.conversation_users?.service || '',
          metadata: p.conversation_users?.metadata || {},
          created_at: p.conversation_users?.created_at,
          preferences: userPref?.preferences || {}
        };
        
        // Log the formatted participant for comparison
        console.log(`[DB Data Debug] Formatted participant data:`, JSON.stringify(formattedParticipant, null, 2));
        
        return formattedParticipant;
      })

      // Create the final thread object with all data
      const threadData = {
        id: chat.id,
        external_id: chat.external_id,
        type: chat.type,
        name: chat.name,
        service: chat.service,
        created_at: chat.created_at,
        metadata: chat.metadata,
        messages: formattedMessages,
        participants: formattedParticipants,
        projects: projects || []
      };
      
      // Log the complete thread data being returned
      console.log(`[DB Data Debug] Complete thread data overview:`);
      console.log(threadData)
      // console.log(`- Chat ID: ${threadData.id}`);
      // console.log(`- External ID: ${threadData.external_id}`);
      // console.log(`- Type: ${threadData.type}`);
      // console.log(`- Service: ${threadData.service}`);
      // console.log(`- Message count: ${threadData.messages.length}`);
      // console.log(`- Participant count: ${threadData.participants.length}`);
      // console.log(`- Projects count: ${threadData.projects.length}`);
      
      return threadData;
    } catch (error: any) { // Type error as any to access code property
      // Log errors, but don't log PGRST116 as an error since it's expected for new threads
      if (error.code !== 'PGRST116') {
        console.error('Error getting thread:', error)
      }
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
        const messagesWithChatId = messages.map(message => {
          // Extract message content
          const messageContent = message.message_content || message;
          
          return {
            chat_id: threadId,
            content: JSON.stringify(messageContent), // Store full message content as JSON string
            message_type: message.message_type || 'text',
            service: message.service || '',
            external_id: message.message_id || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            sender_id: message.sender_id || null,
            rich_content: messageContent,
            created_at: message.timestamp || new Date().toISOString()
          };
        });
        
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
      // First delete all existing participants for this chat
      const { error: deleteError } = await this.supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', threadId)
      
      if (deleteError) throw deleteError
      
      // If we have participants to add, insert them
      if (participants.length > 0) {
        // We need to find the user IDs for these participants
        const participantPromises = participants.map(async (participant) => {
          // If we already have a user_id, use it
          if (participant.user_id) {
            return { chat_id: threadId, user_id: participant.user_id };
          }
          
          // Otherwise, try to find by phone number
          if (participant.number) {
            const normalizedNumber = String(participant.number).replace(/\+/g, '');
            const { data, error } = await this.supabase
              .from(CONVERSATION_USERS_TABLE)
              .select('id')
              .eq('phone_number', normalizedNumber)
              .single();
              
            if (!error && data) {
              return { chat_id: threadId, user_id: data.id };
            }
          }
          
          return null;
        });
        
        // Wait for all participant lookups to complete
        const participantsToAdd = (await Promise.all(participantPromises))
          .filter(p => p !== null);
        
        // Add all participants if we found any
        if (participantsToAdd.length > 0) {
          const { error: insertError } = await this.supabase
            .from('chat_participants')
            .insert(participantsToAdd);
          
          if (insertError) throw insertError;
        }
      }
      
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
      console.log(`Looking for chat with external_id ${threadId}`);
      const { data: existingChat, error: findError } = await this.supabase
        .from('chats')
        .select('id')
        .eq('external_id', threadId)
        .single();
      
      if (!findError && existingChat) {
        console.log(`Found existing chat with ID ${existingChat.id}`);
        return existingChat.id;
      }
      
      if (findError && findError.code !== 'PGRST116') {
        // This is an error other than "not found"
        console.error(`Error finding chat for thread_id ${threadId}:`, findError);
        throw findError;
      }
      
      // At this point, we know the chat doesn't exist, so create a new one
      console.log(`Creating new chat for thread_id ${threadId}, type ${threadType}`);
      
      // Ensure thread type is one of the acceptable values for the CHECK constraint
      const validatedThreadType = ['individual', 'group'].includes(threadType) ? threadType : 'individual';
      
      const { data: newChat, error: insertError } = await this.supabase
        .from('chats')
        .insert({
          external_id: threadId,
          type: validatedThreadType,
          service: service,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error(`Error creating new chat: ${insertError.message}`);
        throw insertError;
      }
      
      console.log(`Successfully created new chat with ID ${newChat.id}`);
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
      // Check if participant already exists to avoid unique constraint violation
      console.log(`Checking if user ${userId} is already in chat ${chatId}`);
      const { data: existingParticipant, error: findError } = await this.supabase
        .from('chat_participants')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', userId);
      
      if (!findError && existingParticipant && existingParticipant.length > 0) {
        // Already exists
        console.log(`User ${userId} is already a participant in chat ${chatId}`);
        return true;
      }
      
      // Add participant
      console.log(`Adding user ${userId} to chat ${chatId}`);
      const { error: insertError } = await this.supabase
        .from('chat_participants')
        .insert({
          chat_id: chatId,
          user_id: userId
        });
      
      if (insertError) {
        console.error(`Error adding participant: ${insertError.message}`);
        throw insertError;
      }
      
      console.log(`Successfully added user ${userId} to chat ${chatId}`);
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
    content: Record<string, any>,
    messageType: string,
    service: string,
    richContent?: Record<string, any>
  ): Promise<string | null> {
    this.ensureInitialized();
    
    try {
      // Extract text content from the content object for the content field
      let textContent = content.text || '';
      if (typeof content === 'object' && Object.keys(content).length > 0) {
        // If it's an object with no text property, take first non-empty value or stringify
        if (!textContent) {
          for (const key in content) {
            if (content[key] && typeof content[key] === 'string') {
              textContent = content[key];
              break;
            }
          }
          
          // If still no text found, stringify the whole object
          if (!textContent) {
            textContent = JSON.stringify(content);
          }
        }
      }
      
      console.log(`Storing message in chat ${chatId} from sender ${senderId || 'unknown'}`);
      
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          external_id: messageId,
          content: textContent, // Store as plain text string
          message_type: messageType,
          service: service,
          rich_content: richContent || content, // Store JSON in rich_content
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Database error storing message:', error);
        throw error;
      }
      return data.id;
    } catch (error) {
      console.error('Error in storeMessage:', error);
      return null;
    }
  }
  
  /**
   * Project Operations
   */
  
  // Get projects for a chat
  async getProjectsByChat(chatId: string): Promise<any[]> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('chat_id', chatId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting projects by chat:', error);
      return [];
    }
  }
  
  // Create a new project
  async createProject(name: string, description: string, chatId: string): Promise<string | null> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .insert({
          name,
          description,
          chat_id: chatId,
          created_at: new Date().toISOString(),
          is_live: true
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating project:', error);
      return null;
    }
  }
  
  // Update an existing project
  async updateProject(projectId: string, updates: { is_live?: boolean, name?: string, description?: string }): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      console.log(`Updating project ${projectId} with:`, updates);
      const { error } = await this.supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);
      
      if (error) {
        console.error('Error updating project:', error);
        throw error;
      }
      console.log(`Successfully updated project ${projectId}`);
      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      return false;
    }
  }
  
  // Get a project by ID
  async getProjectById(projectId: string): Promise<any | null> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting project by ID:', error);
      return null;
    }
  }
  
  // Get all projects
  async getAllProjects(): Promise<any[]> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting all projects:', error);
      return [];
    }
  }
  
  // Log project history event
  async logProjectEvent(projectId: string, eventType: string, details: string): Promise<string | null> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('project_history')
        .insert({
          project_id: projectId,
          event_type: eventType,
          details,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error logging project event:', error);
      return null;
    }
  }

  /**
   * Process entire webhook payload
   */
  async processWebhookPayload(payload: WebhookPayload): Promise<boolean> {
    try {
      console.log(`Processing webhook for thread ${payload.thread_id} from ${payload.sender_number}`);
      
      // 1. Get or create user
      const userId = await this.getUserFromWebhook(
        payload.sender_number, 
        payload.sender_name,
        payload.service,
        { a1_account_id: payload.a1_account_id }
      );
      
      if (!userId) {
        console.error("Failed to get or create user");
        throw new Error("Failed to get or create user");
      }
      
      console.log(`User identified with ID: ${userId}`);
      
      // 2. Get or create chat
      const chatId = await this.getChatFromWebhook(
        payload.thread_id,
        payload.thread_type,
        payload.service,
        { a1_account_id: payload.a1_account_id }
      );
      
      if (!chatId) {
        console.error("Failed to get or create chat");
        throw new Error("Failed to get or create chat");
      }
      
      console.log(`Chat identified with ID: ${chatId}`);
      
      // 3. Add user as participant 
      const participantAdded = await this.addParticipantToChat(chatId, userId);
      if (!participantAdded) {
        console.error("Failed to add participant to chat");
        throw new Error("Failed to add participant to chat");
      }
      
      console.log(`Added user ${userId} as participant to chat ${chatId}`);
      
      // 4. Store the message
      const messageId = await this.storeMessage(
        chatId,
        userId,
        payload.message_id,
        payload.message_content,
        payload.message_type,
        payload.service
      );
      
      if (!messageId) {
        console.error("Failed to store message");
        throw new Error("Failed to store message");
      }
      
      console.log(`Successfully stored message with ID: ${messageId}`);
      
      return true;
    } catch (error) {
      console.error('Error processing webhook payload:', error);
      return false;
    }
  }
} 