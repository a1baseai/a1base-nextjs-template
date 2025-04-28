// import { WhatsAppIncomingData } from "a1base-node";
import { MessageRecord } from "@/types/chat";
import { triageMessage } from "./triage-logic";
import { initializeDatabase, getInitializedAdapter } from "../supabase/config";
import { WebhookPayload } from "@/app/api/messaging/incoming/route";
import { StartOnboarding } from "../workflows/basic_workflow";

// IN-MEMORY STORAGE
const messagesByThread = new Map();
const MAX_CONTEXT_MESSAGES = 10;

interface DatabaseAdapterInterface {
  createUser: (name: string, phoneNumber: number) => Promise<string | null>;
  updateUser: (phoneNumber: number, updates: { name?: string }) => Promise<boolean>;
  getUserByPhone: (phoneNumber: number) => Promise<{ name: string } | null>;
}

/**
 * Check if user exists in the database and update their information if needed
 */
async function userCheck(
  phoneNumber: string,
  name: string,
  adapter: DatabaseAdapterInterface
): Promise<void> {
  try {
    // Convert phone number to numeric format (remove '+' and any spaces)
    const numericPhone = parseInt(phoneNumber.replace(/\D/g, ""));

  // Check if user exists
    const existingUser = await adapter.getUserByPhone(numericPhone);

    if (!existingUser) {
      // Create new user if they don't exist
      console.log("Creating new user:", { name, phoneNumber });
      const userId = await adapter.createUser(name, numericPhone);
      if (!userId) {
        throw new Error("Failed to create user");
      }
      console.log("Successfully created user with ID:", userId);
    } else if (existingUser.name !== name) {
      // Update user's name if it has changed
      console.log("Updating user name:", {
        oldName: existingUser.name,
        newName: name,
      });
      const success = await adapter.updateUser(numericPhone, { name });
      if (!success) {
        console.error("Failed to update user name");
      }
    }
  } catch (error) {
    console.error("Error managing user:", error);
    // Continue execution even if user management fails
  }
}

/**
 * Save a message either to Supabase (if configured) or in-memory storage
 */
async function saveMessage(
  threadId: string,
  message: {
    message_id: string;
    content: string;
    message_type: string;
    message_content: {
      text?: string;
      data?: string;
      latitude?: number;
      longitude?: number;
      name?: string;
      address?: string;
      quoted_message_content?: string;
      quoted_message_sender?: string;
      reaction?: string;
      groupName?: string;
      inviteCode?: string;
      error?: string;
    };
    sender_number: string;
    sender_name: string;
    timestamp: string;
  },
  thread_type: string
) {
  const adapter = await getInitializedAdapter();

  if (adapter) {
    try {
      // Check user exists in database (skip for agent messages)
      if (message.sender_number !== process.env.A1BASE_AGENT_NUMBER) {
        await userCheck(message.sender_number, message.sender_name, adapter);
      }

      // Get existing thread
      const thread = await adapter.getThread(threadId);

      // Format the new message
      const newMessage = {
        message_id: message.message_id,
        content: message.content,
        message_type: message.message_type,
        message_content: message.message_content,
        sender_number: message.sender_number,
        sender_name: message.sender_name,
        timestamp: message.timestamp,
      };

      // Normalize sender number (remove '+' sign)
      const normalizedSenderNumber = message.sender_number.replace(/\+/g, "");

      if (thread) {
        // Add message to existing thread
        let messages = thread.messages || [];
        messages = [...messages, newMessage];

        // Keep only last MAX_CONTEXT_MESSAGES
        if (messages.length > MAX_CONTEXT_MESSAGES) {
          messages = messages.slice(-MAX_CONTEXT_MESSAGES);
        }

        // Check if sender is already in participants (using normalized numbers)
        let participants = thread.participants || [];
        
        // Safely normalize participant numbers, handling both string and object formats
        participants = participants.map((p: any) => {
          if (typeof p === 'string') {
            return p.replace(/\+/g, "");
          } else if (p && typeof p === 'object' && p.number) {
            return String(p.number).replace(/\+/g, "");
          }
          return p; // Keep as is if we can't normalize
        });
        
        const senderExists = participants.includes(normalizedSenderNumber);

        if (!senderExists) {
          // Add new participant (normalized)
          console.log(
            "Adding new participant to thread:",
            normalizedSenderNumber
          );
          participants = [...participants, normalizedSenderNumber];

          // Update thread participants
          const participantsSuccess = await adapter.updateThreadParticipants(
            threadId,
            participants
          );
          if (!participantsSuccess) {
            console.error("Failed to update thread participants");
          }

          // Don't update messages here since processWebhookPayload will handle this
          // Just update in-memory storage
          const updatedMessages = [...messages, newMessage];
          messagesByThread.set(threadId, updatedMessages);
        } else {
          // Update in-memory storage
          const updatedMessages = [...messages, newMessage];
          messagesByThread.set(threadId, updatedMessages);
        }
      } else {
        // Create new thread with first message
        const participants = [normalizedSenderNumber];
        if (process.env.A1BASE_AGENT_NUMBER) {
          // Add normalized agent number
          participants.push(process.env.A1BASE_AGENT_NUMBER.replace(/\+/g, ""));
        }

        const newThreadId = await adapter.createThread(
          threadId,
          [newMessage],
          participants.map(number => ({ number })),
          thread_type
        );
        if (!newThreadId) throw new Error("Failed to create new thread");
      }

      console.log("Successfully saved message to database");
    } catch (error) {
      console.error("Error saving message to database:", error);
      await saveToMemory(threadId, message);
    }
  } else {
    console.log("Using in-memory storage");
    await saveToMemory(threadId, message);
  }
}

