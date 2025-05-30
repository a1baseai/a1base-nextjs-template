/**
 * Workflow functions for handling WhatsApp messages and coordinating responses
 * through the A1Base API.
 *
 * Key workflow functions:
 * - DefaultReplyToMessage: Generates and sends simple response.
 * 
 * Uses OpenAI for generating contextual responses.
 * Handles both individual and group message threads.
 */

import { A1BaseAPI } from "a1base-node";
import {
  generateAgentResponse,
  generateAgentIntroduction, // Retained as it might be used elsewhere or by imported modules
} from "../services/openai";
import { ThreadMessage } from "@/types/chat";
import { basicWorkflowsPrompt } from "./basic_workflows_prompt";
import fs from "fs";
import path from "path";
import { SupabaseAdapter } from "../supabase/adapter";
import { getInitializedAdapter } from "../supabase/config";
import { sendMultimediaMessage, MediaType } from "../messaging/multimedia-handler";

// Import StartOnboarding from dedicated onboarding workflow file
// The re-export allows this module to act as a central point for these workflows.
import { StartOnboarding } from "./onboarding-workflow";
export { StartOnboarding };

// Re-export email workflows from the dedicated email workflow file
export { ConstructEmail, SendEmailFromAgent, CreateEmailAddress } from "./email_workflow";

// --- Constants ---
const SERVICE_WEB_UI = "web-ui";
const SERVICE_SKIP_SEND = "__skip_send";

// --- Configuration & Initialization ---

/**
 * Loads message processing settings from a JSON file.
 * @returns {boolean} True if paragraphs should be split, false otherwise or if an error occurs.
 */
function loadMessageSettings(): boolean {
  try {
    const settingsFilePath = path.join(process.cwd(), "data", "message-settings.json");
    if (fs.existsSync(settingsFilePath)) {
      const settingsData = fs.readFileSync(settingsFilePath, "utf-8");
      const settings = JSON.parse(settingsData);
      return settings.splitParagraphs || false;
    }
    console.warn("[loadMessageSettings] Settings file not found at:", settingsFilePath);
  } catch (error) {
    console.error("[loadMessageSettings] Error loading or parsing message settings:", error);
  }
  return false; // Default to false if settings can't be loaded or an error occurs
}

// Initialize A1Base client
// Ensure environment variables are set in your environment.
const a1BaseClient = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

const A1BASE_ACCOUNT_ID = process.env.A1BASE_ACCOUNT_ID!;
const A1BASE_AGENT_NUMBER = process.env.A1BASE_AGENT_NUMBER!;

// --- Helper Functions ---

/**
 * Sends a WhatsApp message via A1Base API.
 * @param threadType - Type of thread ("individual" or "group").
 * @param recipientId - Thread ID for group, sender number for individual.
 * @param content - Message content to send.
 * @param service - The messaging service (defaults to "whatsapp").
 */
async function _sendWhatsAppMessage(
  threadType: "individual" | "group",
  recipientId: string,
  content: string,
  service: "whatsapp" | string = "whatsapp" // Allow for other services if A1Base supports
): Promise<void> {
  if (!A1BASE_ACCOUNT_ID || !A1BASE_AGENT_NUMBER) {
    console.error("[_sendWhatsAppMessage] Missing A1Base Account ID or Agent Number in environment variables.");
    return;
  }

  const messageData = {
    content,
    from: A1BASE_AGENT_NUMBER,
    service: service as "whatsapp", // A1Base SDK might have specific literal types
  };

  try {
    if (threadType === "group") {
      await a1BaseClient.sendGroupMessage(A1BASE_ACCOUNT_ID, {
        ...messageData,
        thread_id: recipientId,
      });
    } else { // individual
      await a1BaseClient.sendIndividualMessage(A1BASE_ACCOUNT_ID, {
        ...messageData,
        to: recipientId,
      });
    }
    console.log(`[_sendWhatsAppMessage] Message sent to ${threadType} recipient: ${recipientId}`);
  } catch (error) {
    console.error(`[_sendWhatsAppMessage] Error sending message to ${threadType} recipient ${recipientId}:`, error);
    // Potentially re-throw or handle more gracefully depending on requirements
  }
}

/**
 * Sends a WhatsApp multimedia message via A1Base API.
 * @param threadType - Type of thread ("individual" or "group").
 * @param recipientId - Thread ID for group, sender number for individual.
 * @param mediaUrl - URL of the media to send.
 * @param mediaType - Type of media (image, video, audio, document).
 * @param caption - Optional caption for the media.
 */
