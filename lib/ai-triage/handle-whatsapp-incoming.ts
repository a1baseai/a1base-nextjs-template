import { WhatsAppIncomingData } from "a1base-node";
import { MessageRecord } from "@/types/chat";
import { triageMessage } from "./triage-logic";
import { initializeDatabase, getInitializedAdapter } from "../supabase/config";

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
    sender_number: string;
    sender_name: string;
    timestamp: string;
  }
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
        participants = participants.map((p: string) => p.replace(/\+/g, "")); // Normalize existing participants
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
        }

        // Update thread with new messages
        const success = await adapter.updateThreadMessages(threadId, messages);
        if (!success) throw new Error("Failed to update thread messages");
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
          participants.map(number => ({ number }))
        );
        if (!newThreadId) throw new Error("Failed to create new thread");
      }

      // Update in-memory storage
      const messages = thread?.messages || [newMessage];
      messagesByThread.set(threadId, messages);
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

export async function handleWhatsAppIncoming({
  thread_id,
  message_id,
  content,
  sender_name,
  sender_number,
  thread_type,
  timestamp,
  service,
}: WhatsAppIncomingData) {
  // Initialize database on first message
  await initializeDatabase();

  console.log("[Message Received]", {
    thread_id,
    message_id,
    content,
    sender_number,
    sender_name,
    thread_type,
    timestamp,
    service,
  });

  if (sender_number === process.env.A1BASE_AGENT_NUMBER) {
    sender_name = process.env.A1BASE_AGENT_NAME || sender_name;
  }

  // Store message
  await saveMessage(thread_id, {
    message_id,
    content,
    sender_number,
    sender_name,
    timestamp,
  });

  // Only respond to user messages
  if (sender_number === process.env.A1BASE_AGENT_NUMBER!) {
    return;
  }

  await triageMessage({
    thread_id,
    message_id,
    content,
    sender_name,
    sender_number,
    thread_type,
    timestamp,
    messagesByThread,
    service,
  });
}
