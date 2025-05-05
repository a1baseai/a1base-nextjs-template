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

// Settings loading function
function loadMessageSettings() {
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
  service?: string
): Promise<string> {
  console.log("Workflow Start [DefaultReplyToMessage]", {
    sender_number,
    message_count: threadMessages.length,
    service,
  });

  try {
    // Check if the most recent message is the onboarding trigger
    const latestMessage = threadMessages[threadMessages.length - 1];
    if (latestMessage?.role === "user" && 
        latestMessage?.content?.trim().toLowerCase() === "start onboarding") {
      console.log("Detected onboarding trigger, starting onboarding workflow");
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

    // Use the 'simple_response' prompt
    const response = await generateAgentResponse(
      threadMessages,
      basicWorkflowsPrompt.simple_response.user
    );

    console.log("Generated response:", response);

    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
      return response;
    }
    
    // Skip sending if we're using the special skip marker
    if (service === "__skip_send") {
      console.log("Skipping message sending as requested by __skip_send marker");
      return response;
    }
    
    // Split response into paragraphs if setting is enabled
    const messages = splitParagraphs
      ? response.split("\n").filter((msg) => msg.trim())
      : [response];

    // Send each message line individually for WhatsApp
    // Send the message(s) through the appropriate channel
    for (const messageContent of messages) {
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

    return response;
  } catch (error) {
    console.error("[DefaultReplyToMessage] Error:", error);
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
        console.error("[DefaultReplyToMessage] Error sending error message:", sendError);
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
  console.log("Workflow Start [ConstructEmail]");

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
    console.error("[ConstructEmail] Error:", error);
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
  console.log("Workflow Start [SendEmailFromAgent]");

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
    console.error("[SendEmailFromAgent] Error:", error);
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
  console.log("Workflow Start [CreateEmailAddress]");

  try {
    const emailData = {
      address: emailAddress,
      domain_name: domain
    };

    await client.createEmailAddress(process.env.A1BASE_ACCOUNT_ID!, emailData);
    
    return `Email address ${emailAddress}@${domain} created successfully`;
  } catch (error) {
    console.error("[CreateEmailAddress] Error:", error);
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
