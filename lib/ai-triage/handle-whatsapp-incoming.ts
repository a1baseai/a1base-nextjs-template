// TODO: Rename this file to something more general like 'handle-messaging-incoming.ts' or 'handle-unified-messaging.ts'
// This file now handles all messaging channels (WhatsApp, SMS, RCS, iMessage) not just WhatsApp

// import { WhatsAppIncomingData } from "a1base-node";
import { MessageRecord } from "@/types/chat";
import { triageMessage, projectTriage } from "./triage-logic";
import {
  initializeDatabase,
  getInitializedAdapter,
  isSupabaseConfigured,
  SupabaseAdapter,
} from "../supabase/config"; // Added SupabaseAdapter type
import { WebhookPayload } from "@/app/api/a1base/messaging/route";
import {
  StartOnboarding,
} from "../workflows/onboarding-workflow"; // Removed OnboardingResponse type
import { A1BaseAPI } from "a1base-node";
import OpenAI from "openai";
import { loadOnboardingFlow } from "../onboarding-flow/onboarding-storage";
import { createAgenticOnboardingPrompt } from "../workflows/onboarding-workflow";
import {
  handleGroupChatOnboarding,
  processGroupOnboardingMessage,
  isGroupInOnboardingState,
} from "../workflows/group-onboarding-workflow";
import { getSplitMessageSetting } from "../settings/message-settings";
import { saveMessage, userCheck } from "../data/message-storage"; // userCheck is imported but not used in the original, keeping it.
import { processMessageForMemoryUpdates } from "../agent-memory/memory-processor"; // Added import
import { processIncomingMediaMessage, sendMultimediaMessage, MediaType } from "../messaging/multimedia-handler";
import { getAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";

// --- CONSTANTS ---
export const MAX_CONTEXT_MESSAGES = 10;
export const SERVICE_WEB_UI = "web-ui";
export const SERVICE_SKIP_SEND = "__skip_send"; // Marker to prevent double sending
export const DEFAULT_AGENT_NAME = "AI Assistant";
export const WHATSAPP_SERVICE_NAME = "whatsapp";

// --- IN-MEMORY STORAGE ---
const messagesByThread = new Map<string, MessageRecord[]>();

// --- API CLIENTS INITIALIZATION ---
const a1BaseClient = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- HELPER FUNCTIONS ---

/**
 * Normalizes a phone number by removing '+' and spaces.
 */
function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\+|\s/g, "");
}

/**
 * Ensures the agent user exists in the database
 */
async function ensureAgentUserExists(adapter: SupabaseAdapter): Promise<string | null> {
  if (!process.env.A1BASE_AGENT_NUMBER || !adapter) {
    return null;
  }

  const normalizedAgentNumber = normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER);
  const agentName = process.env.A1BASE_AGENT_NAME || DEFAULT_AGENT_NAME;
  
  try {
    // Check if agent user exists
    let agentUser = await adapter.getUserByPhone(normalizedAgentNumber);
    
    if (!agentUser || !agentUser.id) {
      console.log(`[AgentUser] Creating agent user for ${process.env.A1BASE_AGENT_NUMBER}`);
      
      // Create the agent user
      const { data, error } = await adapter.supabase
        .from('conversation_users')
        .insert({
          phone_number: normalizedAgentNumber,
          name: agentName,
          service: 'whatsapp',
          metadata: {
            is_agent: true,
            agent_number: process.env.A1BASE_AGENT_NUMBER
          }
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('[AgentUser] Error creating agent user:', error);
        return null;
      }
      
      console.log(`[AgentUser] Successfully created agent user with ID: ${data.id}`);
      return data.id;
    }
    
    return agentUser.id;
  } catch (error) {
    console.error('[AgentUser] Error ensuring agent user exists:', error);
    return null;
  }
}

// Import the unified formatMessagesForOpenAI from OpenAI service
import { formatMessagesForOpenAI } from "../services/openai";
import { ThreadMessage } from "@/types/chat";

// The formatMessagesForOpenAI function is now imported from ../services/openai.ts

/**
 * Extracts JSON from a string, attempting to find a valid JSON object within.
 */
function extractJsonFromString(content: string): Record<string, any> {
  let jsonContent = ""; // Initialize to empty

  // Attempt to extract from ```json ... ``` block first
  const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonContent = codeBlockMatch[1].trim();
  } else if (content.includes("{") && content.includes("}")) {
    // Fallback to looking for raw JSON object
    const jsonMatch = content.match(/\{[\s\S]*?\}/); // Use non-greedy match for content within braces
    if (jsonMatch) {
      jsonContent = jsonMatch[0].trim(); // Trim the matched string
    }
  }

  // If no potential JSON was extracted, or it's empty/invalid after trimming, return.
  if (
    !jsonContent ||
    (!jsonContent.startsWith("{") && !jsonContent.startsWith("["))
  ) {
    // console.warn("[JSON Extraction] No JSON content found or extracted content is not JSON. Original:", content, "Extracted:", jsonContent);
    return {};
  }

  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    // console.error(
    //   "[JSON Extraction] Error parsing content:",
    //   e,
    //   "Original content:",
    //   content,
    //   "Attempted to parse:",
    //   jsonContent
    // );
    return {};
  }
}

// --- ONBOARDING LOGIC ---

/**
 * Processes an onboarding conversation to extract user information and check for completion.
 */
