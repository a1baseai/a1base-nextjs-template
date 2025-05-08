/**
 * Workflow functions for handling WhatsApp messages and coordinating responses
 * through the A1Base API.
 *
 * Key workflow functions:
 * - DefaultReplyToMessage: Generates and sends simple response
 * - ConstructEmail: Creates email draft from thread messages
 * - SendEmailFromAgent: Sends composed email via agent
 * - ConfirmTaskCompletion: Confirms task completion with user
 *
 * Uses OpenAI for generating contextual responses.
 * Handles both individual and group message threads.
 */

import { A1BaseAPI } from "a1base-node";
import {
  generateAgentResponse,
  generateAgentIntroduction,
} from "../services/openai";
import { ThreadMessage } from "@/types/chat";
import { basicWorkflowsPrompt } from "./basic_workflows_prompt";
import fs from "fs";
import path from "path";
import { SupabaseAdapter } from "../supabase/adapter";
import { getInitializedAdapter } from "../supabase/config";

// Settings loading function
function loadMessageSettings() {
  try {
    const settingsFilePath = path.join(process.cwd(), "data", "message-settings.json");
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
      return settings.splitParagraphs || false;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return false; // Default to false if settings can't be loaded
}

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// ====== BASIC SEND WORKFLOW =======
// Functions for sending messages
// - DefaultReplyToMessage: Generates and sends simple response
// ===================================================


export async function DefaultReplyToMessage(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string,
  participants: any[] = [],
  projects: any[] = []
): Promise<string> {
  console.log(
    "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n" +
    "[DefaultReplyToMessage] FUNCTION CALLED!\n" +
    `  thread_id: ${thread_id}, sender_number: ${sender_number}, service: ${service}, thread_type: ${thread_type}\n` +
    `  Number of messages: ${threadMessages.length}\n` +
    `  Number of participants: ${participants.length}\n` +
    `  Number of projects: ${projects.length}\n` +
    "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n"
  );
  // Console log removed
  let agentMessage = ""; // Initialize agentMessage
  const supabaseAdapter = await getInitializedAdapter();

  try {
    // Check if the most recent message is the onboarding trigger
    const latestMessage = threadMessages[threadMessages.length - 1];
    if (latestMessage?.role === "user" && 
        latestMessage?.content?.trim().toLowerCase() === "start onboarding") {
      // Console log removed
      const onboardingResult = await StartOnboarding(threadMessages, thread_type, thread_id, sender_number, service);
      
      // For web-ui, we need to extract just the message text to maintain
      // backward compatibility with the existing API. The API route will handle the full message array.
      if (service === "web-ui") {
        // Return just the message text, not the entire JSON structure
        return onboardingResult.messages && onboardingResult.messages.length > 0 
          ? onboardingResult.messages[0].text 
          : "Onboarding started.";
      }
      
      // For other services, we'll only send messages if service is NOT the special skip marker
      if (service !== "__skip_send") {
        // Send the first onboarding message
        if (onboardingResult.messages && onboardingResult.messages.length > 0) {
          const messageContent = onboardingResult.messages[0].text;
          const messageData = {
            content: messageContent,
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
          }
        }
      }
      
      // Return the first message or a placeholder
      return onboardingResult.messages && onboardingResult.messages.length > 0 
        ? onboardingResult.messages[0].text 
        : "Onboarding started.";
    }
    
    // Load current settings
    const splitParagraphs = loadMessageSettings();

    // Use the 'simple_response' prompt with enhanced context
    const response = await generateAgentResponse(
      threadMessages,
      basicWorkflowsPrompt.simple_response.user,
      thread_type,
      participants,
      projects
    );

    // Console log removed

    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
      return response;
    }
    
    // Skip sending if we're using the special skip marker
    if (service === "__skip_send") {
      // Console log removed
      return response;
    }
    
    // Split response into paragraphs if setting is enabled
    const finalMessages = splitParagraphs
      ? response.split("\n\n")
      : [response];

    const agentMessageArray = finalMessages;

    for (const [index, finalMessageUntrimmed] of agentMessageArray.entries()) {
      const finalMessage = finalMessageUntrimmed.trim(); // Trim each part
      if (finalMessage === "") continue;

      // Determine if the message part should be stored
      const storeCondition = 
        supabaseAdapter && // Check if adapter was successfully retrieved (implies initialized)
        thread_id && 
        process.env.A1BASE_AGENT_NUMBER && 
        service !== "__skip_send";

      console.log(`[DefaultReplyToMessage] Checking conditions to store AI message part ${index + 1}/${agentMessageArray.length}:`);
      console.log(`  - Supabase Adapter Retrieved: ${!!supabaseAdapter}`);
      console.log(`  - Thread ID: ${!!thread_id}, Agent Number: ${!!process.env.A1BASE_AGENT_NUMBER}`);
      console.log(`  - Service ('${service}') !== '__skip_send': ${service !== '__skip_send'}`);
      console.log(`  - Overall store condition met: ${storeCondition}`);

      // Store AI message before sending to user
      if (storeCondition) {
        const messageContentForDb = { text: finalMessage }; 
        const aiMessageId = `ai-reply-${thread_id}-${Date.now()}-${index}`;

        console.log(`[DefaultReplyToMessage] Attempting to store AI message part ${index + 1}/${agentMessageArray.length}. Thread ID: ${thread_id}, Service: ${service}, Type: ${thread_type}, AI Message ID: ${aiMessageId}, Store Condition: ${storeCondition}`);
        try {
          await supabaseAdapter!.storeMessage(
            thread_id!, 
            process.env.A1BASE_AGENT_NUMBER!, 
            aiMessageId, 
            messageContentForDb, 
            'text', 
            service || 'whatsapp', 
            messageContentForDb 
          );
          console.log(`[DefaultReplyToMessage] Successfully stored AI message part ${index + 1}/${agentMessageArray.length}. AI Message ID: ${aiMessageId}`);
        } catch (storeError) {
          console.error(`[DefaultReplyToMessage] Error storing AI message part ${index + 1}/${agentMessageArray.length}. AI Message ID: ${aiMessageId}, Error:`, storeError);
        }
      } else {
        if (supabaseAdapter && thread_id && process.env.A1BASE_AGENT_NUMBER) { 
            console.log(`[DefaultReplyToMessage] SKIPPED storing AI message part ${index + 1}/${agentMessageArray.length} for thread ID: ${thread_id}. Service: ${service}, Type: ${thread_type}. Store Condition was false (supabaseAdapter retrieved: ${!!supabaseAdapter}, thread_id: ${!!thread_id}, A1BASE_AGENT_NUMBER: ${!!process.env.A1BASE_AGENT_NUMBER}, service ('${service}') !== '__skip_send': ${service !== '__skip_send'})`);
        }
      }

      // Send the message part if service is not __skip_send
      if (service !== "__skip_send") {
        const messageContent = finalMessage;
        const messageData = {
          content: messageContent,
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
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Error loading settings:', error);
    const errorMessage = "I'm sorry, but I encountered an error while processing your message.";

    // Don't send error message if this is a web UI request or using the skip marker
    if (service !== "web-ui" && service !== "__skip_send") {
      const messageData = {
        content: errorMessage,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp" as const,
      };

      try {
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
        }
      } catch (sendError) {
        console.error('Error loading settings:', error);
      }
    }

    return errorMessage;
  }
}

// ===================================================

/**
 * Constructs an email draft from the conversation thread
 * @param threadMessages - Array of messages in the thread
 * @returns Constructed email with subject and body
 */
export async function ConstructEmail(
  threadMessages: ThreadMessage[]
): Promise<{ subject: string; body: string }> {
  // Console log removed

  try {
    const response = await generateAgentResponse(
      threadMessages,
      basicWorkflowsPrompt.email_draft.user
    );

    const emailParts = response.split("---");
    const subject = emailParts[0]?.trim() || "Email from A1Base Agent";
    const body = emailParts[1]?.trim() || response;

    return { subject, body };
  } catch (error) {
    console.error('Error loading settings:', error);
    throw error;
  }
}

/**
 * Sends an email from the agent
 * @param emailDetails - Email subject, body, and recipient info
 * @returns Confirmation of email sent
 */
export async function SendEmailFromAgent(
  emailDetails: {
    subject: string;
    body: string;
    recipient_address: string;
  }
): Promise<string> {
  // Console log removed

  try {
    const emailData = {
      sender_address: process.env.A1BASE_AGENT_EMAIL!,
      recipient_address: emailDetails.recipient_address,
      subject: emailDetails.subject,
      body: emailDetails.body
    };

    await client.sendEmailMessage(process.env.A1BASE_ACCOUNT_ID!, emailData);
    
    return "Email sent successfully";
  } catch (error) {
    console.error('Error loading settings:', error);
    throw error;
  }
}

/**
 * Creates a new email address for the agent
 * @param emailAddress - The email address to create (without domain)
 * @param domain - The domain for the email address (default: a1send.com)
 * @returns Confirmation of email creation
 */
export async function CreateEmailAddress(
  emailAddress: string,
  domain: string = "a1send.com"
): Promise<string> {
  // Console log removed

  try {
    const emailData = {
      address: emailAddress,
      domain_name: domain
    };

    await client.createEmailAddress(process.env.A1BASE_ACCOUNT_ID!, emailData);
    
    return `Email address ${emailAddress}@${domain} created successfully`;
  } catch (error) {
    console.error('Error loading settings:', error);
    throw error;
  }
}

// ====== CUSTOM WORKFLOW INTEGRATION GUIDE =======
// To add new workflows that connect to your app's API/backend:

// 1. Define new workflow functions following this pattern:
//    - Accept relevant parameters (thread info, message content, etc)
//    - Make API calls to your backend services
//    - Format and send responses via A1Base client
//    Example:
/*
export async function CustomApiWorkflow(
  message: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
): Promise<string[]> {
  // 1. Call your API endpoint
  const apiResponse = await yourApiClient.makeRequest();
  
  // 2. Process the response
  const formattedMessage = formatApiResponse(apiResponse);
  
  // 3. Send via A1Base using existing message patterns
  const messageData = {
    content: formattedMessage,
    from: process.env.A1BASE_AGENT_NUMBER!,
    service: "whatsapp" as const
  };
  
  // 4. Use thread_type to determine send method
  if (thread_type === "group") {
    await client.sendGroupMessage(...);
  } else {
    await client.sendIndividualMessage(...);
  }
}
*/

// 2. Add new intent types to triageMessageIntent() in openai.ts
// 3. Update the triage logic switch statement to handle new workflow
// 4. Add any new prompt templates to basic_workflows_prompt.js
// 5. Consider adding error handling and retry logic for API calls
// 6. Document the new workflow in the header comments

// =============================================

// Import StartOnboarding from dedicated onboarding workflow file
import { StartOnboarding } from "./onboarding-workflow";

// Export StartOnboarding to maintain backward compatibility
export { StartOnboarding } from "./onboarding-workflow";

// =============================================
