// import { WhatsAppIncomingData } from "a1base-node";
import { MessageRecord } from "@/types/chat";
import { triageMessage, projectTriage } from "./triage-logic";
import { initializeDatabase, getInitializedAdapter } from "../supabase/config";
import { WebhookPayload } from "@/app/api/messaging/incoming/route";
import { StartOnboarding } from "../workflows/basic_workflow";
import { A1BaseAPI } from "a1base-node";
import fs from "fs";
import path from "path";

// IN-MEMORY STORAGE
const messagesByThread = new Map();
const MAX_CONTEXT_MESSAGES = 10;

/**
 * Get message splitting setting from configuration file
 * This determines if long messages should be split into multiple messages
 */
async function getSplitMessageSetting(): Promise<boolean> {
  try {
    const settingsFilePath = path.join(process.cwd(), "data", "message-settings.json");
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
      return settings.splitParagraphs || false;
    }
  } catch (error) {
    console.error("Error loading message settings:", error);
  }
  return false; // Default to false if settings can't be loaded
}

// Initialize A1Base API client for sending messages
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

interface DatabaseAdapterInterface {
  createUser: (name: string, phoneNumber: string) => Promise<string | null>;
  updateUser: (phoneNumber: string, updates: { name?: string }) => Promise<boolean>;
  getUserByPhone: (phoneNumber: string) => Promise<{ name: string } | null>;
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
    // Normalize phone number (remove '+' and spaces)
    const normalizedPhone = phoneNumber.replace(/\+|\s/g, "");

    // Check if user exists
    const existingUser = await adapter.getUserByPhone(normalizedPhone);