async function processOnboardingConversation(
  threadMessages: MessageRecord[]
): Promise<{
  extractedInfo: Record<string, string>;
  isComplete: boolean;
}> {
  console.log("[Onboarding] Processing conversation for user information");
  try {
    const onboardingFlow = await loadOnboardingFlow();
    if (!onboardingFlow.agenticSettings?.userFields) {
      throw new Error(
        "Onboarding settings (agenticSettings.userFields) not available"
      );
    }

    const requiredFields = onboardingFlow.agenticSettings.userFields
      .filter((field) => field.required)
      .map((field) => field.id);

    // Pass the thread type as 'individual' for onboarding conversations
    const formattedMessages = formatMessagesForOpenAI(
      threadMessages,
      "individual"
    );

    const extractionPrompt = `
      Based on the conversation, extract the following information about the user:
      ${onboardingFlow.agenticSettings.userFields
        .map((field) => `- ${field.id}: ${field.description}`)
        .join("\n")}
      For any fields not mentioned in the conversation, return an empty string.
      You MUST respond in valid JSON format with only the extracted fields and nothing else.
      The response should be a valid JSON object that can be parsed with JSON.parse().
      Example response format: { "name": "John Doe", "email": "john@example.com", "business_type": "Tech", "goals": "Increase productivity" }
      DO NOT include any explanations, markdown formatting, or anything outside the JSON object.`;

    console.log(
      "OpenaAI completion happening at processOnboardingConversation function"
    );
    const extraction = await openaiClient.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system" as const, content: extractionPrompt },
        ...formattedMessages,
      ],
      temperature: 0.2,
    });

    const extractionContent = extraction.choices[0]?.message?.content || "{}";
    console.log("[Onboarding] Raw extraction content:", extractionContent);
    const extractedInfo = extractJsonFromString(extractionContent);

    const isComplete = requiredFields.every(
      (field) =>
        extractedInfo[field] && String(extractedInfo[field]).trim() !== ""
    );

    console.log(`[Onboarding] Extraction results:`, extractedInfo);
    console.log(`[Onboarding] Onboarding complete: ${isComplete}`);
    return { extractedInfo, isComplete };
  } catch (error) {
    console.error("[Onboarding] Error processing conversation:", error);
    return { extractedInfo: {}, isComplete: false };
  }
}

/**
 * Saves extracted onboarding information to user metadata in the database.
 */
async function saveOnboardingInfoToDatabase(
  adapter: SupabaseAdapter,
  senderNumber: string,
  extractedInfo: Record<string, string>,
  isComplete: boolean
): Promise<boolean> {
  console.log(`[Onboarding] Saving onboarding info for user ${senderNumber}`);
  try {
    const normalizedPhone = normalizePhoneNumber(senderNumber);
    const metadata = { ...extractedInfo, onboarding_complete: isComplete };
    const success = await adapter.updateUser(normalizedPhone, { metadata });

    if (success) {
      console.log(
        `[Onboarding] Successfully updated user metadata for ${senderNumber}`
      );
    } else {
      console.error(
        `[Onboarding] Failed to update user metadata for ${senderNumber}`
      );
    }
    return success;
  } catch (error) {
    console.error("[Onboarding] Error saving onboarding info:", error);
    return false;
  }
}

/**
 * Handles follow-up messages during the agentic onboarding process.
 */
async function handleAgenticOnboardingFollowUp(
  threadMessages: MessageRecord[],
  senderNumber?: string,
  adapter?: SupabaseAdapter | null,
  service?: string
): Promise<{ text: string; waitForResponse: boolean }> {
  console.log("[Onboarding] Handling agentic follow-up onboarding message. Service:", service);
  console.log("[Onboarding] Number of thread messages:", threadMessages.length);
  
  try {
    const onboardingFlow = await loadOnboardingFlow(); // Load flow once
    
    // Convert MessageRecord[] to ThreadMessage[] for compatibility
    const threadMessagesForOnboarding = threadMessages.map((msg) => ({
      ...msg,
      role: normalizePhoneNumber(msg.sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "") ? "assistant" as const : "user" as const,
      message_type:
        msg.message_type === "text" ||
        msg.message_type === "rich_text" ||
        msg.message_type === "image" ||
        msg.message_type === "video" ||
        msg.message_type === "audio" ||
        msg.message_type === "location" ||
        msg.message_type === "reaction" ||
        msg.message_type === "group_invite"
          ? msg.message_type
          : "unsupported_message_type",
    })) as ThreadMessage[];

    // Log the messages for debugging
    console.log("[Onboarding] Thread messages for onboarding:");
    threadMessagesForOnboarding.forEach((msg, index) => {
      console.log(`  [${index}] ${(msg as any).role}: ${(msg as any).content.substring(0, 50)}...`);
    });

    // Import necessary functions
    const { extractCollectedFields, createAgenticOnboardingPrompt } = await import("../workflows/onboarding-workflow");
    
    // Extract already collected data
    const collectedData = extractCollectedFields(threadMessagesForOnboarding, onboardingFlow);
    console.log("[Onboarding] Already collected data in follow-up:", collectedData);
    
    // Check if all required fields are collected
    const requiredFields = onboardingFlow.agenticSettings?.userFields || [];
    console.log("[Onboarding] Required fields:", requiredFields.map(f => f.id));
    
    const fieldsToCollect = requiredFields.filter(field => 
      !collectedData[field.id] || collectedData[field.id] === ""
    );
    console.log("[Onboarding] Fields still to collect:", fieldsToCollect.map(f => f.id));
    
    const allFieldsCollected = fieldsToCollect.length === 0;
    console.log("[Onboarding] All fields collected?", allFieldsCollected);
    
    let responseContent: string;
    
    if (allFieldsCollected) {
      // All fields collected, onboarding complete
      const userName = collectedData.name || "there";
      responseContent =
        onboardingFlow.agenticSettings?.finalMessage ||
        `Thank you, ${userName}! Your onboarding is now complete. I've saved your information and I'm ready to help you with your tasks.`;
      console.log(
        `[Onboarding] Onboarding completed for user with phone number ${senderNumber}`
      );
      
      // Save onboarding completion to database
      if (senderNumber && adapter) {
        await saveOnboardingInfoToDatabase(
          adapter,
          senderNumber,
          collectedData,
          true // isComplete
        );
      }
    } else {
      // We still have fields to collect
      console.log("[Onboarding] Generating prompt for next field:", fieldsToCollect[0].id);
      
      // Generate the system prompt for the next field, now service-aware
      const systemPrompt = createAgenticOnboardingPrompt(
        onboardingFlow,
        collectedData,
        service
      );
      console.log(
        "[Onboarding] Generated dynamic system prompt for next field (service:", service, ")"
      );
      console.log("[Onboarding] System prompt preview:", systemPrompt.substring(0, 200) + "...");

      // Format messages for OpenAI
      const formattedMessages = formatMessagesForOpenAI(
        threadMessagesForOnboarding,  // Use the converted ThreadMessage[] format
        "individual"
      );

      console.log(
        "OpenAI completion happening at handleAgenticOnboardingFollowUp function"
      );

      const response = await openaiClient.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...formattedMessages,
        ],
        max_tokens: service === 'sms' ? 300 : 1000,
        temperature: 0.7,
      });

      console.log("OpenAI chat completion response received");
      responseContent =
        response.choices[0]?.message?.content ||
        "I'm sorry, I couldn't process your message. Could you please try again?";
      console.log(`[Onboarding] Generated agentic follow-up response:`, responseContent);
      
      // Save partial onboarding data
      if (senderNumber && Object.keys(collectedData).length > 0 && adapter) {
        await saveOnboardingInfoToDatabase(
          adapter,
          senderNumber,
          collectedData,
          false // isComplete
        );
      }
    }

    return { text: responseContent, waitForResponse: !allFieldsCollected };
  } catch (error) {
    console.error("[Onboarding] Error in agentic follow-up handling:", error);
    let fallbackMessage = "I'm having trouble processing your message. Let's continue with the onboarding. Could you please tell me your name?";
    if (service === 'sms') {
      fallbackMessage = "Sorry, error processing. What's your name?";
    }
    return {
      text: fallbackMessage,
      waitForResponse: true,
    };
  }
}

