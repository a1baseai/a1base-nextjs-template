/**
 * Interface for database adapters used in the A1 Framework
 * Defines the contract that any database implementation must fulfill
 */
export interface DatabaseAdapterInterface {
  /**
   * Create a new user in the database
   * @param name User's display name
   * @param phoneNumber User's phone number
   * @returns User ID if successful, null if failed
   */
  createUser: (name: string, phoneNumber: string) => Promise<string | null>;
  
  /**
   * Update an existing user's information
   * @param phoneNumber User's phone number
   * @param updates Object containing fields to update
   * @returns Success status
   */
  updateUser: (
    phoneNumber: string,
    updates: { name?: string; metadata?: Record<string, any> }
  ) => Promise<boolean>;
  
  /**
   * Get a user by their phone number
   * @param phoneNumber User's phone number
   * @returns User object if found, null if not
   */
  getUserByPhone: (phoneNumber: string) => Promise<{ name: string; metadata?: Record<string, any> } | null>;
  
  /**
   * Process a webhook payload and store its data
   * @param payload Webhook payload containing message data
   * @returns Object containing success status and whether the chat is new
   */
  processWebhookPayload: (payload: any) => Promise<{ success: boolean; isNewChat: boolean }>;
  
  /**
   * Get thread data by its external ID
   * @param threadId External thread ID
   * @returns Thread data if found, null if not
   */
  getThread: (threadId: string) => Promise<any | null>;

  /**
   * Update the messages in a thread
   * @param threadId External ID of the thread
   * @param messages Array of messages to store
   * @returns Success status
   */
  updateThreadMessages: (threadId: string, messages: any[]) => Promise<boolean>;

  /**
   * Update the participants in a thread
   * @param threadId External ID of the thread
   * @param participants Array of participants to store
   * @returns Success status
   */
  updateThreadParticipants: (threadId: string, participants: any[]) => Promise<boolean>;

  /**
   * Create a new thread with initial messages and participants
   * @param threadId External ID for the thread
   * @param messages Initial messages for the thread
   * @param participants Initial participants in the thread
   * @param threadType Type of thread (e.g., 'individual', 'group')
   * @returns Thread ID if successful, null if failed
   */
  createThread: (
    threadId: string, 
    messages: any[], 
    participants: any[], 
    threadType: string
  ) => Promise<string | null>;
}
