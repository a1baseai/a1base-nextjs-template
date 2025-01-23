import { WhatsAppIncomingData } from "a1base-node";
import { MessageRecord } from "@/types/chat";
import { triageMessage } from "./triage-logic";

// IN-MEMORY STORAGE FOR DEMO
const messagesByThread = new Map();
const MAX_CONTEXT_MESSAGES = 10;

function saveMessage(
  threadId: string,
  message: {
    message_id: string;
    content: string;
    sender_number: string;
    sender_name: string;
    timestamp: string;
  }
) {
  let threadMessages = messagesByThread.get(threadId) || [];
  
  // Add new message
  threadMessages.push(message);
  
  // Keep only last 10 messages for context
  if (threadMessages.length > MAX_CONTEXT_MESSAGES) {
    threadMessages = threadMessages.slice(-MAX_CONTEXT_MESSAGES);
  }
  
  // Format messages - only include user messages
  const normalizedAgentNumber = process.env.A1BASE_AGENT_NUMBER?.replace(/\+/g, '');
  threadMessages = threadMessages.filter((msg: MessageRecord) => {
    const msgNumber = msg.sender_number.replace(/\+/g, '');
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
}: WhatsAppIncomingData) {
  console.log("[Message Received]", {
    thread_id,
    message_id,
    content,
    sender_number,
    sender_name,
    thread_type,
    timestamp,
  });

  // Store message
  saveMessage(thread_id, {
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
  });
} 