// --- MESSAGE STORAGE ---

/**
 * Saves a message to in-memory storage, ensuring context limits and filtering out agent's own messages.
 */
async function saveMessageToMemory(
  threadId: string,
  message: MessageRecord
): Promise<void> {
  let threadMessages = messagesByThread.get(threadId) || [];
  threadMessages.push(message);

  if (threadMessages.length > MAX_CONTEXT_MESSAGES) {
    threadMessages = threadMessages.slice(-MAX_CONTEXT_MESSAGES);
  }

  // Note: We now keep agent messages in memory to ensure proper conversation flow,
  // especially for onboarding and other stateful interactions.
  // The AI context management will handle deduplication if needed.

  messagesByThread.set(threadId, threadMessages);
}

/**
 * Persists the incoming message, trying Supabase first, then falling back to in-memory.
 * Returns the database chat ID if successful with Supabase.
 */
async function persistIncomingMessage(
  webhookData: WebhookPayload,
  adapter: SupabaseAdapter | null
): Promise<{ chatId: string | null; isNewChatInDb: boolean }> {
  const {
    thread_id,
    message_id,
    message_content,
    message_type,
    sender_number,
    sender_name,
    timestamp,
    thread_type,
  } = webhookData;
  const content = message_content.text || ""; // For backward compatibility

  const messageRecord: MessageRecord = {
    message_id,
    content,
    message_type,
    message_content,
    sender_number,
    sender_name:
      sender_number === process.env.A1BASE_AGENT_NUMBER
        ? process.env.A1BASE_AGENT_NAME || sender_name
        : sender_name,
    timestamp,
  };

  let chatId: string | null = null;
  let isNewChatInDb = false;

  if (adapter) {
    try {
      console.log(
        `[MessageStore] Storing user message via processWebhookPayload. Thread ID: ${thread_id}, Message ID: ${message_id}`
      );
      const {
        success,
        isNewChat,
        chatId: processedChatId,
      } = await adapter.processWebhookPayload(webhookData);
      isNewChatInDb = isNewChat ?? false; // Default to false if undefined

      if (success && processedChatId) {
        // Use the chatId returned by processWebhookPayload
        chatId = processedChatId;
        console.log(
          `[MessageStore] processWebhookPayload success. Chat ID: ${chatId}, Is New Chat: ${isNewChatInDb}`
        );
      } else if (success && !processedChatId && thread_id) {
        // This case might be less likely now if processWebhookPayload always returns a chatId (even if null on failure)
        // Kept for safety, but ideally processWebhookPayload is consistent.
        const threadData = await adapter.getThread(thread_id);
        if (threadData) chatId = threadData.id;
        console.log(
          `[MessageStore] processWebhookPayload success (chatId not in response or null). Fetched thread. Chat ID: ${chatId}`
        );
      } else {
        console.error(
          `[MessageStore] Failed to store webhook data via Supabase for message ${message_id}. Success: ${success}, Processed Chat ID: ${processedChatId}`
        );
      }
      // Store in memory as a redundant measure or if Supabase failed partially
      await saveMessageToMemory(thread_id, messageRecord);
    } catch (error) {
      console.error(
        "[MessageStore] Error processing webhook data with Supabase:",
        error
      );
      // Fallback to in-memory storage only
      await saveMessage(
        thread_id,
        messageRecord,
        thread_type,
        null,
        saveMessageToMemory
      );
    }
  } else {
    // No database adapter, use in-memory storage only
    await saveMessage(
      thread_id,
      messageRecord,
      thread_type,
      null,
      saveMessageToMemory
    );
  }
  return { chatId, isNewChatInDb };
}

/**
 * Retrieves thread messages, prioritizing Supabase then falling back to in-memory.
 */
async function getThreadMessages(
  threadId: string,
  adapter: SupabaseAdapter | null
): Promise<MessageRecord[]> {
  console.log(`[getThreadMessages] Getting messages for thread: ${threadId}`);
  
  if (adapter) {
    const thread = await adapter.getThread(threadId);
    console.log(`[getThreadMessages] Thread data found:`, {
      hasThread: !!thread,
      messageCount: thread?.messages?.length || 0,
      threadId: thread?.id
    });
    
    if (thread?.messages && thread.messages.length > 0) {
      // Log message details for debugging
      console.log(`[getThreadMessages] Retrieved ${thread.messages.length} messages from DB`);
      thread.messages.forEach((msg, idx) => {
        console.log(`  [${idx}] sender: ${msg.sender_number}, content: "${msg.content?.substring(0, 50)}..."`);
      });
      return thread.messages;
    }
  }
  
  // Fallback to in-memory
  const memoryMessages = messagesByThread.get(threadId) || [];
  console.log(`[getThreadMessages] Using in-memory messages, count: ${memoryMessages.length}`);
  return memoryMessages;
}

// --- MESSAGE SENDING ---

/**
 * Sends a response message, handling splitting and channel specifics.
 */