async function _sendWhatsAppMediaMessage(
  threadType: "individual" | "group",
  recipientId: string,
  mediaUrl: string,
  mediaType: MediaType,
  caption?: string
): Promise<void> {
  if (!A1BASE_ACCOUNT_ID || !A1BASE_AGENT_NUMBER) {
    console.error("[_sendWhatsAppMediaMessage] Missing A1Base Account ID or Agent Number in environment variables.");
    return;
  }

  try {
    await sendMultimediaMessage(
      a1BaseClient,
      A1BASE_ACCOUNT_ID,
      threadType,
      recipientId,
      mediaUrl,
      mediaType,
      caption
    );
    console.log(`[_sendWhatsAppMediaMessage] Media message sent to ${threadType} recipient: ${recipientId}`);
  } catch (error) {
    console.error(`[_sendWhatsAppMediaMessage] Error sending media message to ${threadType} recipient ${recipientId}:`, error);
  }
}

/**
 * Stores an AI-generated message in Supabase.
 * @param supabaseAdapter - Initialized Supabase adapter.
 * @param threadId - The ID of the thread.
 * @param messageText - The text content of the AI message.
 * @param service - The service associated with the message.
 * @param partIndex - Index for multi-part messages.
 */
async function _storeAiMessageInSupabase(
  supabaseAdapter: SupabaseAdapter,
  threadId: string,
  messageText: string,
  service: string,
  partIndex: number
): Promise<void> {
  if (!A1BASE_AGENT_NUMBER) {
    console.error("[_storeAiMessageInSupabase] Agent number not configured. Skipping message store.");
    return;
  }

  const messageContentForDb = { text: messageText };
  const aiMessageId = `ai-reply-${threadId}-${Date.now()}-${partIndex}`;

  console.log(`[_storeAiMessageInSupabase] Attempting to store AI message part ${partIndex + 1}. Thread ID: ${threadId}, AI Message ID: ${aiMessageId}`);
  try {
    await supabaseAdapter.storeMessage(
      threadId,
      A1BASE_AGENT_NUMBER,
      aiMessageId,
      messageContentForDb,
      'text', // message_type
      service, // original_service
      messageContentForDb // original_message_payload
    );
    console.log(`[_storeAiMessageInSupabase] Successfully stored AI message part ${partIndex + 1}. AI Message ID: ${aiMessageId}`);
  } catch (storeError) {
    console.error(`[_storeAiMessageInSupabase] Error storing AI message part ${partIndex + 1}. AI Message ID: ${aiMessageId}:`, storeError);
  }
}

/**
 * Handles the "start onboarding" scenario.
 * @returns An object containing the response message text and a flag indicating if processing should stop.
 */
async function _handleOnboardingScenario(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id: string | undefined,
  sender_number: string | undefined,
  service: string | undefined
): Promise<{ responseText: string; stopProcessing: boolean }> {
  console.log("[_handleOnboardingScenario] Onboarding trigger detected.");
  const onboardingResult = await StartOnboarding(threadMessages, thread_type, thread_id, sender_number, service);

  const firstOnboardingMessage = onboardingResult.messages && onboardingResult.messages.length > 0
    ? onboardingResult.messages[0].text
    : "Onboarding process initiated.";

  if (service !== SERVICE_WEB_UI && service !== SERVICE_SKIP_SEND) {
    if (onboardingResult.messages && onboardingResult.messages.length > 0) {
      const recipientId = thread_type === "group" ? thread_id : sender_number;
      if (recipientId) {
        await _sendWhatsAppMessage(thread_type, recipientId, firstOnboardingMessage);
      } else {
        console.warn("[_handleOnboardingScenario] Missing recipientId for sending onboarding message.");
      }
    }
  }
  return { responseText: firstOnboardingMessage, stopProcessing: true };
}


// ====== CORE WORKFLOW FUNCTIONS =======

/**
 * Generates a default reply to a message thread and sends it.
 * Handles onboarding triggers and standard message replies.
 *
 * @param threadMessages - Array of messages in the thread.
 * @param thread_type - Type of the thread ("individual" or "group").
 * @param thread_id - ID of the thread (for group messages).
 * @param sender_number - Sender's number (for individual messages).
 * @param service - The service originating the request (e.g., "whatsapp", "web-ui").
 * @param participants - Array of participants in the thread.
 * @param projects - Array of projects related to the thread.
 * @returns A promise that resolves to the agent's response message string.
 */
