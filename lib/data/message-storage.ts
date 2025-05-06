/**
 * Message and user storage operations
 * 
 * Contains functions for handling message storage and user management
 * in both Supabase and in-memory storage
 */
import { MessageRecord } from "@/types/chat";
import { DatabaseAdapterInterface } from "../interfaces/database-adapter";
import { MAX_CONTEXT_MESSAGES } from "../ai-triage/handle-whatsapp-incoming";

/**
 * Check if user exists in the database and update their information if needed
 */
export async function userCheck(
  phoneNumber: string,
  name: string,
  adapter: DatabaseAdapterInterface
): Promise<void> {
  try {
    // Normalize phone number (remove '+' and spaces)
    const normalizedPhone = phoneNumber.replace(/\\+|\\s/g, "");

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
export async function saveMessage(
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
  thread_type: string,
  adapter: DatabaseAdapterInterface | null,
  saveToMemory: (threadId: string, message: any) => Promise<void>
) {
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
        service: thread_type || "whatsapp", // Use thread_type as service or default to whatsapp
        sender_id: "", // Will be populated by Supabase
        sender_number: message.sender_number,
        sender_name: message.sender_name,
        sender_service: thread_type || "whatsapp",
        sender_metadata: {},
        timestamp: message.timestamp,
      };

      // Normalize sender number (remove '+' sign)
      const normalizedSenderNumber = message.sender_number.replace(/\\+/g, "");

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
          const participantNumber =
            typeof p === "string" ? p : p.phone_number || "";

          // Normalize the participant number for comparison
          const normalizedParticipantNumber = participantNumber.replace(
            /\\+/g,
            ""
          );
          return normalizedParticipantNumber === normalizedSenderNumber;
        });

        // If sender is not a participant, add them
        if (
          !senderIsParticipant &&
          message.sender_number !== process.env.A1BASE_AGENT_NUMBER
        ) {
          // Create new participant object with enhanced fields matching our updated data model
          const newParticipant = {
            user_id: "", // Will be filled by adapter
            phone_number: normalizedSenderNumber,
            name: message.sender_name,
            service: thread_type || "whatsapp", // Use thread_type as service or default to whatsapp
            metadata: {},
            created_at: new Date().toISOString(),
            preferences: {},
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
            user_id: "", // Will be filled by adapter
            phone_number: normalizedSenderNumber,
            name: message.sender_name,
          });
        }

        await adapter.createThread(
          threadId,
          [newMessage],
          participants,
          thread_type
        );
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