async function sendResponseMessage(
  text: string,
  threadType: "individual" | "group",
  recipientId: string, // thread_id for group, sender_number for individual
  service: string, // Original service from webhook, e.g., "whatsapp" or "sms"
  chatId: string | null, // Database chat ID for storing AI message
  adapter: SupabaseAdapter | null
): Promise<void> {
  // Import SMS dependencies at the top of the function (or file)
  const { extendedClient } = require("@/lib/a1base-chat-context/extended-client");
  const { SMSHandler } = require("@/lib/services/sms-handler");
  
  // Log all arguments when sending a message
  console.log("[Send] === sendResponseMessage called with arguments ===");
  console.log("[Send] text:", text);
  console.log("[Send] from:", process.env.A1BASE_AGENT_NUMBER);
  console.log("[Send] threadType:", threadType);
  console.log("[Send] recipientId:", recipientId);
  console.log("[Send] service:", service);
  console.log("[Send] chatId:", chatId);
  console.log("[Send] adapter:", adapter ? "SupabaseAdapter instance" : null);
  console.log("[Send] ================================================");
  
  if (service === SERVICE_WEB_UI || service === SERVICE_SKIP_SEND) {
    console.log(`[Send] Skipping send for service: ${service}`);
    return;
  }

  // Validate agent configuration
  if (!process.env.A1BASE_AGENT_NUMBER) {
    console.error("[Send] ERROR: A1BASE_AGENT_NUMBER is not configured!");
    throw new Error("A1BASE_AGENT_NUMBER environment variable is not set");
  }
  
  if (!process.env.A1BASE_ACCOUNT_ID) {
    console.error("[Send] ERROR: A1BASE_ACCOUNT_ID is not configured!");
    throw new Error("A1BASE_ACCOUNT_ID environment variable is not set");
  }

  // Handle SMS-specific logic
  if (service === 'sms') {
    console.log("[Send] Processing SMS message");
    
    // Validate SMS content
    const validation = SMSHandler.validateSMSContent(text);
    
    if (!validation.valid) {
      console.error(`[Send] SMS validation failed: ${validation.error}`);
      
      // Store failed attempt in database
      if (adapter && chatId) {
        try {
          const agentUserId = await ensureAgentUserExists(adapter);
          await adapter.storeMessage(
            chatId,
            agentUserId,
            `sms-failed-${Date.now()}`,
            {
              text: text.substring(0, 100) + '... [MESSAGE TOO LONG]',
              error: validation.error,
              originalLength: validation.length
            },
            'text',
            'sms',
            {
              status: 'failed',
              error: validation.error
            }
          );
        } catch (storeError) {
          console.error("[Send] Failed to store SMS error in database:", storeError);
        }
      }
      
      // Send a shortened error message to the user
      const errorMessage = "I apologize, but my response was too long for SMS. Please ask me to be more concise, or we can continue via WhatsApp for detailed responses.";
      
      try {
        const smsPayload = {
          content: { message: errorMessage },
          from: process.env.A1BASE_AGENT_NUMBER!,
          to: recipientId,
          service: 'sms' as const,
          type: 'individual' as const,
        };
        
        await extendedClient.sendSMS(process.env.A1BASE_ACCOUNT_ID!, smsPayload);
        console.log("[Send] Sent SMS error message to user");
      } catch (errorSendError) {
        console.error("[Send] Failed to send SMS error message:", errorSendError);
      }
      
      return;
    }
    
    // Send valid SMS
    try {
      const smsPayload = {
        content: { message: SMSHandler.sanitizeForSMS(text) },
        from: process.env.A1BASE_AGENT_NUMBER!,
        to: recipientId,
        service: 'sms' as const,
        type: 'individual' as const,
      };
      
      const result = await extendedClient.sendSMS(process.env.A1BASE_ACCOUNT_ID!, smsPayload);
      console.log(`[Send] SMS sent successfully to ${recipientId}`);
      console.log(`[Send] SMS send result:`, result);
      
      // Note: We don't store the SMS message here because it will be stored when
      // the webhook comes back from A1Base. This prevents duplicate messages in the database.
    } catch (error) {
      console.error(`[Send] Error sending SMS to ${recipientId}:`, error);
      throw error;
    }
    
    return;
  }

  // Original WhatsApp logic continues below
  const splitParagraphs = await getSplitMessageSetting();
  const messageLines = splitParagraphs
    ? text.split("\n").filter((line) => line.trim())
    : [text];

  for (const line of messageLines) {
    const messageData = {
      content: line,
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: WHATSAPP_SERVICE_NAME,
    };

    try {
      if (threadType === "group") {
        // Validate thread_id format
        if (!recipientId || recipientId.trim() === "") {
          console.error(`[Send] Invalid thread_id for group message: "${recipientId}"`);
          throw new Error("Invalid thread_id for group message");
        }
        
        console.log(`[Send] Sending group message with data:`, {
          ...messageData,
          thread_id: recipientId,
        });
        console.log(`[Send] Thread ID: "${recipientId}", length: ${recipientId.length}`);
        
        const result = await a1BaseClient.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          thread_id: recipientId,
        });
        console.log(`[Send] Group message send result:`, result);
        
        // If result is undefined but no error was thrown, consider it a success
        if (result === undefined) {
          console.log(`[Send] Group message API returned undefined (this may be normal behavior)`);
        }
      } else {
        const result = await a1BaseClient.sendIndividualMessage(
          process.env.A1BASE_ACCOUNT_ID!,
          {
            ...messageData,
            to: recipientId,
          }
        );
        console.log(`[Send] Individual message send result:`, result);
      }
      console.log(
        `[Send] Message part sent to ${recipientId} (Type: ${threadType})`
      );
      
      // Note: We don't store the message here because it will be stored when
      // the webhook comes back from A1Base. This prevents duplicate messages in the database.
      // The webhook ensures we have the actual message ID from A1Base and confirms delivery.
    } catch (error) {
      console.error(
        `[Send] Error sending message part to ${recipientId}:`,
        error
      );
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error(`[Send] Error name: ${error.name}`);
        console.error(`[Send] Error message: ${error.message}`);
        console.error(`[Send] Error stack:`, error.stack);
      }
      
      // Check for specific API error responses
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as any;
        console.error(`[Send] API Response status:`, apiError.response?.status);
        console.error(`[Send] API Response data:`, apiError.response?.data);
      }
      
      console.error(`[Send] Error details:`, JSON.stringify(error, null, 2));
      // Optional: Decide if we should re-throw or try next line
    }

    if (splitParagraphs && messageLines.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between split messages
    }
  }
}

