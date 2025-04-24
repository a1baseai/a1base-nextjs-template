/**
 * Workflow functions for handling WhatsApp messages and coordinating responses
 * through the A1Base API.
 *
 * Key workflow functions:
 * - verifyAgentIdentity: Sends identity verification message
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

// ====== BASIC SEND AND VERIFICATION WORKFLOW =======
// Functions for sending messages and verifying agent identity
// - verifyAgentIdentity: Sends identity verification message
// - DefaultReplyToMessage: Generates and sends simple response
// ===================================================

export async function verifyAgentIdentity(
  message: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
): Promise<string[]> {
  console.log("Workflow Start [verifyAgentIdentity]");

  const agentIdCard =
    "https://www.a1base.com/identity-and-trust/8661d846-d43d-4ee7-a095-0dcc97764b97";

  try {
    // Load current settings
    const splitParagraphs = loadMessageSettings();
    
    // Generate response message for identity verification
    const response = await generateAgentIntroduction(message);
    const messages = splitParagraphs
      ? response.split("\n").filter((msg) => msg.trim())
      : [response];

    // Send each message line individually
    for (const msg of messages) {
      const messageData = {
        content: msg,
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

    // Send ID card link as final message
    const idCardMessage = {
      content: "Here's my A1Base identity card for verification:",
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: "whatsapp" as const,
    };

    if (thread_type === "group" && thread_id) {
      await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...idCardMessage,
        thread_id,
      });
      await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
        content: agentIdCard,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp",
        thread_id,
      });
    } else if (thread_type === "individual" && sender_number) {
      await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...idCardMessage,
        to: sender_number,
      });
      await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
        content: agentIdCard,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp",
        to: sender_number,
      });
    } else {
      throw new Error("Invalid message type or missing required parameters");
    }

    return [
      ...messages,
      "Here's my A1Base identity card for verification:",
      agentIdCard,
    ];
  } catch (error) {
    console.error("[verifyAgentIdentity] Error:", error);
    throw error;
  }
}

export async function DefaultReplyToMessage(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
) {
  console.log("Workflow Start [DefaultReplyToMessage]", {
    sender_number,
    message_count: threadMessages.length,
    service,
  });

  try {
    // Load current settings
    const splitParagraphs = loadMessageSettings();

    // Use the 'simple_response' prompt
    const response = await generateAgentResponse(
      threadMessages,
      basicWorkflowsPrompt.simple_response.user
    );

    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
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
      } else {
        console.log("No group_id or sender_number provided, skipping message send");
      }
      
      // Add a small delay between messages to maintain order
      if (splitParagraphs && messages.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    console.error("[Basic Workflow] Error:", error);

    // Skip error message sending for web chat
    if (service === "web-ui") {
      return "Sorry, I encountered an error processing your message";
    }

    // Prepare error message for WhatsApp
    const errorMessageData = {
      content: "Sorry, I encountered an error processing your message",
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: "whatsapp" as const,
    };

    // Send error message
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