/**
 * Save a message to in-memory storage
 */
async function saveToMemory(threadId: string, message: MessageRecord) {
  let threadMessages = messagesByThread.get(threadId) || [];
  threadMessages.push(message);

  if (threadMessages.length > MAX_CONTEXT_MESSAGES) {
    threadMessages = threadMessages.slice(-MAX_CONTEXT_MESSAGES);
  }

  const normalizedAgentNumber = process.env.A1BASE_AGENT_NUMBER?.replace(
    /\+/g,
    ""
  );
  threadMessages = threadMessages.filter((msg: MessageRecord) => {
    const msgNumber = msg.sender_number.replace(/\+/g, "");
    return msgNumber !== normalizedAgentNumber;
  });

  messagesByThread.set(threadId, threadMessages);
}

export async function handleWhatsAppIncoming(webhookData: WebhookPayload) {
  // Extract data for easier access
  const {
    thread_id,
    message_id,
    message_type,
    message_content,
    sender_number,
    thread_type,
    timestamp,
    service,
  } = webhookData;
  
  // The content field is for backward compatibility
  const content = message_content.text || '';
  
  // Get sender name with potential override for agent
  let sender_name = webhookData.sender_name;
  // Initialize database on first message
  await initializeDatabase();

  console.log("[Message Received]", {
    thread_id,
    message_id,
    content,
    message_type,
    message_content,
    sender_number,
    sender_name,
    thread_type,
    timestamp,
    service,
  });

  if (sender_number === process.env.A1BASE_AGENT_NUMBER) {
    sender_name = process.env.A1BASE_AGENT_NAME || sender_name;
  }
  
  // Check if this is a new user/thread and should trigger onboarding
  const adapter = await getInitializedAdapter();
  let shouldTriggerOnboarding = false;
  
  if (adapter) {
    try {
      // Process and store the webhook data in Supabase - this already saves the message to the database
      const success = await adapter.processWebhookPayload(webhookData);
      if (success) {
        console.log(`[Supabase] Successfully stored webhook data for message ${message_id}`);
      } else {
        console.error(`[Supabase] Failed to store webhook data for message ${message_id}`);
      }
      
      // Check if this is a new thread in the database
      const thread = await adapter.getThread(thread_id);
      if (!thread) {
        shouldTriggerOnboarding = true;
        console.log(`[WhatsApp] New thread detected: ${thread_id}. Will trigger onboarding.`);
      }

      // Store in memory only (skip database save since processWebhookPayload already did it)
      await saveToMemory(thread_id, {
        message_id,
        content,
        message_type,
        message_content,
        sender_number,
        sender_name,
        timestamp,
      });

    } catch (error) {
      console.error('[Supabase] Error processing webhook data:', error);
      // Fallback to in-memory storage if database fails
      await saveMessage(thread_id, {
        message_id,
        content,
        message_type,
        message_content,
        sender_number,
        sender_name,
        timestamp,
      }, thread_type);
    }
  } else {
    // No database adapter available, use in-memory storage only
    await saveMessage(thread_id, {
      message_id,
      content,
      message_type,
      message_content,
      sender_number,
      sender_name,
      timestamp,
    }, thread_type);
    
    // Check if this is the first message in this thread
    const threadMessages = messagesByThread.get(thread_id) || [];
    if (threadMessages.length === 0) {
      shouldTriggerOnboarding = true;
      console.log(`[WhatsApp] First message in thread: ${thread_id}. Will trigger onboarding.`);
    }
  }

  // Only respond to user messages
  if (sender_number === process.env.A1BASE_AGENT_NUMBER!) {
    return;
  }
  
  // If this is a new thread/user, trigger agentic onboarding flow
  if (shouldTriggerOnboarding) {
    console.log(`[WhatsApp] Triggering onboarding flow for thread ${thread_id}`);
  }
}