/**
 * Sends a multimedia response message.
 */
async function sendMultimediaResponseMessage(
  mediaUrl: string,
  mediaType: MediaType,
  caption: string | undefined,
  threadType: "individual" | "group",
  recipientId: string, // thread_id for group, sender_number for individual
  service: string, // Original service from webhook, e.g., "whatsapp"
  chatId: string | null, // Database chat ID for storing AI message
  adapter: SupabaseAdapter | null
): Promise<void> {
  // Log all arguments when sending a multimedia message
  console.log("[Send] === sendMultimediaResponseMessage called with arguments ===");
  console.log("[Send] mediaUrl:", mediaUrl);
  console.log("[Send] mediaType:", mediaType);
  console.log("[Send] caption:", caption);
  console.log("[Send] threadType:", threadType);
  console.log("[Send] recipientId:", recipientId);
  console.log("[Send] service:", service);
  console.log("[Send] chatId:", chatId);
  console.log("[Send] adapter:", adapter ? "SupabaseAdapter instance" : null);
  console.log("[Send] ==========================================================");
  
  if (service === SERVICE_WEB_UI || service === SERVICE_SKIP_SEND) {
    console.log(`[Send] Skipping multimedia send for service: ${service}`);
    return;
  }

  try {
    await sendMultimediaMessage(
      a1BaseClient,
      process.env.A1BASE_ACCOUNT_ID!,
      threadType,
      recipientId,
      mediaUrl,
      mediaType,
      caption
    );
    console.log(
      `[Send] Multimedia message sent to ${recipientId} (Type: ${threadType}, Media: ${mediaType})`
    );

    // Note: We don't store the multimedia message here because it will be stored when
    // the webhook comes back from A1Base. This prevents duplicate messages in the database.
    // The webhook ensures we have the actual message ID from A1Base and confirms delivery.
  } catch (error) {
    console.error(
      `[Send] Error sending multimedia message to ${recipientId}:`,
      error
    );
  }
}

// --- ONBOARDING STATUS & WORKFLOW ---

/**
 * Determines if onboarding should be triggered for the current interaction.
 */
async function checkIfOnboardingNeeded(
  threadId: string,
  adapter: SupabaseAdapter | null,
  threadMessages: MessageRecord[]
): Promise<boolean> {
  console.log(`[OnboardingCheck] Checking thread ${threadId}, messages count: ${threadMessages.length}`);
  
  // Debug: Log all messages
  console.log(`[OnboardingCheck] Thread messages:`);
  threadMessages.forEach((msg, idx) => {
    console.log(`  [${idx}] sender: ${msg.sender_number}, content: "${msg.content?.substring(0, 60)}..."`);
  });
  
  // Check if the user explicitly requested onboarding
  const latestMessage = threadMessages[threadMessages.length - 1];
  if (latestMessage && 
      latestMessage.content && 
      latestMessage.content.trim().toLowerCase() === "start onboarding") {
    console.log(`[OnboardingCheck] User explicitly requested onboarding for ${threadId}`);
    return true;
  }

  if (!adapter) {
    // If no DB, check if this is the first message in memory
    const hasAgentMessages = threadMessages.some(
      msg => normalizePhoneNumber(msg.sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "")
    );
    console.log(`[OnboardingCheck] No adapter, hasAgentMessages: ${hasAgentMessages}`);
    // Need onboarding if no agent messages yet (first interaction)
    return !hasAgentMessages;
  }

  const thread = await adapter.getThread(threadId);
  if (!thread) {
    console.log(
      `[OnboardingCheck] No thread found in DB for ${threadId}, onboarding needed.`
    );
    return true; // New thread in DB
  }

  console.log(`[OnboardingCheck] Thread found in DB, checking messages...`);
  console.log(`[OnboardingCheck] Thread has ${thread.messages?.length || 0} messages in DB`);
  
  // Check if we have any agent messages in this thread
  const hasAgentMessagesInThread = thread.messages?.some(
    msg => normalizePhoneNumber(msg.sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "")
  ) || false;

  console.log(`[OnboardingCheck] Has agent messages in thread: ${hasAgentMessagesInThread}`);
  
  // Debug: Show agent messages found
  if (thread.messages) {
    const agentMessages = thread.messages.filter(msg => normalizePhoneNumber(msg.sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || ""));
    console.log(`[OnboardingCheck] Found ${agentMessages.length} agent messages:`);
    agentMessages.forEach((msg, idx) => {
      console.log(`  Agent[${idx}]: "${msg.content?.substring(0, 60)}..."`);
    });
  }

  if (!hasAgentMessagesInThread) {
    console.log(
      `[OnboardingCheck] No agent messages found in thread ${threadId}, onboarding needed.`
    );
    return true; // First interaction with the agent
  }

  // Check if onboarding is already complete in user metadata
  if (thread.sender) {
    const onboardingComplete =
      thread.sender.metadata?.onboarding_complete === true;
    console.log(
      `[OnboardingCheck] User: ${thread.sender.name}, Onboarding complete in DB: ${onboardingComplete}`
    );
    
    if (onboardingComplete) {
      return false; // Onboarding is already complete
    }
  }

  // Check if onboarding is in progress by looking for onboarding patterns in messages
  const isOnboardingInProgress = threadMessages.some(msg => {
    if (normalizePhoneNumber(msg.sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "") && msg.content) {
      const content = msg.content.toLowerCase();
      return content.includes('full name') || 
             content.includes('your name') ||
             content.includes('email') ||
             content.includes('e-mail') ||
             content.includes('dream') ||
             content.includes('founder mode') ||
             content.includes('get started');
    }
    return false;
  });

  console.log(`[OnboardingCheck] Is onboarding in progress: ${isOnboardingInProgress}`);
  
  // If onboarding is in progress, we need to continue it
  return isOnboardingInProgress;
}

