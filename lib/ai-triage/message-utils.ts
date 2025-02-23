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
 * Converts message records to ThreadMessage format
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
 * Sends a message through WhatsApp using A1Base API
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
 * Handles errors by sending an error message to the user
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
