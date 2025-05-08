// import { WhatsAppIncomingData } from "a1base-node";
import { MessageRecord } from "@/types/chat";
import { triageMessage, projectTriage } from "./triage-logic";
import {
  initializeDatabase,
  getInitializedAdapter,
  isSupabaseConfigured,
  SupabaseAdapter,
} from "../supabase/config"; // Added SupabaseAdapter type
import { WebhookPayload } from "@/app/api/messaging/incoming/route";
import {
  StartOnboarding,
  OnboardingResponse,
} from "../workflows/onboarding-workflow"; // Added OnboardingResponse type
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
 * Formats messages for OpenAI API.
 */
function formatMessagesForOpenAI(
  threadMessages: MessageRecord[]
): { role: "user" | "assistant"; content: string }[] {
  return threadMessages.map((msg) => ({
    role:
      msg.sender_number === process.env.A1BASE_AGENT_NUMBER
        ? "assistant"
        : "user",
    content: msg.content,
  }));
}

/**
 * Extracts JSON from a string, attempting to find a valid JSON object within.
 */
function extractJsonFromString(content: string): Record<string, any> {
  let jsonContent = content;
  if (content.includes("{") && content.includes("}")) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
  }
  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    console.error(
      "[JSON Extraction] Error parsing content:",
      e,
      "Original content:",
      content
    );
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

    const formattedMessages = formatMessagesForOpenAI(threadMessages);

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

    const extraction = await openaiClient.chat.completions.create({
      model: "gpt-4",
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
  adapter?: SupabaseAdapter | null
): Promise<{ text: string; waitForResponse: boolean }> {
  console.log("[Onboarding] Handling agentic follow-up onboarding message");
  try {
    const onboardingFlow = await loadOnboardingFlow();
    const systemPrompt = createAgenticOnboardingPrompt(onboardingFlow);
    const formattedMessages = formatMessagesForOpenAI(threadMessages);

    console.log(
      `[Onboarding] Processing ${formattedMessages.length} messages for agentic follow-up`
    );

    const { extractedInfo, isComplete } = await processOnboardingConversation(
      threadMessages
    );

    if (senderNumber && Object.keys(extractedInfo).length > 0 && adapter) {
      await saveOnboardingInfoToDatabase(
        adapter,
        senderNumber,
        extractedInfo,
        isComplete
      );
    }

    let responseContent: string;
    if (isComplete) {
      const userName = extractedInfo.name || "there";
      responseContent =
        onboardingFlow.agenticSettings?.finalMessage ||
        `Thank you, ${userName}! Your onboarding is now complete. I've saved your information and I'm ready to help you with your tasks.`;
      console.log(
        `[Onboarding] Onboarding completed for user with phone number ${senderNumber}`
      );
    } else {
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system" as const, content: systemPrompt },
          ...formattedMessages,
        ],
        temperature: 0.7,
      });
      responseContent =
        completion.choices[0]?.message?.content ||
        "I'm sorry, I couldn't process your message. Could you please try again?";
      console.log(`[Onboarding] Generated agentic follow-up response`);
    }

    return { text: responseContent, waitForResponse: !isComplete };
  } catch (error) {
    console.error("[Onboarding] Error in agentic follow-up handling:", error);
    return {
      text: "I'm having trouble processing your message. Let's continue with the onboarding. Could you please tell me your name?",
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

  // Filter out messages from the agent itself from the context kept in memory.
  // This is done because the agent's previous responses are typically already part of the AI's context
  // or are not needed for the AI to formulate its *next* response to a *user*.
  // The primary use of this in-memory store is to provide recent user interaction context.
  const normalizedAgentNumber = process.env.A1BASE_AGENT_NUMBER
    ? normalizePhoneNumber(process.env.A1BASE_AGENT_NUMBER)
    : undefined;
  if (normalizedAgentNumber) {
    threadMessages = threadMessages.filter(
      (msg: MessageRecord) =>
        normalizePhoneNumber(msg.sender_number) !== normalizedAgentNumber
    );
  }

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
      const { success, isNewChat, chat } = await adapter.processWebhookPayload(
        webhookData
      );
      isNewChatInDb = isNewChat ?? false; // Default to false if undefined

      if (success && chat) {
        chatId = chat.id;
        console.log(
          `[MessageStore] processWebhookPayload success. Chat ID: ${chatId}, Is New Chat: ${isNewChatInDb}`
        );
      } else if (success && !chat && thread_id) {
        // If successful but chat object not returned, try fetching thread
        const threadData = await adapter.getThread(thread_id);
        if (threadData) chatId = threadData.id;
        console.log(
          `[MessageStore] processWebhookPayload success (chat object not in response). Fetched thread. Chat ID: ${chatId}`
        );
      } else {
        console.error(
          `[MessageStore] Failed to store webhook data via Supabase for message ${message_id}. Success: ${success}`
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
  if (adapter) {
    const thread = await adapter.getThread(threadId);
    if (thread?.messages && thread.messages.length > 0) {
      return thread.messages;
    }
  }
  return messagesByThread.get(threadId) || [];
}

// --- MESSAGE SENDING ---

/**
 * Sends a response message, handling splitting and channel specifics.
 */
async function sendResponseMessage(
  text: string,
  threadType: "individual" | "group",
  recipientId: string, // thread_id for group, sender_number for individual
  service: string, // Original service from webhook, e.g., "whatsapp"
  chatId: string | null, // Database chat ID for storing AI message
  adapter: SupabaseAdapter | null
): Promise<void> {
  if (service === SERVICE_WEB_UI || service === SERVICE_SKIP_SEND) {
    console.log(`[Send] Skipping send for service: ${service}`);
    return;
  }

  const splitParagraphs = await getSplitMessageSetting();
  const messageLines = splitParagraphs
    ? text.split("\n").filter((line) => line.trim())
    : [text];

  for (const line of messageLines) {
    const messageData = {
      content: line,
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: WHATSAPP_SERVICE_NAME as const, // Assuming A1Base only sends via WhatsApp for now
    };

    try {
      if (threadType === "group") {
        await a1BaseClient.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          thread_id: recipientId,
        });
      } else {
        await a1BaseClient.sendIndividualMessage(
          process.env.A1BASE_ACCOUNT_ID!,
          {
            ...messageData,
            to: recipientId,
          }
        );
      }
      console.log(
        `[Send] Message part sent to ${recipientId} (Type: ${threadType})`
      );
    } catch (error) {
      console.error(
        `[Send] Error sending message part to ${recipientId}:`,
        error
      );
      // Optional: Decide if we should re-throw or try next line
    }

    if (splitParagraphs && messageLines.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between split messages
    }
  }
}

// --- ONBOARDING STATUS & WORKFLOW ---

/**
 * Determines if onboarding should be triggered for the current interaction.
 */
async function checkIfOnboardingNeeded(
  threadId: string,
  adapter: SupabaseAdapter | null
): Promise<boolean> {
  if (!adapter) {
    // If no DB, assume new users always need onboarding until memory has messages
    const inMemoryMessages = messagesByThread.get(threadId) || [];
    return inMemoryMessages.length === 0; // True if no messages yet for this thread in memory
  }

  const thread = await adapter.getThread(threadId);
  if (!thread) {
    console.log(
      `[OnboardingCheck] No thread found in DB for ${threadId}, onboarding needed.`
    );
    return true; // New thread in DB
  }

  if (thread.sender) {
    const onboardingComplete =
      thread.sender.metadata?.onboarding_complete === true;
    console.log(
      `[OnboardingCheck] User: ${thread.sender.name}, Onboarding complete in DB: ${onboardingComplete}`
    );
    return !onboardingComplete;
  } else {
    console.log(
      `[OnboardingCheck] No sender info in thread ${threadId}, assuming onboarding needed.`
    );
    return true; // Default to needing onboarding if sender info is missing
  }
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
  const { thread_id, sender_number, thread_type, service } = webhookData;

  const isOnboardingInProgress = threadMessages.length > 1; // User has sent at least one message after initial contact

  if (isOnboardingInProgress) {
    console.log(
      `[OnboardingFlow] Continuing agentic onboarding for thread ${thread_id}`
    );
    try {
      const response = await handleAgenticOnboardingFollowUp(
        threadMessages,
        sender_number,
        adapter
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
    // This is the first message, start standard (non-agentic) onboarding
    console.log(
      `[OnboardingFlow] Starting initial onboarding for thread ${thread_id}`
    );
    try {
      // StartOnboarding expects MessageRecord[] with a 'role' property, which isn't standard in MessageRecord.
      // We need to adapt or assume StartOnboarding can handle it.
      // The original code mapped to a slightly different format for StartOnboarding.
      // Let's replicate that formatting if StartOnboarding strictly needs it.
      // Assuming StartOnboarding might need a specific input format different from openai format.
      // The original code did:
      // const formattedThreadMessages = threadMessages.map((msg) => ({
      //   ...msg, // includes all original fields
      //   role: (msg.sender_number === process.env.A1BASE_AGENT_NUMBER ? "assistant" : "user") as "user" | "assistant" | "system",
      // }));
      // If StartOnboarding can take raw MessageRecord[], this mapping is not needed.
      // Given StartOnboarding is from `../workflows/onboarding-workflow`, it likely expects `MessageRecord[]` or a derivative.
      // The original code used `__skip_send` for StartOnboarding directly.

      const onboardingResponse: OnboardingResponse | undefined =
        await StartOnboarding(
          threadMessages, // Pass the original threadMessages
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          SERVICE_SKIP_SEND // Prevent StartOnboarding from sending directly
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
    await initializeDatabase();
  }
  const adapter = getInitializedAdapter();

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
  } = webhookData;
  const content = message_content.text || ""; // Backward compatibility

  console.log("[Message Received]", {
    sender_number,
    message_content,
    thread_type,
    timestamp,
    service,
  });

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

  // 3. Persist incoming user message (DB and/or memory)
  const { chatId, isNewChatInDb } = await persistIncomingMessage(
    webhookData,
    adapter
  );

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
  const shouldTriggerOnboarding = await checkIfOnboardingNeeded(
    thread_id,
    adapter
  );

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
  }

  if (!onboardingHandled) {
    console.log(
      `[FlowCtrl] Proceeding to standard message triage for thread ${thread_id}. OnboardingHandled: ${onboardingHandled}`
    );
    try {
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
        messagesByThread, // triageMessage uses this for in-memory context
        service: SERVICE_SKIP_SEND, // Prevent triageMessage from sending directly
      });

      if (triageResult.success && triageResult.message) {
        triageResponseMessageText = triageResult.message;
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
    await sendResponseMessage(
      triageResponseMessageText,
      thread_type as "individual" | "group",
      recipient,
      service,
      chatId,
      adapter
    );
  } else if (!onboardingHandled) {
    console.log(
      `[FlowCtrl] No response generated by triage and onboarding not handled for thread ${thread_id}.`
    );
  }

  return { success: true, message: "Incoming message processed." };
}
