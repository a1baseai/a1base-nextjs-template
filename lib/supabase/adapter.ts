import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  Database,
  ThreadParticipant,
  ThreadMessage,
  ThreadProject,
  ThreadData,
} from "./types";
import { CONVERSATION_USERS_TABLE, CHATS_TABLE } from "./config";

/**
 * SupabaseAdapter class provides an interface for database operations
 * using Supabase as the backend database.
 */
// Import WebhookPayload type
import { WebhookPayload } from "@/app/api/a1base/messaging/route";
const MAX_CONTEXT_MESSAGES = 30;

/**
 * SupabaseAdapter class provides an interface for database operations
 * using Supabase as the backend database.
 */
export class SupabaseAdapter {
  public readonly supabase: SupabaseClient<Database>;
  public isInitialized: boolean = false;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Initialize the adapter
   */
  async init(): Promise<void> {
    try {
      const { error: userTableError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select("id")
        .limit(1);

      if (userTableError && userTableError.code !== "PGRST116") {
        // Table does not exist, create it
        await this.createUsersTable();
      }

      const { error: threadsTableError } = await this.supabase
        .from(CHATS_TABLE)
        .select("id")
        .limit(1);

      if (threadsTableError && threadsTableError.code !== "PGRST116") {
        // Table does not exist, create it
        await this.createThreadsTable();
      }

      this.isInitialized = true;
    } catch (error) {
      // Console error removed
      throw error;
    }
  }

  private async createUsersTable(): Promise<void> {
    const { error } = await this.supabase.rpc("create_users_table");
    if (error) {
      // Console error removed
      throw error;
    }
  }

  private async createThreadsTable(): Promise<void> {
    const { error } = await this.supabase.rpc("create_threads_table");
    if (error) {
      // Console error removed
      throw error;
    }
  }

  /**
   * Ensure the adapter is initialized before performing operations
   */
  private ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error(
        "SupabaseAdapter must be initialized before use. Call init() first."
      );
    }
  }

  /**
   * User Operations
   */

  async createUser(name: string, phoneNumber: string): Promise<string | null> {
    this.ensureInitialized();
    try {
      const { data, error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .insert({
          name,
          phone_number: phoneNumber,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      // Console error removed
      return null;
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
        .select("id")
        .eq("phone_number", normalizedNumber)
        .single();

      // Check if user exists - note single() throws error if no results
      if (!findError && existingUser) {
        // Console log removed
        return existingUser.id;
      }

      // Console log removed
      // Create new user if not found
      const { data: newUser, error: insertError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .insert({
          name: senderName,
          phone_number: normalizedNumber,
          service: service,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        // Console error removed
        throw insertError;
      }
      // Console log removed
      return newUser.id;
    } catch (error) {
      // Console error removed
      return null;
    }
  }

  async updateUser(
    phoneNumber: string,
    updates: { name?: string; metadata?: any }
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Handle metadata updates specially to merge with existing metadata
      if (updates.metadata) {
        // First get the current user data
        const { data: userData, error: fetchError } = await this.supabase
          .from(CONVERSATION_USERS_TABLE)
          .select("metadata")
          .eq("phone_number", phoneNumber)
          .single();

        if (fetchError) {
          // Console error removed
          return false;
        }

        // Merge existing metadata with new metadata
        const mergedMetadata = {
          ...(userData?.metadata || {}),
          ...updates.metadata,
        };

        // Update with merged metadata
        updates.metadata = mergedMetadata;
      }

      const { error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .update(updates)
        .eq("phone_number", phoneNumber);

      return !error;
    } catch (error) {
      // Console error removed
      return false;
    }
  }

  async getUserByPhone(phoneNumber: string) {
    this.ensureInitialized();

    try {
      const { data, error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select("*")
        .eq("phone_number", phoneNumber)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      // Console error removed
      return null;
    }
  }

  /**
   * Thread/Chat Operations
   */

  async createThread(
    threadId: string,
    messages: Record<string, unknown>[] = [],
    participants: Record<string, unknown>[] = [],
    threadType: string = "chat"
  ): Promise<string | null> {
    this.ensureInitialized();
    try {
      // First check if a thread with this ID already exists
      const { data: existingThread, error: findError } = await this.supabase
        .from(CHATS_TABLE)
        .select("id")
        .eq("id", threadId)
        .single();

      // If thread already exists, just return its ID
      if (!findError && existingThread) {
        // Console log removed
        return existingThread.id;
      }

      // If error is not a "not found" error, it's a real error
      if (findError && findError.code !== "PGRST116") {
        throw findError;
      }

      // Create the chat entry since it doesn't exist
      // Console log removed
      const { data, error } = await this.supabase
        .from(CHATS_TABLE)
        .insert({
          id: threadId,
          type: threadType,
          name: "", // Default name
          external_id: threadId, // Use threadId as external_id for consistency
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      // Then add any messages to the messages table
      if (messages.length > 0) {
        const messagesWithChatId = messages.map((message) => ({
          chat_id: data.id,
          content:
            typeof message.text === "string"
              ? message.text
              : JSON.stringify(message),
          created_at: new Date().toISOString(),
        }));

        const { error: messagesError } = await this.supabase
          .from("messages")
          .insert(messagesWithChatId);

        if (messagesError) throw messagesError;
      }

      return data.id;
    } catch (error) {
      // Console error removed
      return null;
    }
  }

  /**
   * Get thread data including messages, participants, and sender information
   * @param threadId External ID of the thread to retrieve
   * @returns ThreadData object or null if thread not found
   */
  async getThread(threadId: string): Promise<ThreadData | null> {
    this.ensureInitialized();

    try {
      // First, find the chat by external_id with all its information
      const { data: chat, error: chatError } = await this.supabase
        .from("chats")
        .select("id, created_at, type, name, external_id, service, metadata")
        .eq("external_id", threadId)
        .maybeSingle(); // Changed from .single() to handle duplicates gracefully

      // If chat not found, return null (it's a new thread)
      if (chatError) {
        if (chatError.code === "PGRST116") {
          // No rows returned - this is a new thread, not an error
          return null;
        }
        throw chatError;
      }

      // If multiple chats found (shouldn't happen after fix), use the first one
      if (!chat) {
        return null;
      }

      // Get all messages for the thread with complete user information
      const { data: messages, error: messagesError } = await this.supabase
        .from("messages")
        .select(
          `
          id, chat_id, sender_id, content, created_at, message_type, external_id, rich_content, service, media_type, media_caption,
          conversation_users:sender_id(id, created_at, name, phone_number, service, metadata)
        `
        )
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: false })
        .limit(MAX_CONTEXT_MESSAGES)
        .then((result) => {
          if (result.data) {
            // Reverse the array to have newest messages at the bottom
            result.data = result.data.reverse();
          }
          return result;
        });

      // console.log("messages from adapter", messages);

      if (messagesError) throw messagesError;

      // Get participants for the thread with complete user information
      const { data: participants, error: participantsError } =
        await this.supabase
          .from("chat_participants")
          .select(
            `
          chat_id, user_id,
          conversation_users:user_id(id, created_at, name, phone_number, service, metadata)
        `
          )
          .eq("chat_id", chat.id);

      if (participantsError) throw participantsError;

      // Get any projects associated with this chat
      const { data: projects, error: projectsError } = await this.supabase
        .from("projects")
        .select("id, name, description, created_at, is_live")
        .eq("chat_id", chat.id);

      if (projectsError) throw projectsError;

      // Get user preferences for all participants
      const participantUserIds = participants.map((p: any) => p.user_id);
      let userPreferences: Array<{
        user_id: string;
        preferences: Record<string, any>;
      }> = [];

      if (participantUserIds.length > 0) {
        const { data: preferences, error: preferencesError } =
          await this.supabase
            .from("user_preferences")
            .select("user_id, preferences")
            .in("user_id", participantUserIds);

        if (!preferencesError) {
          userPreferences = preferences || [];
        }
      }

      // Format the messages and participants with enhanced data
      const formattedMessages = messages.map((msg: any) => {
        // Log the raw message data for debugging
        // Console log removed - [DB Data Debug] Message raw data
        const rawData = {
          id: msg.id,
          chat_id: msg.chat_id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          message_type: msg.message_type,
          external_id: msg.external_id,
          rich_content: msg.rich_content,
          service: msg.service,
          conversation_users: msg.conversation_users,
        };

        // Create safe content for AI context - avoid large base64 data
        let safeContent = msg.content;
        if (msg.message_type && ['image', 'video', 'audio', 'document'].includes(msg.message_type)) {
          if (msg.media_caption) {
            safeContent = `[${msg.message_type.charAt(0).toUpperCase() + msg.message_type.slice(1)} received: ${msg.media_caption}]`;
          } else {
            safeContent = `[${msg.message_type.charAt(0).toUpperCase() + msg.message_type.slice(1)} received]`;
          }
        } else if (msg.message_type === 'location') {
          safeContent = '[Location shared]';
        }

        const formattedMsg = {
          message_id: msg.id,
          external_id: msg.external_id,
          content: safeContent, // Use the safe content here
          message_type: msg.message_type,
          message_content: msg.rich_content,
          service: msg.service,
          sender_id: msg.sender_id,
          sender_number: msg.conversation_users?.phone_number || "",
          sender_name: msg.conversation_users?.name || "",
          sender_service: msg.conversation_users?.service || "",
          sender_metadata: msg.conversation_users?.metadata || {},
          timestamp: msg.created_at,
        };

        // Log the formatted message for comparison
        // Console log removed - Formatted message data

        return formattedMsg;
      });

      const formattedParticipants = participants.map((p: any) => {
        // Find preferences for this user if any
        const userPref = userPreferences.find(
          (pref: any) => pref.user_id === p.user_id
        );

        // Log the raw participant data for debugging
        // Console log removed - [DB Data Debug] Participant raw data
        const rawParticipantData = {
          chat_id: p.chat_id,
          user_id: p.user_id,
          conversation_users: p.conversation_users,
          preferences: userPref,
        };

        const formattedParticipant = {
          user_id: p.user_id,
          phone_number: p.conversation_users?.phone_number || "",
          name: p.conversation_users?.name || "",
          service: p.conversation_users?.service || "",
          metadata: p.conversation_users?.metadata || {},
          created_at: p.conversation_users?.created_at,
          preferences: userPref?.preferences || {},
        };

        // Log the formatted participant for comparison
        // Console log removed - Formatted participant data

        return formattedParticipant;
      });

      // Determine the current sender from participants
      let currentSender = null;
      const agentNumber =
        process.env.A1BASE_AGENT_NUMBER?.replace(/\+/g, "") || "";

      if (formattedParticipants.length > 0) {
        if (chat.type === "individual") {
          // For individual chats, find the non-agent participant (assuming agent is one of the participants)
          currentSender = formattedParticipants.find(
            (p) => p.phone_number.replace(/\+/g, "") !== agentNumber
          );
        } else if (chat.type === "group") {
          // For group chats, use the most recent message to determine who sent it
          if (formattedMessages.length > 0) {
            const mostRecentMessage =
              formattedMessages[formattedMessages.length - 1];
            currentSender = formattedParticipants.find(
              (p) => p.phone_number === mostRecentMessage.sender_number
            );
          }
        }

        // If we still don't have a sender, just use the first participant as a fallback
        if (!currentSender && formattedParticipants.length > 0) {
          currentSender = formattedParticipants[0];
        }
      }

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
        projects: projects || [],
        // Include current sender information for easy access
        sender: currentSender,
      };

      // Log the complete thread data being returned
      // Console log already commented out - Complete thread data overview
      // Console log already commented out - threadData
      // Console log already commented out - Chat ID
      // Console log already commented out - External ID
      // Console log already commented out - Type
      // Console log already commented out - Service
      // Console log already commented out - Message count
      // Console log already commented out - Participant count
      // Console log already commented out - Projects count

      return threadData;
    } catch (error: any) {
      // Type error as any to access code property
      // Log errors, but don't log PGRST116 as an error since it's expected for new threads
      if (error.code !== "PGRST116") {
        // Console error removed
      }
      return null;
    }
  }

  async updateThreadMessages(
    threadId: string,
    messages: Record<string, unknown>[]
  ): Promise<boolean> {
    this.ensureInitialized();
    try {
      // Delete existing messages for this thread
      const { error: deleteError } = await this.supabase
        .from("messages")
        .delete()
        .eq("chat_id", threadId);

      if (deleteError) throw deleteError;

      // Insert new messages
      if (messages.length > 0) {
        const messagesWithChatId = messages.map((message) => {
          // Extract message content
          const messageContent = message.message_content || message;

          return {
            chat_id: threadId,
            content: JSON.stringify(messageContent), // Store full message content as JSON string
            message_type: message.message_type || "text",
            service: message.service || "",
            external_id:
              message.message_id ||
              `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            sender_id: message.sender_id || null,
            rich_content: messageContent,
            created_at: message.timestamp || new Date().toISOString(),
          };
        });

        const { error: insertError } = await this.supabase
          .from("messages")
          .insert(messagesWithChatId);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      // Console error removed
      return false;
    }
  }

  async updateThreadParticipants(
    threadId: string,
    participants: Record<string, unknown>[]
  ): Promise<boolean> {
    this.ensureInitialized();
    try {
      // First delete all existing participants for this chat
      const { error: deleteError } = await this.supabase
        .from("chat_participants")
        .delete()
        .eq("chat_id", threadId);

      if (deleteError) throw deleteError;

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
            const normalizedNumber = String(participant.number).replace(
              /\+/g,
              ""
            );
            const { data, error } = await this.supabase
              .from(CONVERSATION_USERS_TABLE)
              .select("id")
              .eq("phone_number", normalizedNumber)
              .single();

            if (!error && data) {
              return { chat_id: threadId, user_id: data.id };
            }
          }

          return null;
        });

        // Wait for all participant lookups to complete
        const participantsToAdd = (
          await Promise.all(participantPromises)
        ).filter((p) => p !== null);

        // Add all participants if we found any
        if (participantsToAdd.length > 0) {
          const { error: insertError } = await this.supabase
            .from("chat_participants")
            .insert(participantsToAdd);

          if (insertError) throw insertError;
        }
      }

      return true;
    } catch (error) {
      // Console error removed
      return false;
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
      // Console log removed
      const { data: existingChat, error: findError } = await this.supabase
        .from("chats")
        .select("id")
        .eq("external_id", threadId)
        .maybeSingle(); // Changed from .single() to handle duplicates gracefully

      if (!findError && existingChat) {
        // Console log removed
        return existingChat.id;
      }

      if (findError && findError.code !== "PGRST116") {
        // This is an error other than "not found"
        // Console error removed
        console.error("Error finding existing chat:", findError);
        // Don't throw here, try to continue with creation
      }

      // At this point, we know the chat doesn't exist, so create a new one
      // Console log removed

      // Ensure thread type is one of the acceptable values for the CHECK constraint
      const validatedThreadType = ["individual", "group"].includes(threadType)
        ? threadType
        : "individual";

      const { data: newChat, error: insertError } = await this.supabase
        .from("chats")
        .insert({
          external_id: threadId,
          type: validatedThreadType,
          service: service,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        // Check if this is a unique constraint violation (duplicate external_id)
        if (insertError.code === "23505" || insertError.message?.includes("duplicate key")) {
          // Another request created the chat while we were trying, fetch it now
          console.log("Concurrent chat creation detected, fetching existing chat");
          
          const { data: existingChatRetry, error: retryError } = await this.supabase
            .from("chats")
            .select("id")
            .eq("external_id", threadId)
            .maybeSingle();
          
          if (!retryError && existingChatRetry) {
            return existingChatRetry.id;
          }
        }
        
        // Console error removed
        console.error("Error creating chat:", insertError);
        console.error("Error details:", {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          attemptedData: {
            external_id: threadId,
            type: validatedThreadType,
            service: service,
            metadata: metadata
          }
        });
        throw insertError;
      }

      // Console log removed
      return newChat.id;
    } catch (error) {
      // Console error removed
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
      // Console log removed
      const { data: existingParticipant, error: findError } =
        await this.supabase
          .from("chat_participants")
          .select("*")
          .eq("chat_id", chatId)
          .eq("user_id", userId);

      if (!findError && existingParticipant && existingParticipant.length > 0) {
        // Already exists
        // Console log removed
        return true;
      }

      // Add participant
      // Console log removed
      const { error: insertError } = await this.supabase
        .from("chat_participants")
        .insert({
          chat_id: chatId,
          user_id: userId,
        });

      if (insertError) {
        // Console error removed
        throw insertError;
      }

      // Console log removed
      return true;
    } catch (error) {
      // Console error removed
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
      console.log("Storing message:", {
        chatId,
        senderId,
        messageId,
        messageType,
        service,
      });
      console.log("Message content:", content);

      // Extract text content from the content object for the content field
      let textContent = content.text || "";
      
      // For multimedia messages, don't store base64 data in content field
      if (messageType && ['image', 'video', 'audio', 'document'].includes(messageType)) {
        // Create a descriptive text instead of storing base64 data
        if (content.caption) {
          textContent = `[${messageType.charAt(0).toUpperCase() + messageType.slice(1)} received: ${content.caption}]`;
        } else {
          textContent = `[${messageType.charAt(0).toUpperCase() + messageType.slice(1)} received]`;
        }
      } else if (messageType === 'location') {
        // Handle location messages
        if (content.name) {
          textContent = `[Location shared: ${content.name}]`;
        } else {
          textContent = `[Location shared]`;
        }
      } else if (typeof content === "object" && Object.keys(content).length > 0) {
        // If it's an object with no text property, take first non-empty value or stringify
        if (!textContent) {
          for (const key in content) {
            if (content[key] && typeof content[key] === "string" && key !== 'data') {
              // Skip 'data' field as it likely contains base64
              textContent = content[key];
              console.log(`Using content from key '${key}':`, textContent);
              break;
            }
          }

          // If still no text found, create a placeholder instead of stringifying
          if (!textContent) {
            textContent = `[${messageType || 'Message'} received]`;
            console.log(
              "No text content found, using placeholder:",
              textContent
            );
          }
        }
      }

      console.log("Prepared text content:", textContent);
      console.log("Rich content:", richContent || content);

      // Extract multimedia-specific fields
      let mediaUrl = null;
      let mediaType = null;
      let mediaCaption = null;
      let mediaMetadata: Record<string, any> = {};

      // Check if this is a multimedia message
      if (messageType && ['image', 'video', 'audio', 'document', 'location', 'media'].includes(messageType)) {
        // Extract media URL if present
        if (content.media_url) {
          mediaUrl = content.media_url;
          mediaType = content.media_type || messageType;
          mediaCaption = content.caption;
        }
        
        // Handle location messages
        if (messageType === 'location' && (content.latitude || content.longitude)) {
          mediaType = 'location';
          mediaMetadata = {
            latitude: content.latitude,
            longitude: content.longitude,
            name: content.name,
            address: content.address
          };
        }
        
        // Store any additional media metadata
        if (content.file_size) mediaMetadata.file_size = content.file_size;
        if (content.mime_type) mediaMetadata.mime_type = content.mime_type;
        if (content.duration) mediaMetadata.duration = content.duration;
        if (content.dimensions) mediaMetadata.dimensions = content.dimensions;
      }

      const { data, error } = await this.supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          external_id: messageId,
          content: textContent, // Store as plain text string
          message_type: messageType,
          service: service,
          rich_content: richContent || content, // Store JSON in rich_content
          // Temporarily commented out until database schema is updated
          // media_url: mediaUrl,
          // media_type: mediaType,
          // media_caption: mediaCaption,
          // media_metadata: Object.keys(mediaMetadata).length > 0 ? mediaMetadata : null,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error storing message:", error);
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          chatId,
          senderId,
          messageId,
          contentLength: textContent.length,
          contentPreview: textContent.substring(0, 50),
          messageType,
          service
        });
        throw error;
      }
      console.log("Message stored successfully with ID:", data.id);
      return data.id;
    } catch (error) {
      console.error("Exception in storeMessage:", error);
      return null;
    }
  }

  /**
   * Project Operations
   */

  // Get projects for a chat, filtered by is_live and age
  async getProjectsByChat(chatId: string): Promise<any[]> {
    this.ensureInitialized();

    try {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      const fortyEightHoursAgoISO = fortyEightHoursAgo.toISOString();

      const { data, error } = await this.supabase
        .from("projects")
        .select("*")
        .eq("chat_id", chatId)
        .or(`is_live.eq.true,and(is_live.eq.false,created_at.gte.${fortyEightHoursAgoISO})`);

      if (error) {
        // console.error("Error fetching projects by chat:", error); // Kept for reference
        throw error;
      }
      return data || [];
    } catch (error) {
      // console.error('SupabaseAdapter.getProjectsByChat failed:', error); // Kept for reference
      return [];
    }
  }

  // Create a new project
  async createProject(
    name: string,
    description: string,
    chatId: string,
    attributes?: Record<string, any>
  ): Promise<string | null> {
    this.ensureInitialized();

    try {
      const { data, error } = await this.supabase
        .from("projects")
        .insert({
          name,
          description,
          chat_id: chatId,
          created_at: new Date().toISOString(),
          is_live: true, // Default to true on creation
          attributes: attributes || {},
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      // Console error removed
      return null;
    }
  }

  // Update an existing project
  async updateProject(
    projectId: string,
    updates: { is_live?: boolean; name?: string; description?: string; attributes?: Record<string, any> }
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Console log removed
      const { error } = await this.supabase
        .from("projects")
        .update(updates)
        .eq("id", projectId);

      if (error) {
        console.error("Error updating project:", error);
        throw error;
      }
      // Console log removed - Successfully updated project
      return true;
    } catch (error) {
      // Console log removed - Error updating project
      return false;
    }
  }

  // Update project attributes - can merge with existing attributes or replace completely
  async updateProjectAttributes(
    projectId: string,
    attributes: Record<string, any>,
    replace: boolean = false
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      // If we're merging (not replacing), get the current attributes first
      if (!replace) {
        const project = await this.getProjectById(projectId);
        if (project && project.attributes) {
          // Merge with existing attributes
          attributes = { ...project.attributes, ...attributes };
        }
      }

      // Update with the new or merged attributes
      const { error } = await this.supabase
        .from("projects")
        .update({ attributes })
        .eq("id", projectId);

      if (error) {
        console.error("Error updating project attributes:", error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error("Error updating project attributes:", error);
      return false;
    }
  }

  // Get a project by ID
  async getProjectById(projectId: string): Promise<any | null> {
    this.ensureInitialized();

    try {
      const { data, error } = await this.supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error getting project by ID:", error);
      return null;
    }
  }

  // Get all projects
  async getAllProjects(): Promise<any[]> {
    this.ensureInitialized();

    try {
      const { data, error } = await this.supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting all projects:", error);
      return [];
    }
  }

  // Log project history event
  async logProjectEvent(
    projectId: string,
    eventType: string,
    details: string
  ): Promise<string | null> {
    this.ensureInitialized();

    try {
      const { data, error } = await this.supabase
        .from("project_history")
        .insert({
          project_id: projectId,
          event_type: eventType,
          details,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error("Error logging project event:", error);
      return null;
    }
  }

  /**
   * Update metadata for a chat
   * @param chatId ID of the chat to update
   * @param metadata Metadata to update or add (will be merged with existing metadata)
   * @returns Success status
   */
  async updateChatMetadata(
    chatId: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      this.ensureInitialized();

      // First get existing metadata to merge with
      const { data: chat, error: getError } = await this.supabase
        .from("chats")
        .select("metadata")
        .eq("id", chatId)
        .single();

      if (getError) {
        console.error("Error fetching chat metadata:", getError);
        return false;
      }

      console.log("Chat metadata:", chat?.metadata);
      console.log("Metadata to update:", metadata);

      // Merge existing metadata with new metadata
      const existingMetadata = chat?.metadata || {};
      const updatedMetadata = { ...existingMetadata, ...metadata };

      // Update the chat with merged metadata
      const { error: updateError } = await this.supabase
        .from("chats")
        .update({ metadata: updatedMetadata })
        .eq("id", chatId);

      if (updateError) {
        console.error("Error updating chat metadata:", updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in updateChatMetadata:", error);
      return false;
    }
  }

  async getChatOnboardingData(
    externalId: string,
    service: string
  ): Promise<Record<string, any> | null> {
    this.ensureInitialized();

    console.log("!!! EXTERNAL ID ", externalId);

    try {
      const { data, error } = await this.supabase
        .from(CHATS_TABLE) // CHATS_TABLE should be imported from './config' or defined
        .select("*")
        .eq("external_id", externalId)

        .single();

      console.log("Supabase query result:", data);
      if (error) {
        console.error("Supabase query error:", error);
        if (error.code === "PGRST116") {
          // Not found
          return null;
        }
        return null; // Return null on error to prevent downstream issues
      }

      console.log("Get Chats Onboarding Data", data);
      console.log("Get Chats Onboarding Data", data?.metadata);
      return data?.metadata || null;
    } catch (error) {
      console.log("Get Chats Onboarding Data Error", error);
      return null;
    }
  }

  async getUserOnboardingData(
    phoneNumber: string
  ): Promise<Record<string, any> | null> {
    this.ensureInitialized();
    try {
      // getUserByPhone is expected to handle its own errors and return null if user not found or on error
      const user = await this.getUserByPhone(phoneNumber);
      if (user && user.metadata) {
        return user.metadata;
      }
      // console.log(`[SupabaseAdapter.getUserOnboardingData] No user or no metadata found for phoneNumber: ${phoneNumber}`);
      return null;
    } catch (error) {
      // This catch block might be redundant if getUserByPhone handles all its errors internally
      // and doesn't throw, but it's safe to keep for unexpected issues.
      // console.error(`[SupabaseAdapter.getUserOnboardingData] Exception fetching user metadata for phoneNumber ${phoneNumber}:`, error);
      return null;
    }
  }

  /**
   * Process entire webhook payload
   */
  async processWebhookPayload(
    payload: WebhookPayload
  ): Promise<{ success: boolean; isNewChat: boolean; chatId: string | null }> {
    let chatId: string | null = null; // Variable to store chatId
    try {
      // Console log removed - Processing webhook
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

      // Console log removed - User identified

      // 2. Get or create chat
      // First check if the chat already exists
      let isNewChat = false;
      const { data: existingChat, error: findError } = await this.supabase
        .from("chats")
        .select("id")
        .eq("external_id", payload.thread_id)
        .maybeSingle(); // Changed from .single() to handle duplicates gracefully

      if (findError && findError.code !== "PGRST116") {
        console.error("Error checking for existing chat:", findError);
        // Don't throw here, try to continue with getChatFromWebhook
      }

      if (!existingChat) {
        isNewChat = true; // Chat doesn't exist yet, so it's new
      } else if (existingChat) {
        // Chat already exists, use its ID
        chatId = existingChat.id;
      }

      // Only try to create if we didn't find an existing chat
      if (!chatId) {
        chatId = await this.getChatFromWebhook(
          payload.thread_id,
          payload.thread_type,
          payload.service,
          { a1_account_id: payload.a1_account_id }
        );
      }

      if (!chatId) {
        console.error("Failed to get or create chat");
        throw new Error("Failed to get or create chat");
      }

      // Console log removed - Chat identified

      // 3. Add user as participant
      const participantAdded = await this.addParticipantToChat(chatId, userId);
      if (!participantAdded) {
        console.error("Failed to add participant to chat");
        throw new Error("Failed to add participant to chat");
      }

      // Console log removed - Added user as participant

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

      // Console log removed - Successfully stored message

      return { success: true, isNewChat, chatId };
    } catch (error) {
      console.error("Error processing webhook payload:", error);
      return { success: false, isNewChat: false, chatId: null };
    }
  }

  // Method to upsert user memory value in the memory jsonb field of conversation_users table
  async upsertUserMemoryValue(
    userId: string,
    fieldId: string,
    value: string
  ): Promise<{ data: any; error: any }> {
    // Return data and error for consistency

   // Check if userId is a phone number and normalize it
    let userIdentifier = userId;
    if (userId.includes("+") || /^\d+$/.test(userId)) {
      // This appears to be a phone number, normalize it by removing '+' and spaces
      userIdentifier = userId.replace(/\+|\s/g, "");
      console.log(
        `Normalized phone number from ${userId} to ${userIdentifier}`
      );

      // Get the user id from the phone number
      const { data: userRecord, error: userLookupError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select("id")
        .eq("phone_number", userIdentifier)
        .single();

      if (userLookupError) {
        console.error(
          `[SupabaseAdapter] Error finding user with phone number ${userIdentifier}:`,
          userLookupError
        );
        return { data: null, error: userLookupError };
      }

      if (userRecord) {
        userIdentifier = userRecord.id;
        console.log(`Found user ID ${userIdentifier} for phone number`);
      } else {
        console.error(`No user found with phone number ${userIdentifier}`);
        return {
          data: null,
          error: new Error(`No user found with phone number ${userIdentifier}`),
        };
      }
    }

    // First get the current memory object
    const { data: currentUser, error: fetchError } = await this.supabase
      .from(CONVERSATION_USERS_TABLE)
      .select("memory")
      .eq("id", userIdentifier)
      .single();

    if (fetchError) {
      console.error(
        `[SupabaseAdapter] Error fetching user for memory update ${userIdentifier}:`,
        fetchError
      );
      return { data: null, error: fetchError };
    }

    // Initialize or update the memory object
    const memory = currentUser?.memory || {};

    // Check if we have an existing value for this field
    const existingMemory = memory[fieldId];
    if (existingMemory && existingMemory.value && typeof existingMemory.value === 'string') {
      // If value is identical, no need to update
      if (existingMemory.value === value) {
        console.log(`Memory value unchanged for user ${userIdentifier}, field ${fieldId}`);
        return { data: currentUser, error: null };
      }
      
      // For fields that might contain lists or multiple facts, attempt to integrate
      // rather than replace completely
      if (fieldId.includes('preferences') || 
          fieldId.includes('likes') || 
          fieldId.includes('dislikes') || 
          fieldId.includes('topics') ||
          /\d+/.test(fieldId)) { // Numeric IDs often used for fact storage
      
        console.log(`Integrating memory for user ${userIdentifier}, field ${fieldId}`);
        console.log(`Existing: "${existingMemory.value}"`);
        console.log(`New: "${value}"`);
        
        // If the existing value doesn't already contain the new value
        if (!existingMemory.value.toLowerCase().includes(value.toLowerCase())) {
          // Create an integrated memory that combines both
          memory[fieldId] = {
            value: `${existingMemory.value}. ${value}`,
            updated_at: new Date().toISOString(),
            previous_value: existingMemory.value
          };
        } else {
          console.log(`New value already contained in existing memory`);
          return { data: currentUser, error: null };
        }
      } else {
        // For other fields, replace but keep history
        memory[fieldId] = {
          value,
          updated_at: new Date().toISOString(),
          previous_value: existingMemory.value
        };
      }
    } else {
      // No existing memory, create a new one
      memory[fieldId] = {
        value,
        updated_at: new Date().toISOString(),
      };
    }

    // Update the memory field
    const { data, error } = await this.supabase
      .from(CONVERSATION_USERS_TABLE)
      .update({ memory })
      .eq("id", userIdentifier)
      .select(); // Get the updated record

    if (error) {
      console.error(
        `[SupabaseAdapter] Error upserting user memory for user ${userIdentifier}, field ${fieldId}:`,
        error
      );
    }
    return { data, error };
  }

  // Method to upsert chat thread memory value in the memory jsonb field of chats table
  async upsertChatThreadMemoryValue(
    chatId: string,
    fieldId: string,
    value: string
  ): Promise<{ data: any; error: any }> {
    // Return data and error for consistency

    console.log("upsertChatThreadMemoryValue");

    // Check if chatId is likely an external_id (UUID format) or internal id
    let internalChatId = chatId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
    
    if (isUuid) {
      // This appears to be an external_id, look up the internal id
      console.log(`[upsertChatThreadMemoryValue] Looking up internal ID for external_id: ${chatId}`);
      const { data: chatLookup, error: lookupError } = await this.supabase
        .from(CHATS_TABLE)
        .select("id")
        .eq("external_id", chatId)
        .maybeSingle(); // Use maybeSingle to handle multiple rows gracefully

      if (lookupError) {
        console.error(
          `[SupabaseAdapter] Error looking up chat by external_id ${chatId}:`,
          lookupError
        );
        return { data: null, error: lookupError };
      }

      if (!chatLookup) {
        console.error(`[SupabaseAdapter] No chat found with external_id ${chatId}`);
        return { data: null, error: new Error(`No chat found with external_id ${chatId}`) };
      }

      internalChatId = chatLookup.id;
      console.log(`[upsertChatThreadMemoryValue] Found internal ID: ${internalChatId} for external_id: ${chatId}`);
    }

    // First get the current memory object using internal ID
    const { data: currentChat, error: fetchError } = await this.supabase
      .from(CHATS_TABLE)
      .select("*")
      .eq("id", internalChatId)
      .single();

    if (fetchError) {
      console.error(
        `[SupabaseAdapter] Error fetching chat for memory update ${internalChatId}:`,
        fetchError
      );
      return { data: null, error: fetchError };
    }

    // Initialize or update the memory object
    const memory = currentChat?.memory || {};

    // Check if we have an existing value for this field
    const existingMemory = memory[fieldId];
    if (existingMemory && existingMemory.value && typeof existingMemory.value === 'string') {
      // If value is identical, no need to update
      if (existingMemory.value === value) {
        console.log(`Memory value unchanged for chat ${internalChatId}, field ${fieldId}`);
        return { data: currentChat, error: null };
      }
      
      // For fields that might contain lists or multiple facts, attempt to integrate
      // rather than replace completely
      if (fieldId.includes('preferences') || 
          fieldId.includes('likes') || 
          fieldId.includes('dislikes') || 
          fieldId.includes('topics') ||
          /\d+/.test(fieldId)) { // Numeric IDs often used for fact storage
      
        console.log(`Integrating memory for chat ${internalChatId}, field ${fieldId}`);
        console.log(`Existing: "${existingMemory.value}"`);
        console.log(`New: "${value}"`);
        
        // If the existing value doesn't already contain the new value
        if (!existingMemory.value.toLowerCase().includes(value.toLowerCase())) {
          // Create an integrated memory that combines both
          memory[fieldId] = {
            value: `${existingMemory.value}. ${value}`,
            updated_at: new Date().toISOString(),
            previous_value: existingMemory.value
          };
        } else {
          console.log(`New value already contained in existing memory`);
          return { data: currentChat, error: null };
        }
      } else {
        // For other fields, replace but keep history
        memory[fieldId] = {
          value,
          updated_at: new Date().toISOString(),
          previous_value: existingMemory.value
        };
      }
    } else {
      // No existing memory, create a new one
      memory[fieldId] = {
        value,
        updated_at: new Date().toISOString(),
      };
    }

    // Update the memory field
    const { data, error } = await this.supabase
      .from(CHATS_TABLE)
      .update({ memory })
      .eq("id", internalChatId)
      .select(); // Get the updated record

    if (error) {
      console.error(
        `[SupabaseAdapter] Error upserting chat memory for chat ${internalChatId}, field ${fieldId}:`,
        error
      );
    }
    return { data, error };
  }

  /**
   * Get user memory value from memory jsonb field in conversation_users table
   * @param userId User ID or phone number
   * @param fieldId Field ID in memory
   * @returns The memory value or null if not found
   */
  async getUserMemoryValue(
    userId: string,
    fieldId: string
  ): Promise<{ data: any; error: any }> {
    try {
      // Check if userId is a phone number and normalize it
      let userIdentifier = userId;
      if (userId.includes("+") || /^\d+$/.test(userId)) {
        // This appears to be a phone number, normalize it by removing '+' and spaces
        userIdentifier = userId.replace(/\+|\s/g, "");

        // Get the user id from the phone number
        const { data: userRecord, error: userLookupError } = await this.supabase
          .from(CONVERSATION_USERS_TABLE)
          .select("id")
          .eq("phone_number", userIdentifier)
          .single();

        if (userLookupError) {
          console.error(
            `[SupabaseAdapter] Error finding user with phone number ${userIdentifier}:`,
            userLookupError
          );
          return { data: null, error: userLookupError };
        }

        if (userRecord) {
          userIdentifier = userRecord.id;
        } else {
          console.error(`No user found with phone number ${userIdentifier}`);
          return {
            data: null,
            error: new Error(
              `No user found with phone number ${userIdentifier}`
            ),
          };
        }
      }

      const { data, error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select("memory")
        .eq("id", userIdentifier)
        .single();

      if (error) {
        console.error(
          `[SupabaseAdapter] Error getting user memory for user ${userIdentifier}, field ${fieldId}:`,
          error
        );
        return { data: null, error };
      }

      // Return the specific field value from the memory object
      const memoryValue =
        data?.memory && data.memory[fieldId]
          ? data.memory[fieldId].value
          : null;
      return { data: memoryValue, error: null };
    } catch (error) {
      console.error(
        `[SupabaseAdapter] Exception getting user memory for user ${userId}, field ${fieldId}:`,
        error
      );
      return { data: null, error };
    }
  }

  /**
   * Delete user memory value from memory jsonb field in conversation_users table
   * @param userId User ID or phone number
   * @param fieldId Field ID to delete from memory
   * @returns Success status
   */
  async deleteUserMemoryValue(
    userId: string,
    fieldId: string
  ): Promise<{ success: boolean; error: any }> {
    try {
      // Check if userId is a phone number and normalize it
      let userIdentifier = userId;
      if (userId.includes("+") || /^\d+$/.test(userId)) {
        // This appears to be a phone number, normalize it by removing '+' and spaces
        userIdentifier = userId.replace(/\+|\s/g, "");

        // Get the user id from the phone number
        const { data: userRecord, error: userLookupError } = await this.supabase
          .from(CONVERSATION_USERS_TABLE)
          .select("id")
          .eq("phone_number", userIdentifier)
          .single();

        if (userLookupError) {
          console.error(
            `[SupabaseAdapter] Error finding user with phone number ${userIdentifier}:`,
            userLookupError
          );
          return { success: false, error: userLookupError };
        }

        if (userRecord) {
          userIdentifier = userRecord.id;
        } else {
          console.error(`No user found with phone number ${userIdentifier}`);
          return {
            success: false,
            error: new Error(
              `No user found with phone number ${userIdentifier}`
            ),
          };
        }
      }

      // First get the current memory object
      const { data: currentUser, error: fetchError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select("memory")
        .eq("id", userIdentifier)
        .single();

      if (fetchError) {
        console.error(
          `[SupabaseAdapter] Error fetching user for memory deletion ${userIdentifier}:`,
          fetchError
        );
        return { success: false, error: fetchError };
      }

      // If no memory or the field doesn't exist, nothing to delete
      if (!currentUser?.memory || !currentUser.memory[fieldId]) {
        return { success: true, error: null };
      }

      // Create a new memory object without the specified field
      const memory = { ...currentUser.memory };
      delete memory[fieldId];

      // Update the memory field
      const { error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .update({ memory })
        .eq("id", userIdentifier);

      if (error) {
        console.error(
          `[SupabaseAdapter] Error deleting user memory for user ${userIdentifier}, field ${fieldId}:`,
          error
        );
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error(
        `[SupabaseAdapter] Exception deleting user memory for user ${userId}, field ${fieldId}:`,
        error
      );
      return { success: false, error };
    }
  }

  /**
   * Get chat thread memory value from memory jsonb field in chats table
   * @param chatId Chat ID
   * @param fieldId Field ID in memory
   * @returns The memory value or null if not found
   */
  async getChatMemoryValue(
    chatId: string,
    fieldId: string
  ): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await this.supabase
        .from(CHATS_TABLE)
        .select("memory")
        .eq("id", chatId)
        .single();

      if (error) {
        console.error(
          `[SupabaseAdapter] Error getting chat memory for chat ${chatId}, field ${fieldId}:`,
          error
        );
        return { data: null, error };
      }

      // Return the specific field value from the memory object
      const memoryValue =
        data?.memory && data.memory[fieldId]
          ? data.memory[fieldId].value
          : null;
      return { data: memoryValue, error: null };
    } catch (error) {
      console.error(
        `[SupabaseAdapter] Exception getting chat memory for chat ${chatId}, field ${fieldId}:`,
        error
      );
      return { data: null, error };
    }
  }

  /**
   * Delete chat thread memory value from memory jsonb field in chats table
   * @param chatId Chat ID
   * @param fieldId Field ID to delete from memory
   * @returns Success status
   */
  async deleteChatMemoryValue(
    chatId: string,
    fieldId: string
  ): Promise<{ success: boolean; error: any }> {
    try {
      // First get the current memory object
      const { data: currentChat, error: fetchError } = await this.supabase
        .from(CHATS_TABLE)
        .select("memory")
        .eq("id", chatId)
        .single();

      if (fetchError) {
        console.error(
          `[SupabaseAdapter] Error fetching chat for memory deletion ${chatId}:`,
          fetchError
        );
        return { success: false, error: fetchError };
      }

      // If no memory or the field doesn't exist, nothing to delete
      if (!currentChat?.memory || !currentChat.memory[fieldId]) {
        return { success: true, error: null };
      }

      // Create a new memory object without the specified field
      const memory = { ...currentChat.memory };
      delete memory[fieldId];

      // Update the memory field
      const { error } = await this.supabase
        .from(CHATS_TABLE)
        .update({ memory })
        .eq("id", chatId);

      if (error) {
        console.error(
          `[SupabaseAdapter] Error deleting chat memory for chat ${chatId}, field ${fieldId}:`,
          error
        );
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error(
        `[SupabaseAdapter] Exception deleting chat memory for chat ${chatId}, field ${fieldId}:`,
        error
      );
      return { success: false, error };
    }
  }

  /**
   * @description Gets all memory values for a user
   * @param userId User ID or phone number
   * @returns All memory values for the user
   */
  async getAllUserMemoryValues(userId: string): Promise<Record<string, any>> {
    try {
      // Check if userId is a phone number and normalize it
      let userIdentifier = userId;
      if (userId.includes("+") || /^\d+$/.test(userId)) {
        // This appears to be a phone number, normalize it by removing '+' and spaces
        userIdentifier = userId.replace(/\+|\s/g, "");

        // Get the user id from the phone number
        const { data: userRecord, error: userLookupError } = await this.supabase
          .from(CONVERSATION_USERS_TABLE)
          .select("id")
          .eq("phone_number", userIdentifier)
          .single();

        if (userLookupError) {
          console.error(
            `[SupabaseAdapter] Error finding user with phone number ${userIdentifier}:`,
            userLookupError
          );
          return {};
        }

        if (userRecord) {
          userIdentifier = userRecord.id;
        } else {
          console.error(`No user found with phone number ${userIdentifier}`);
          return {};
        }
      }

      const { data, error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select("memory")
        .eq("id", userIdentifier)
        .single();

      if (error) {
        console.error(
          `[SupabaseAdapter] Error getting all user memory values for user ${userIdentifier}:`,
          error
        );
        return {};
      }

      // Transform the memory object to return just the values, not the metadata
      const result: Record<string, any> = {};
      if (data?.memory) {
        Object.keys(data.memory).forEach((key) => {
          result[key] = data.memory[key]?.value;
        });
      }

      return result;
    } catch (error) {
      console.error(
        `[SupabaseAdapter] Exception getting all user memory values for user ${userId}:`,
        error
      );
      return {};
    }
  }

  /**
   * @description Gets all memory values for a chat
   * @param chatId Chat ID
   * @returns All memory values for the chat
   */
  async getAllChatMemoryValues(chatId: string): Promise<Record<string, any>> {
    try {
      // Check if chatId is likely an external_id (UUID format) or internal id
      let internalChatId = chatId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
      
      if (isUuid) {
        // This appears to be an external_id, look up the internal id
        console.log(`[getAllChatMemoryValues] Looking up internal ID for external_id: ${chatId}`);
        const { data: chatLookup, error: lookupError } = await this.supabase
          .from(CHATS_TABLE)
          .select("id")
          .eq("external_id", chatId)
          .maybeSingle(); // Use maybeSingle to handle multiple rows gracefully

        if (lookupError || !chatLookup) {
          console.error(
            `[SupabaseAdapter] Error getting all chat memory values - could not find chat with external_id ${chatId}:`,
            lookupError
          );
          return {};
        }

        internalChatId = chatLookup.id;
      }

      const { data, error } = await this.supabase
        .from(CHATS_TABLE)
        .select("memory")
        .eq("id", internalChatId)
        .single();

      if (error) {
        console.error(
          `[SupabaseAdapter] Error getting all chat memory values for chat ${chatId}:`,
          error
        );
        return {};
      }

      // Transform the memory object to return just the values, not the metadata
      const result: Record<string, any> = {};
      if (data?.memory) {
        Object.keys(data.memory).forEach((key) => {
          result[key] = data.memory[key]?.value;
        });
      }

      return result;
    } catch (error) {
      console.error(
        `[SupabaseAdapter] Exception getting all chat memory values for chat ${chatId}:`,
        error
      );
      return {};
    }
  }

  /**
   * Update the status of a message
   * @param params Object containing messageId, status, and optional error details
   * @returns Success status
   */
  async updateMessageStatus(params: {
    messageId: string;
    status: string;
    updatedAt: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<boolean> {
    this.ensureInitialized();

    try {
      console.log("[updateMessageStatus] Updating message status:", params);
      
      // Build the update object
      const updates: any = {
        status: params.status,
        status_updated_at: params.updatedAt
      };
      
      // If it's a failed message, store error details in rich_content
      if (params.status === 'failed' && (params.errorCode || params.errorMessage)) {
        // First get the current message to preserve existing rich_content
        const { data: currentMessage, error: fetchError } = await this.supabase
          .from("messages")
          .select("rich_content")
          .eq("external_id", params.messageId)
          .single();
          
        if (!fetchError && currentMessage) {
          // Merge error details with existing rich_content
          updates.rich_content = {
            ...(currentMessage.rich_content || {}),
            error: {
              code: params.errorCode,
              message: params.errorMessage,
              timestamp: params.updatedAt
            }
          };
        }
      }
      
      // Update the message by external_id (which is the message_id from A1Base)
      const { error } = await this.supabase
        .from("messages")
        .update(updates)
        .eq("external_id", params.messageId);

      if (error) {
        console.error("[updateMessageStatus] Error updating message status:", error);
        return false;
      }
      
      console.log(`[updateMessageStatus] Successfully updated status for message ${params.messageId} to ${params.status}`);
      return true;
    } catch (error) {
      console.error("[updateMessageStatus] Exception updating message status:", error);
      return false;
    }
  }

  // === Web UI Chat Methods ===

  /**
   * Create a new anonymous web user
   * @returns User data with id and generated name
   */
  async createWebUser(): Promise<{ id: string; name: string } | null> {
    this.ensureInitialized();
    
    try {
      const animalNames = [
        'Anonymous Panda', 'Clever Fox', 'Curious Cat', 'Wise Owl', 'Brave Wolf',
        'Happy Dolphin', 'Quick Rabbit', 'Strong Bear', 'Gentle Deer', 'Bright Peacock',
        'Swift Eagle', 'Cool Penguin', 'Smart Raven', 'Kind Elephant', 'Noble Lion'
      ];
      
      const randomName = animalNames[Math.floor(Math.random() * animalNames.length)];
      
      const { data, error } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .insert({
          name: randomName,
          phone_number: null,
          service: 'web-ui',
          created_at: new Date().toISOString(),
        })
        .select('id, name')
        .single();

      if (error) {
        console.error('[createWebUser] Error creating web user:', error);
        return null;
      }

      return { id: data.id, name: data.name };
    } catch (error) {
      console.error('[createWebUser] Exception creating web user:', error);
      return null;
    }
  }

  /**
   * Get all chats that a user participates in
   * @param userId The user's ID
   * @returns Array of chat objects
   */
  async getChatsForUser(userId: string): Promise<any[]> {
    this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase
        .from('chat_participants')
        .select(`
          chat_id,
          chats:chat_id (
            id,
            external_id,
            name,
            type,
            created_at,
            service,
            metadata
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('[getChatsForUser] Error fetching user chats:', error);
        return [];
      }

      // Transform the data to return just the chat info
      return data.map((item: any) => item.chats).filter(Boolean);
    } catch (error) {
      console.error('[getChatsForUser] Exception fetching user chats:', error);
      return [];
    }
  }

  /**
   * Create a new chat and add the creator as a participant
   * @param creatorId The ID of the user creating the chat
   * @returns Chat object with id and external_id
   */
  async createChat(creatorId: string): Promise<{ id: string; external_id: string } | null> {
    this.ensureInitialized();
    
    try {
      const externalId = require('crypto').randomUUID();
      
      // Create the chat
      const { data: chat, error: chatError } = await this.supabase
        .from(CHATS_TABLE)
        .insert({
          external_id: externalId,
          service: 'web-ui',
          type: 'group',
          name: 'New Chat',
          created_at: new Date().toISOString(),
        })
        .select('id, external_id')
        .single();

      if (chatError) {
        console.error('[createChat] Error creating chat:', chatError);
        return null;
      }

      // Add the creator as a participant
      const { error: participantError } = await this.supabase
        .from('chat_participants')
        .insert({
          chat_id: chat.id,
          user_id: creatorId,
        });

      if (participantError) {
        console.error('[createChat] Error adding creator as participant:', participantError);
        // Try to clean up the created chat
        await this.supabase.from(CHATS_TABLE).delete().eq('id', chat.id);
        return null;
      }

      return { id: chat.id, external_id: chat.external_id };
    } catch (error) {
      console.error('[createChat] Exception creating chat:', error);
      return null;
    }
  }

  /**
   * Get all messages for a specific chat
   * @param chatId The external ID of the chat
   * @param userId The ID of the user requesting messages (for permission check)
   * @returns Array of message objects
   */
  async getChatMessages(chatId: string, userId: string): Promise<any[]> {
    this.ensureInitialized();
    
    try {
      // First verify the user is a participant in this chat
      const { data: chat, error: chatError } = await this.supabase
        .from(CHATS_TABLE)
        .select('id')
        .eq('external_id', chatId)
        .single();

      if (chatError || !chat) {
        console.error('[getChatMessages] Chat not found:', chatError);
        return [];
      }

      // Check if user is a participant
      const { data: participant, error: participantError } = await this.supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat.id)
        .eq('user_id', userId)
        .single();

      if (participantError) {
        console.error('[getChatMessages] User is not a participant in this chat');
        return [];
      }

      // Get messages with sender information
      const { data: messages, error: messagesError } = await this.supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          message_type,
          sender_id,
          conversation_users:sender_id (
            id,
            name,
            phone_number,
            service
          )
        `)
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('[getChatMessages] Error fetching messages:', messagesError);
        return [];
      }

      return messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        timestamp: msg.created_at,
        messageType: msg.message_type || 'text',
        senderId: msg.sender_id,
        senderName: msg.conversation_users?.name || 'Unknown',
        senderService: msg.conversation_users?.service || '',
        isFromAgent: msg.conversation_users?.phone_number === process.env.A1BASE_AGENT_NUMBER?.replace(/\+/g, ''),
      }));
    } catch (error) {
      console.error('[getChatMessages] Exception fetching messages:', error);
      return [];
    }
  }

  /**
   * Add a message to a chat
   * @param chatId The external ID of the chat
   * @param senderId The ID of the user sending the message
   * @param content The message content
   * @returns The created message object
   */
  async addMessageToChat(chatId: string, senderId: string, content: string): Promise<any | null> {
    this.ensureInitialized();
    
    try {
      // Get the internal chat ID
      const { data: chat, error: chatError } = await this.supabase
        .from(CHATS_TABLE)
        .select('id')
        .eq('external_id', chatId)
        .single();

      if (chatError || !chat) {
        console.error('[addMessageToChat] Chat not found:', chatError);
        return null;
      }

      // Verify user is a participant
      const { data: participant, error: participantError } = await this.supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat.id)
        .eq('user_id', senderId)
        .single();

      if (participantError) {
        console.error('[addMessageToChat] User is not a participant in this chat');
        return null;
      }

      // Create the message
      const messageId = require('crypto').randomUUID();
      const { data: message, error: messageError } = await this.supabase
        .from('messages')
        .insert({
          id: messageId,
          chat_id: chat.id,
          sender_id: senderId,
          content: content,
          message_type: 'text',
          service: 'web-ui',
          external_id: messageId,
          created_at: new Date().toISOString(),
        })
        .select('id, content, created_at, sender_id')
        .single();

      if (messageError) {
        console.error('[addMessageToChat] Error creating message:', messageError);
        return null;
      }

      // Get sender information separately
      const { data: sender, error: senderError } = await this.supabase
        .from(CONVERSATION_USERS_TABLE)
        .select('name, service')
        .eq('id', senderId)
        .single();

      return {
        id: message.id,
        content: message.content,
        timestamp: message.created_at,
        senderId: message.sender_id,
        senderName: sender?.name || 'Unknown',
        senderService: sender?.service || '',
      };
    } catch (error) {
      console.error('[addMessageToChat] Exception adding message:', error);
      return null;
    }
  }

  /**
   * Add a user to a chat as a participant
   * @param chatId The external ID of the chat
   * @param userId The ID of the user to add
   * @returns Success status
   */
  async addUserToChat(chatId: string, userId: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      // Get the internal chat ID
      const { data: chat, error: chatError } = await this.supabase
        .from("chats") // Use CHATS_TABLE if defined, otherwise "chats"
        .select('id')
        .eq('external_id', chatId)
        .single();

      if (chatError || !chat) {
        console.error('[addUserToChat] Chat not found:', chatError);
        return false;
      }

      // Check if user is already a participant
      const { data: existingParticipant } = await this.supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat.id)
        .eq('user_id', userId)
        .single();

      if (existingParticipant) {
        // User is already a participant, no need to add again
        return true;
      }

      // Add the user as a participant
      const { error: participantError } = await this.supabase
        .from('chat_participants')
        .insert({
          chat_id: chat.id,
          user_id: userId,
        });

      if (participantError) {
        console.error('[addUserToChat] Error adding participant:', participantError);
        return false;
      }

      return true;
    } catch (error: any) {
      // It's possible for .single() to throw if no row is found, which we don't consider a critical error here
      if (error.code !== 'PGRST116') {
        console.error('[addUserToChat] Exception adding user to chat:', error);
      }
      // If we are here due to an error, we likely need to add the user
      // This path can be complex, for now, we assume the above logic handles it.
      // A potential improvement is to handle the "no row" error from .single() more gracefully.
      return false;
    }
  }
}

// Singleton instance of the adapter
let adapterInstance: SupabaseAdapter | null = null;

/**
 * Returns an initialized instance of the SupabaseAdapter.
 * It ensures that environment variables are loaded and the adapter is initialized before use.
 *
 * @returns {Promise<SupabaseAdapter>} A promise that resolves to the initialized adapter instance.
 * @throws {Error} If SUPABASE_URL or SUPABASE_ANON_KEY environment variables are not set.
 */
export async function getAdapter(): Promise<SupabaseAdapter> {
  if (adapterInstance && adapterInstance.isInitialized) {
    return adapterInstance;
  }

  // Ensure environment variables are loaded
  if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: '.env.local' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase URL or Key is not set in environment variables."
    );
  }

  adapterInstance = new SupabaseAdapter(supabaseUrl, supabaseKey);
  await adapterInstance.init();
  
  return adapterInstance;
}
