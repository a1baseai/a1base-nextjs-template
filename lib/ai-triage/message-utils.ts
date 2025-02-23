import { A1BaseAPI } from "a1base-node";
import { ThreadMessage } from "../../types/chat";

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  }
});

/**
 * Converts raw message records to the standardized ThreadMessage format.
 * 
 * This function takes individual message records and combines them with thread context
 * to create properly formatted ThreadMessage objects that can be used throughout the system.
 * 
 * @param threadMessages - Array of raw message records containing basic message data
 * @param thread_id - Unique identifier for the thread these messages belong to
 * @param thread_type - Type of thread (e.g., "individual" or "group")
 * @returns Array of properly formatted ThreadMessage objects
 */
export function convertToThreadMessages(
  threadMessages: {
    message_id: string;
    content: string;
    sender_number: string;
    sender_name: string;
    timestamp: string;
  }[],
  thread_id: string,
  thread_type: string
): ThreadMessage[] {
  return threadMessages.map(msg => ({
    content: msg.content,
    sender_number: msg.sender_number,
    sender_name: msg.sender_name,
    thread_id,
    thread_type,
    timestamp: msg.timestamp,
    message_id: msg.message_id
  }));
}

/**
 * Sends a message through WhatsApp using the A1Base API.
 * 
 * This function handles the complexities of sending messages to both individual users
 * and group chats through WhatsApp. It automatically formats the message data and
 * routes it to the appropriate A1Base API endpoint based on the thread type.
 * 
 * @param content - The message content to send
 * @param thread_type - Whether this is an individual or group message
 * @param thread_id - For group messages, the ID of the group thread
 * @param sender_number - For individual messages, the recipient's phone number
 * @throws Error if message type is invalid or required parameters are missing
 */
export async function sendWhatsAppMessage(
  content: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
): Promise<void> {
  const messageData = {
    content,
    from: process.env.A1BASE_AGENT_NUMBER!,
    service: "whatsapp" as const,
  };

  if (thread_type === "group" && thread_id) {
    await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
      ...messageData,
      thread_id,
    });
  } else if (thread_type === "individual" && sender_number) {
    await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
      ...messageData,
      to: sender_number,
    });
  } else {
    throw new Error("Invalid message type or missing required parameters");
  }
}

/**
 * Handles errors by sending an appropriate error message to the user.
 * 
 * This function provides a consistent way to handle errors across the application
 * by logging the error and sending a user-friendly error message back through
 * the same channel the original message came from.
 * 
 * @param error - The error that occurred
 * @param errorMessage - User-friendly error message to send
 * @param thread_type - Whether this is an individual or group message
 * @param thread_id - For group messages, the ID of the group thread
 * @param sender_number - For individual messages, the recipient's phone number
 */
export async function handleMessageError(
  error: unknown,
  errorMessage: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
): Promise<void> {
  console.error("[Message Error]:", error);

  const errorMessageData = {
    content: errorMessage,
    from: process.env.A1BASE_AGENT_NUMBER!,
    service: "whatsapp" as const,
  };

  if (thread_type === "group" && thread_id) {
    await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
      ...errorMessageData,
      thread_id,
    });
  } else if (thread_type === "individual" && sender_number) {
    await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
      ...errorMessageData,
      to: sender_number,
    });
  }
}