    if (!existingUser) {
      // Create new user if they don't exist
      console.log("Creating new user:", { name, phoneNumber });
      const userId = await adapter.createUser(name, normalizedPhone);
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
      const success = await adapter.updateUser(normalizedPhone, { name });
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

      // Format the new message with enhanced fields matching our updated data model
      const newMessage = {
        message_id: message.message_id,
        external_id: message.message_id, // Use message_id as external_id for consistency
        content: message.content,
        message_type: message.message_type,
        message_content: message.message_content,
        service: thread_type || 'whatsapp', // Use thread_type as service or default to whatsapp
        sender_id: '', // Will be populated by Supabase
        sender_number: message.sender_number,
        sender_name: message.sender_name,
        sender_service: thread_type || 'whatsapp',
        sender_metadata: {},
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
        const senderIsParticipant = participants.some((p: any) => {
          // Handle both string and object formats for backward compatibility
          const participantNumber = typeof p === 'string'
            ? p
            : (p.phone_number || '');
            
          // Normalize the participant number for comparison
          const normalizedParticipantNumber = participantNumber.replace(/\+/g, "");
          return normalizedParticipantNumber === normalizedSenderNumber;
        });

        // If sender is not a participant, add them
        if (!senderIsParticipant && message.sender_number !== process.env.A1BASE_AGENT_NUMBER) {
          // Create new participant object with enhanced fields matching our updated data model
          const newParticipant = {
            user_id: '', // Will be filled by adapter
            phone_number: normalizedSenderNumber,
            name: message.sender_name,
            service: thread_type || 'whatsapp', // Use thread_type as service or default to whatsapp
            metadata: {},
            created_at: new Date().toISOString(),
            preferences: {}
          };
          participants = [...participants, newParticipant];
        }

        // Update thread with new messages and participants
        await adapter.updateThreadMessages(threadId, messages);
        if (participants.length > 0) {
          await adapter.updateThreadParticipants(threadId, participants);
        }
      } else {
        // Create new thread with message
        const participants = [];
        
        // Only add sender as participant if not the agent
        if (message.sender_number !== process.env.A1BASE_AGENT_NUMBER) {
          participants.push({
            user_id: '', // Will be filled by adapter
            phone_number: normalizedSenderNumber,
            name: message.sender_name
          });
        }

        await adapter.createThread(threadId, [newMessage], participants, thread_type);
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
  if (sender_number === process.env.A1BASE_AGENT_NUMBER) {
    sender_name = process.env.A1BASE_AGENT_NAME || sender_name;
  }
  
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

  // Skip processing for messages from our own agent
  if (sender_number === process.env.A1BASE_AGENT_NUMBER!) {
    console.log("[Message] Skipping processing for agent's own message");
    return;
  }
  
  // Check if this is a new user/thread and should trigger onboarding
  const adapter = await getInitializedAdapter();
  let shouldTriggerOnboarding = false;
  let chatId: string | null = null;
  let threadMessages: MessageRecord[] = [];
  
  // Save the message to storage (either Supabase or in-memory)
  if (adapter) {
    try {
      // Process and store the webhook data in Supabase
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
      } else {
        chatId = thread.id;
        threadMessages = thread.messages || [];
      }

      // Store in memory too for redundancy
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
      
      // Get messages from memory instead
      threadMessages = messagesByThread.get(thread_id) || [];
      if (threadMessages.length === 0) {
        shouldTriggerOnboarding = true;
      }
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
    
    // Get messages from memory
    threadMessages = messagesByThread.get(thread_id) || [];
    if (threadMessages.length === 0) {
      shouldTriggerOnboarding = true;
      console.log(`[WhatsApp] First message in thread: ${thread_id}. Will trigger onboarding.`);
    }
  }

  // Always run project triage for every message (if we have a chat ID)
  let projectId: string | null = null;
  if (chatId) {
    try {
      // Run project triage on the messages
      projectId = await projectTriage(threadMessages, thread_id, chatId, service);
      if (projectId) {
        console.log(`[WhatsApp] Message associated with project ID: ${projectId}`);
      }
    } catch (error) {
      console.error('[WhatsApp] Error in project triage:', error);
    }
  }
  
  // Always run message triage to generate a response
  try {
    console.log(`[WhatsApp] Running message triage for thread ${thread_id}`);
    
    // Special handling for brand new threads that need onboarding
    if (shouldTriggerOnboarding) {
      console.log(`[WhatsApp] Triggering onboarding flow for thread ${thread_id}`);
      try {
        // Create an array of thread messages in the correct format
        const formattedThreadMessages = threadMessages.map(msg => ({
          message_id: msg.message_id,
          content: msg.content,
          message_type: (msg.message_type || 'text') as 'text' | 'rich_text' | 'image' | 'video' | 'audio' | 'location' | 'reaction' | 'group_invite' | 'unsupported_message_type',
          message_content: msg.message_content || { text: msg.content },
          sender_number: msg.sender_number,
          sender_name: msg.sender_name,
          timestamp: msg.timestamp,
          role: (msg.sender_number === process.env.A1BASE_AGENT_NUMBER ? 'assistant' : 'user') as 'user' | 'assistant' | 'system'
        }));
        
        // For onboarding, we only generate the messages and let the workflow handle sending them
        // We just pass a special marker to the service parameter to prevent double-sending
        const onboardingData = await StartOnboarding(
          formattedThreadMessages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          "__skip_send" // Special marker to avoid double-sending
        );
        
        if (onboardingData && onboardingData.messages && onboardingData.messages.length > 0) {
          console.log(`[TRIAGE] Got ${onboardingData.messages.length} onboarding messages to send`);
          
          // Check if we should split messages (based on settings or defaults)
          const splitParagraphs = await getSplitMessageSetting();
          
          // Send onboarding messages sequentially
          for (const message of onboardingData.messages) {
            // Split the message content if needed
            const messageLines = splitParagraphs
              ? message.text.split("\n").filter(line => line.trim())
              : [message.text];
            
            // Send each line as a separate message
            for (const line of messageLines) {
              await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
                content: line,
                from: process.env.A1BASE_AGENT_NUMBER!,
                to: sender_number,
                service: "whatsapp",
              });
              
              // Add a small delay between split message lines
              if (splitParagraphs && messageLines.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
            
            // Add a larger delay between different onboarding messages
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          return;
        }
      } catch (error) {
        console.error(`[WhatsApp] Error in onboarding flow:`, error);
        // Fall through to standard message triage
      }
    }
    
    // For all other messages, run standard message triage
    const triageResult = await triageMessage({
      thread_id,
      message_id,
      content,
      message_type,
      message_content,
      sender_name,
      sender_number,
      thread_type,
      timestamp,
      messagesByThread,
      service: "__skip_send", // Special marker to avoid double-sending
    });
    
    if (triageResult.success) {
      console.log(`[WhatsApp] Successfully triaged message with type: ${triageResult.type}`);
      
      // Send the response if the triage was successful and we have a message to send
      if (triageResult.message) {
        console.log(`[WhatsApp] Sending response to ${sender_number}`);
        
        // For web-ui service, the response is handled by the calling code
        if (service !== "web-ui") {
          // Check if we should split messages (based on settings or defaults)
          const splitParagraphs = await getSplitMessageSetting();
          
          // Split response into paragraphs if setting is enabled
          const messages = splitParagraphs
            ? triageResult.message.split("\n").filter((msg) => msg.trim())
            : [triageResult.message];
          
          // Send each message line individually
          for (const messageContent of messages) {
            await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
              content: messageContent,
              from: process.env.A1BASE_AGENT_NUMBER!,
              to: sender_number,
              service: "whatsapp",
            });
            
            // Add a small delay between messages to maintain order
            if (splitParagraphs && messages.length > 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      }
    } else {
      console.error(`[WhatsApp] Triage failed: ${triageResult.message}`);
      // Optionally send an error message
      if (service !== "web-ui") {
        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          content: "Sorry, I'm having trouble processing your request right now. Please try again later.",
          from: process.env.A1BASE_AGENT_NUMBER!,
          to: sender_number,
          service: "whatsapp",
        });
      }
    }
  } catch (error) {
    console.error('[WhatsApp] Error in message triage:', error);
  }
}