export async function DefaultReplyToMessage(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string,
  participants: any[] = [], // Consider defining a more specific type if possible
  projects: any[] = [] // Consider defining a more specific type if possible
): Promise<string> {
  console.log(
    `[DefaultReplyToMessage] Processing message. Thread Type: ${thread_type}, Service: ${service}, ` +
    `Thread ID: ${thread_id}, Sender: ${sender_number}, Messages: ${threadMessages.length}`
  );

  const supabaseAdapter = await getInitializedAdapter();

  try {
    // 1. Check for Onboarding Trigger
    const latestMessage = threadMessages[threadMessages.length - 1];
    if (latestMessage?.role === "user" && latestMessage?.content?.trim().toLowerCase() === "start onboarding") {
      const onboardingResponse = await _handleOnboardingScenario(
        threadMessages, thread_type, thread_id, sender_number, service
      );
      return onboardingResponse.responseText;
    }

    // 2. Generate AI Response
    const splitParagraphs = loadMessageSettings();
    const aiResponse = await generateAgentResponse(
      threadMessages,
      basicWorkflowsPrompt.simple_response.user,
      thread_type,
      participants,
      projects,
      service // Pass the service parameter here
    );
    console.log("[DefaultReplyToMessage] AI response generated.");

    // 3. Handle Web-UI or Skip-Send Services (Return AI response directly)
    if (service === SERVICE_WEB_UI || service === SERVICE_SKIP_SEND) {
      console.log(`[DefaultReplyToMessage] Service is '${service}'. Returning AI response without sending/storing.`);
      return aiResponse;
    }

    // 4. Process and Send Message(s)
    const messageParts = splitParagraphs ? aiResponse.split("\n\n") : [aiResponse];
    const recipientId = thread_type === "group" ? thread_id : sender_number;

    if (!recipientId) {
      console.error("[DefaultReplyToMessage] No recipientId (thread_id or sender_number) provided for sending messages.");
      // Depending on desired behavior, you might return an error message or throw
      return "Error: Could not determine recipient for the message.";
    }

    for (const [index, messagePartUntrimmed] of messageParts.entries()) {
      const messagePart = messagePartUntrimmed.trim();
      if (messagePart === "") continue;

      // Store AI message before sending (if conditions are met)
      const shouldStoreMessage = supabaseAdapter && thread_id && A1BASE_AGENT_NUMBER;
      if (shouldStoreMessage) {
        console.log(`[DefaultReplyToMessage] Conditions to store AI message part ${index + 1}/${messageParts.length} met.`);
        await _storeAiMessageInSupabase(supabaseAdapter, thread_id!, messagePart, service || "whatsapp", index);
      } else {
        console.log(`[DefaultReplyToMessage] SKIPPED storing AI message part ${index + 1}/${messageParts.length}. StoreCondition not met (Adapter: ${!!supabaseAdapter}, ThreadID: ${!!thread_id}, AgentNumber: ${!!A1BASE_AGENT_NUMBER})`);
      }

      // Send the message part
      await _sendWhatsAppMessage(thread_type, recipientId, messagePart);
    }

    return aiResponse; // Return the full, original AI response

  } catch (error: any) {
    console.error("[DefaultReplyToMessage] Critical error processing message:", error);
    const errorMessage = "I'm sorry, but I encountered an error while processing your message.";

    // Attempt to send an error message back to the user, unless it's web-ui or skip-send
    if (service !== SERVICE_WEB_UI && service !== SERVICE_SKIP_SEND) {
      const recipientId = thread_type === "group" ? thread_id : sender_number;
      if (recipientId && A1BASE_ACCOUNT_ID && A1BASE_AGENT_NUMBER) {
        console.log("[DefaultReplyToMessage] Attempting to send error notification to user.");
        await _sendWhatsAppMessage(thread_type, recipientId, errorMessage);
      } else {
        console.warn("[DefaultReplyToMessage] Could not send error message to user due to missing recipient or config.");
      }
    }
    return errorMessage;
  }
}

// ====== CUSTOM WORKFLOW INTEGRATION GUIDE =======
// To add new workflows that connect to your app's API/backend:

// 1. Define new workflow functions following this pattern:
//    - Accept relevant parameters (thread info, message content, etc)
//    - Make API calls to your backend services
//    - Format and send responses via A1Base client (e.g., using _sendWhatsAppMessage)
//    Example:
/*
export async function CustomApiWorkflow(
  message: string,
  thread_type: "individual" | "group",
  recipientId: string, // thread_id or sender_number
): Promise<string> {
  try {
    // 1. Call your API endpoint
    // const apiResponse = await yourApiClient.makeRequest({ data: message });
    
    // 2. Process the response
    // const formattedMessage = formatApiResponse(apiResponse);
    const formattedMessage = "This is a response from custom API workflow"; // Placeholder
    
    // 3. Send via A1Base using existing message patterns
    await _sendWhatsAppMessage(thread_type, recipientId, formattedMessage);
    
    return formattedMessage; // Or some other meaningful result
  } catch (error) {
    console.error("[CustomApiWorkflow] Error:", error);
    // Handle error, maybe send an error message to user
    const errorMessage = "Failed to process custom API request.";
    await _sendWhatsAppMessage(thread_type, recipientId, errorMessage);
    throw error; // Or return error message
  }
}
*/

// 2. Add new intent types to triageMessageIntent() in openai.ts (if using intent-based routing).
// 3. Update any relevant triage logic or switch statements to call your new workflow function.
// 4. Add any new prompt templates to basic_workflows_prompt.js if your workflow uses AI generation.
// 5. Implement robust error handling, logging, and potentially retry logic for your API calls.
// 6. Document the new workflow, its parameters, and its behavior.

// =============================================