/**
 * Handles the overall onboarding process for an individual user.
 */
async function manageIndividualOnboardingProcess(
  threadMessages: MessageRecord[],
  webhookData: WebhookPayload,
  adapter: SupabaseAdapter | null,
  chatId: string | null
): Promise<boolean> {
  // Returns true if onboarding message was sent
  console.log("manageIndividualOnboardingProcess START. Service:", webhookData.service);
  const { thread_id, sender_number, thread_type, service } = webhookData;

  // Check if we have any messages from the agent (indicating onboarding has started)
  const hasAgentMessages = threadMessages.some(
    msg => normalizePhoneNumber(msg.sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "")
  );
  
  // Onboarding is in progress if we have both user messages and agent messages
  const isOnboardingInProgress = hasAgentMessages && threadMessages.length > 1;

  if (isOnboardingInProgress) {
    console.log(
      `[OnboardingFlow] Continuing agentic onboarding for thread ${thread_id}`
    );
    try {
      const response = await handleAgenticOnboardingFollowUp(
        threadMessages,
        sender_number,
        adapter,
        service
      );
      await sendResponseMessage(
        response.text,
        thread_type as "individual" | "group",
        sender_number,
        service,
        chatId,
        adapter
      );
      return true; // Onboarding follow-up handled and message sent (or skipped appropriately)
    } catch (error) {
      console.error(
        `[OnboardingFlow] Error in agentic onboarding follow-up for ${thread_id}:`,
        error
      );
      // Fall through to standard triage if specific onboarding follow-up fails
      return false;
    }
  } else {
    // This is the first message or first interaction, start onboarding with context
    console.log(
      `[OnboardingFlow] Starting initial onboarding for thread ${thread_id} with ${threadMessages.length} messages`
    );
    try {
      // Convert MessageRecord[] to ThreadMessage[] to satisfy type requirements
      const threadMessagesForOnboarding = threadMessages.map((msg) => ({
        ...msg,
        // Add the role property based on sender - normalize both numbers for comparison
        role: normalizePhoneNumber(msg.sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "") ? "assistant" as const : "user" as const,
        // Ensure message_type is one of the expected types
        message_type:
          msg.message_type === "text" ||
          msg.message_type === "rich_text" ||
          msg.message_type === "image" ||
          msg.message_type === "video" ||
          msg.message_type === "audio" ||
          msg.message_type === "location" ||
          msg.message_type === "reaction" ||
          msg.message_type === "group_invite"
            ? msg.message_type
            : "unsupported_message_type",
      })) as ThreadMessage[];

      const onboardingResponse: { messages: { text: string; waitForResponse: boolean }[] } | undefined =
        await StartOnboarding(
          threadMessagesForOnboarding, // Pass the converted threadMessages with user's actual message
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          SERVICE_SKIP_SEND, // Prevent StartOnboarding from sending directly
          chatId || undefined  // Convert null to undefined for the type
        );

      if (onboardingResponse?.messages?.length) {
        for (const message of onboardingResponse.messages) {
          await sendResponseMessage(
            message.text,
            thread_type as "individual" | "group",
            sender_number,
            service,
            chatId,
            adapter
          );
          // Original code had a 1s delay between distinct onboarding messages.
          if (onboardingResponse.messages.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
        return true; // Initial onboarding messages sent
      } else {
        console.log(
          `[OnboardingFlow] StartOnboarding did not return messages for ${thread_id}`
        );
        return false; // No messages to send from initial onboarding
      }
    } catch (error) {
      console.error(
        `[OnboardingFlow] Error in initial StartOnboarding for ${thread_id}:`,
        error
      );
      return false; // Error, fall through to standard triage
    }
  }
}

// --- MAIN HANDLER ---

export async function handleWhatsAppIncoming(
  webhookData: WebhookPayload
): Promise<object> {
  if (isSupabaseConfigured()) {
    await initializeDatabase(); // This initializes the singleton instance in config.ts
  }
  const adapter = await getInitializedAdapter(); // Added await here
  console.log("WebhookData:", webhookData);
  const {
    thread_id,
    message_id,
    message_content,
    sender_number,
    sender_name, // Use this directly, persistIncomingMessage will handle agent name override
    thread_type,
    timestamp,
    service,
    message_type, // Added for completeness from webhookData
    agent_mentioned, // Extract agent_mentioned field
  } = webhookData;
  const content = message_content.text || ""; // Backward compatibility

  console.log("[Message Received]", {
    sender_number,
    message_content,
    thread_type,
    timestamp,
    service,
    agent_mentioned,
  });

  // Add detailed logging for agent check
  console.log("[DEBUG] Agent number check:");
  console.log(`  - sender_number: "${sender_number}"`);
  console.log(`  - A1BASE_AGENT_NUMBER: "${process.env.A1BASE_AGENT_NUMBER}"`);
  console.log(`  - Normalized sender: "${sender_number.replace(/\+|\s/g, "")}"`);
  console.log(`  - Normalized agent: "${process.env.A1BASE_AGENT_NUMBER?.replace(/\+|\s/g, "")}"`);
  console.log(`  - Direct comparison: ${sender_number === process.env.A1BASE_AGENT_NUMBER}`);
  console.log(`  - Normalized comparison: ${normalizePhoneNumber(sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "")}`);

  // 1. Skip processing for agent's own messages
  if (sender_number === process.env.A1BASE_AGENT_NUMBER) {
    console.log("[AgentMsg] Processing agent's own message for storage.");
    if (adapter) {
      await adapter.processWebhookPayload(webhookData);
      console.log("[AgentMsg] Agent's own message processed by adapter.");
    } else {
      console.warn(
        "[AgentMsg] Supabase adapter not initialized. Agent message not stored in DB."
      );
      // Optionally, save agent's message to memory if that's desired behavior, though original didn't explicitly for agent.
      // await saveMessageToMemory(thread_id, { message_id, content, message_type, message_content, sender_number, sender_name: process.env.A1BASE_AGENT_NAME || sender_name, timestamp });
    }
    return {
      success: true,
      message:
        "Agent message processed for storage and skipped for further logic.",
    };
  }

  // 1. Handle agent's own messages - ensure they are properly stored
  if (sender_number === process.env.A1BASE_AGENT_NUMBER || 
      normalizePhoneNumber(sender_number) === normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "")) {
    console.log("[AgentMsg] Processing agent's own message for storage.");
    console.log("[AgentMsg] Agent message details:", {
      message_id,
      content: content.substring(0, 100),
      thread_id,
      sender_number,
      normalized_sender: normalizePhoneNumber(sender_number),
      normalized_agent: normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER || "")
    });
    
    // Store the agent message using the same logic as user messages
    const { chatId, isNewChatInDb } = await persistIncomingMessage(
      webhookData,
      adapter
    );
    
    if (chatId) {
      console.log(`[AgentMsg] Agent message stored successfully. Chat ID: ${chatId}`);
    } else {
      console.warn("[AgentMsg] Failed to store agent message - no chat ID returned");
    }
    
    // Also save to memory for immediate availability
    const agentMessage: MessageRecord = {
      message_id,
      content,
      message_type,
      message_content,
      sender_number,
      sender_name: process.env.A1BASE_AGENT_NAME || sender_name,
      timestamp,
    };
    await saveMessageToMemory(thread_id, agentMessage);
    console.log("[AgentMsg] Agent message saved to memory");
    
    return {
      success: true,
      message: "Agent message processed and stored successfully.",
    };
  }

  // 2. Check agent profile preferences for "respond only when mentioned" setting (only for group chats)
  if (service === 'whatsapp' && thread_type === 'group') {
    try {
      // Get agent profile settings to check group chat preferences
      const agentProfile = await getAgentProfileSettings();
      const respondOnlyWhenMentioned = agentProfile?.groupChatPreferences?.respond_only_when_mentioned || false;
      
      console.log(`[MENTION_CHECK] Agent respond_only_when_mentioned setting: ${respondOnlyWhenMentioned}`);
      console.log(`[MENTION_CHECK] Agent mentioned in group message: ${agent_mentioned}`);
      
      if (respondOnlyWhenMentioned && !agent_mentioned) {
        console.log(`[MENTION_CHECK] Skipping group message processing - agent not mentioned and respond_only_when_mentioned is enabled`);
        
        // Still store the message for record keeping
        await persistIncomingMessage(webhookData, adapter);
        
        return {
          success: true,
          message: "Group message stored but skipped processing - agent not mentioned and respond_only_when_mentioned is enabled",
        };
      } else if (respondOnlyWhenMentioned && agent_mentioned) {
        console.log(`[MENTION_CHECK] Processing group message - agent was mentioned and respond_only_when_mentioned is enabled`);
      } else {
        console.log(`[MENTION_CHECK] Processing group message - respond_only_when_mentioned is disabled`);
      }
    } catch (error) {
      console.error(`[MENTION_CHECK] Error checking agent profile preferences:`, error);
      // Continue with normal processing if there's an error checking preferences
      console.log(`[MENTION_CHECK] Continuing with normal processing due to preference check error`);
    }
  } else if (thread_type === 'individual') {
    console.log(`[MENTION_CHECK] Individual chat detected - mention preferences do not apply, processing normally`);
  }

  // Process multimedia messages
  let processedContent = content;
  let mediaInfo: any = null;
  
  if (message_type !== 'text' && message_type !== 'rich_text') {
    const mediaData = processIncomingMediaMessage(message_content, message_type);
    
    if (message_type === 'location' && mediaData.location) {
      processedContent = `[Location shared: ${mediaData.location.name || 'Unnamed location'} at ${mediaData.location.latitude}, ${mediaData.location.longitude}${mediaData.location.address ? ` - ${mediaData.location.address}` : ''}]`;
    } else if (message_type === 'reaction' && message_content.reaction) {
      processedContent = `[Reacted with: ${message_content.reaction}]`;
    } else if (message_type === 'group_invite' && message_content.groupName) {
      processedContent = `[Group invite to: ${message_content.groupName}]`;
    } else if (mediaData.mediaType) {
      processedContent = `[${mediaData.mediaType.charAt(0).toUpperCase() + mediaData.mediaType.slice(1)} received${mediaData.caption ? `: ${mediaData.caption}` : ''}]`;
      mediaInfo = mediaData;
    } else if (message_type === 'unsupported_message_type') {
      processedContent = '[Unsupported message type received]';
    }
  }

  // --- Start Memory Update Processing (non-blocking) ---
  // We'll set up the memory processing promise but won't start it until we have the chatId
  let memoryProcessingPromise: Promise<void> | null = null;

  // 3. Persist incoming user message (DB and/or memory)
  const { chatId, isNewChatInDb } = await persistIncomingMessage(
    webhookData,
    adapter
  );

  // Now that we have the chatId, start memory processing if we have content
  if (processedContent && processedContent.trim() !== "" && chatId && adapter) {
    console.log(
      `[MemoryProcessor] Starting parallel memory processing for ${sender_number} in chat ${chatId}`
    );
    
    // Create a promise that runs memory processing but doesn't block the main flow
    memoryProcessingPromise = (async () => {
      try {
        const memorySuggestions = await processMessageForMemoryUpdates(
          processedContent,
          sender_number, // Using sender_number as userId
          chatId, // Use the internal chat UUID
          openaiClient,
          adapter // Pass the adapter instance
        );

        if (memorySuggestions.userMemoryUpdates.length > 0) {
          console.log(
            `[MemoryProcessor] Suggested User Memory Updates for ${sender_number}:`,
            JSON.stringify(memorySuggestions.userMemoryUpdates, null, 2)
          );
        }
        if (memorySuggestions.chatMemoryUpdates.length > 0) {
          console.log(
            `[MemoryProcessor] Suggested Chat Memory Updates for ${chatId}:`,
            JSON.stringify(memorySuggestions.chatMemoryUpdates, null, 2)
          );
        }
        if (
          memorySuggestions.userMemoryUpdates.length === 0 &&
          memorySuggestions.chatMemoryUpdates.length === 0
        ) {
          console.log(
            `[MemoryProcessor] No memory updates suggested for message: "${processedContent}"`
          );
        }
        console.log(`[MemoryProcessor] Memory processing completed for ${chatId}`);
      } catch (memError) {
        console.error(
          "[MemoryProcessor] Error during memory update processing:",
          memError
        );
      }
    })();
    
    // We do NOT await the promise here, allowing it to run in parallel
  } else if (processedContent && processedContent.trim() !== "" && !chatId) {
    console.log(
      `[MemoryProcessor] Skipping memory processing - no chat ID available for thread ${thread_id}`
    );
  }
  // --- End Memory Update Processing Initiation ---

  // 2. Handle active group onboarding (early exit if message is part of it)
  if (thread_type === "group") {
    try {
      if (await isGroupInOnboardingState(thread_id)) {
        console.log(
          `[GroupOnboard] Group chat ${thread_id} has onboarding in progress.`
        );
        // Reconstruct a full payload for processGroupOnboardingMessage as original did
        const groupOnboardingPayload: WebhookPayload = { ...webhookData };
        if (await processGroupOnboardingMessage(groupOnboardingPayload)) {
          console.log(
            `[GroupOnboard] Successfully processed group onboarding response for ${thread_id}.`
          );
          return {
            success: true,
            message: "Group onboarding response processed.",
          };
        }
      }
    } catch (error) {
      console.error(
        `[GroupOnboard] Error checking/processing group onboarding for ${thread_id}:`,
        error
      );
      // Continue with normal processing if error occurs
    }
  }

  // 4. Handle new group chat onboarding initiation
  if (thread_type === "group" && adapter) {
    // adapter check because handleGroupChatOnboarding likely interacts with DB
    // isNewChatInDb comes from adapter.processWebhookPayload result.
    // If using only memory, isNewChatInDb would be false.
    // Original code called handleGroupChatOnboarding if (success && thread_type === 'group') after adapter.processWebhookPayload
    // 'success' there implied DB storage success. isNewChatInDb reflects the "newness" in DB.
    if (await handleGroupChatOnboarding(webhookData, isNewChatInDb)) {
      console.log(`[GroupOnboard] Group onboarding started for ${thread_id}.`);
      return { success: true, message: "Group onboarding started." };
    }
  }

  // 5. Retrieve current thread messages (from DB or memory)
  let threadMessages = await getThreadMessages(thread_id, adapter);

  // 6. Project Triage (if chatId is available)
  if (chatId && adapter) {
    // Assuming projectTriage needs adapter implicitly or explicitly
    try {
      await projectTriage(threadMessages, thread_id, chatId, service); // projectId is not used later, so just await
    } catch (error) {
      console.error(`[ProjectTriage] Error for thread ${thread_id}:`, error);
    }
  }

  // 7. Determine if onboarding is needed for this user/thread
  console.log(`[DEBUG] Checking if onboarding is needed for thread ${thread_id}`);
  console.log(`[DEBUG] Thread messages count: ${threadMessages.length}`);
  console.log(`[DEBUG] Thread type: ${thread_type}`);
  
  const shouldTriggerOnboarding = await checkIfOnboardingNeeded(
    thread_id,
    adapter,
    threadMessages
  );
  
  console.log(`[DEBUG] shouldTriggerOnboarding result: ${shouldTriggerOnboarding}`);

  // 8. Handle Onboarding Flow OR Standard Triage
  let triageResponseMessageText: string | null = null;
  let onboardingHandled = false;

  if (shouldTriggerOnboarding && thread_type === "individual") {
    // Original code seemed to focus onboarding logic mostly on individual, group had its own path
    console.log(
      `[FlowCtrl] Onboarding determined as_needed for individual user in thread ${thread_id}.`
    );
    onboardingHandled = await manageIndividualOnboardingProcess(
      threadMessages,
      webhookData,
      adapter,
      chatId
    );
  } else {
    console.log(`[DEBUG] Onboarding not triggered because:`, {
      shouldTriggerOnboarding,
      thread_type,
      isIndividual: thread_type === "individual"
    });
  }

  if (!onboardingHandled) {
    console.log(
      `[FlowCtrl] Proceeding to standard message triage for thread ${thread_id}. OnboardingHandled: ${onboardingHandled}`
    );
    try {
      const triageResult = await triageMessage({
        thread_id,
        message_id,
        content: processedContent,
        message_type,
        message_content,
        sender_name,
        sender_number,
        thread_type,
        timestamp,
        messagesByThread, // triageMessage uses this for in-memory context
        service: SERVICE_SKIP_SEND, // Prevent triageMessage from sending directly
      });

      console.log(`[DEBUG] Triage result for thread ${thread_id}:`, {
        success: triageResult.success,
        hasMessage: !!triageResult.message,
        messageLength: triageResult.message?.length || 0,
        type: triageResult.type
      });

      if (triageResult.success && triageResult.message) {
        triageResponseMessageText = triageResult.message;
        console.log(`[DEBUG] Setting triageResponseMessageText for thread ${thread_id}, length: ${triageResponseMessageText.length}`);
      } else if (!triageResult.success) {
        console.error(
          `[Triage] Failed for thread ${thread_id}: ${triageResult.message}`
        );
        triageResponseMessageText =
          "Sorry, I'm having trouble processing your request right now. Please try again later.";
      }
    } catch (error) {
      console.error(`[Triage] Critical error for thread ${thread_id}:`, error);
      triageResponseMessageText =
        "An unexpected error occurred. Please try again later.";
    }
  }

  // 9. Send Response (if any was generated and not sent by onboarding)
  if (triageResponseMessageText) {
    // Determine recipient ID based on thread type
    const recipient = thread_type === "group" ? thread_id : sender_number;
    console.log(`[DEBUG] Preparing to send response. Thread type: ${thread_type}, Recipient: ${recipient}, Service: ${service}`);
    const result = await sendResponseMessage(
      triageResponseMessageText,
      thread_type as "individual" | "group",
      recipient,
      service,
      chatId,
      adapter
    );
    console.log("[Send] result:", result);
    console.log(`[DEBUG] sendResponseMessage completed for ${recipient}`);
  } else if (!onboardingHandled) {
    console.log(
      `[FlowCtrl] No response generated by triage and onboarding not handled for thread ${thread_id}.`
    );
  }

  return { success: true, message: "Incoming message processed." };
}