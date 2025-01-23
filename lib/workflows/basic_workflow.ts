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
  triageMessageIntent,
  generateAgentResponse, 
  generateEmailFromThread,
  generateAgentIntroduction,
} from "../services/openai";
import { ThreadMessage } from "@/types/chat";
import { basicWorkflowsPrompt } from "./basic_workflows_prompt";

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  }
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
) {
  console.log("Workflow Start [verifyAgentIdentity]");

  const agentIdCard = 'https://www.a1base.com/identity-and-trust/8661d846-d43d-4ee7-a095-0dcc97764b97'

  try {
    
    // Generate response message for identity verification
    const response = await generateAgentIntroduction(message);

    // Prepare message data with response and ID card link
    const messageData = {
      content: `${response}\n\nHere's my A1Base identity card for verification:`,
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: "whatsapp" as const,
    };

    // Send initial message using A1Base client
    if (thread_type === "group" && thread_id) {
      await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...messageData,
        thread_id,
      });
      // Send identity card link
      await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
        content: agentIdCard,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp",
        thread_id,
      });
    } else if (thread_type === "individual" && sender_number) {
      await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...messageData,
        to: sender_number,
      });
      // Send identity card link
      await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
        content: agentIdCard,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp",
        to: sender_number,
      });
    } else {
      throw new Error("Invalid message type or missing required parameters");
    }
  } catch (error) {
    console.error("[verifyAgentIdentity] Error:", error);
    throw error;
  }
}


export async function DefaultReplyToMessage(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
) {
  console.log("Workflow Start [DefaultReplyToMessage]", {
    sender_number,
    message_count: threadMessages.length
  });

  try {
    // Use the 'simple_response' prompt
    const response = await generateAgentResponse(threadMessages, basicWorkflowsPrompt.simple_response.user);

    // Prepare message data
    const messageData = {
      content: response,
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: "whatsapp" as const,
    };

    // Send message using A1Base client
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
  } catch (error) {
    console.error("[Basic Workflow] Error:", error);

    // Prepare error message
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

// ============================== EMAIL WORKFLOWS ========================
// Functions for handling email-related tasks like constructing and sending emails
// through the A1 agent's email address. These workflows are triggered when the
// message triage detects an email-related request from the user.
// =======================================================================

// Generates the contents of the email, but doesn't send it until user approval
export async function ConstructEmail(threadMessages: ThreadMessage[]): Promise<{
  recipientEmail: string;
  hasRecipient: boolean;
  emailContent: {
    subject: string;
    body: string;
  };
}> {
    console.log("Workflow Start [ConstructEmail]", {
      message_count: threadMessages.length
    });
    // Generate email contents
    const emailData = await generateEmailFromThread(
      threadMessages,
      basicWorkflowsPrompt.email_generation.user
    );
        
    console.log('=== Email Data ====')
    console.log(emailData)
    if (!emailData.emailContent) {
        throw new Error("Email content could not be generated.");
    }
    return {
        recipientEmail: emailData.recipientEmail,
        hasRecipient: emailData.hasRecipient,
        emailContent: {
          subject: emailData.emailContent.subject,
          body: emailData.emailContent.body
        }
        
    };
}

// Uses the A1Base sendEmailMessage function to send an email as the a1 agent email address set in .env.local
export async function SendEmailFromAgent(
  emailData: {
    recipientEmail: string;
    emailContent: {
      subject: string;
      body: string;
    };
  },
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
) {
  console.log("Workflow Start: [SendEmailFromAgent]", {
    recipient: emailData.recipientEmail,
    subject: emailData.emailContent.subject    
  });
  try {
    const response = await client.sendEmailMessage(process.env.A1BASE_ACCOUNT_ID!, {
      sender_address: process.env.A1BASE_AGENT_EMAIL!,
      recipient_address: emailData.recipientEmail,
      subject: emailData.emailContent.subject,
      body: emailData.emailContent.body,
      headers: {
        // Optional headers
        // TODO: Add example with custom headers
      }
    });

    // Send confirmation message to user
    const confirmationMessage = {
      content: `Email sent successfully!\nSubject: ${emailData.emailContent.subject}\nTo: ${emailData.recipientEmail}`,
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: "whatsapp" as const
    };

    if (thread_type === "group" && thread_id) {
      await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...confirmationMessage,
        thread_id
      });
    } else if (thread_type === "individual" && sender_number) {
      await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...confirmationMessage,
        to: sender_number
      });
    }

    return response;
  } catch (error) {
    console.error('[SendEmailFromAgent] Error:', error);
    throw error;
  }
}


// ===================== TASK APPROVAL WORKFLOWS =======================
// Workflows requiring explicit user approval before executing tasks.
// Shows task details, waits for approval, executes if approved,
// then confirms completion or cancellation.
// =====================================================================

// Generate and send message to user to confirm before proceeding with task
export async function taskActionConfirmation(threadMessages: ThreadMessage[], emailDraft: {
    recipientEmail: string;
    emailContent: {
      subject: string;
      body: string;
    };
}): Promise<{
    recipientEmail: string;
    emailContent: {
      subject: string;
      body: string;
    };
}> {
    console.log("starting [taskActionConfirmation] workflow", {
      message_count: threadMessages.length,
      recipient: emailDraft.recipientEmail,
      subject: emailDraft.emailContent.subject
    });
    // For now, just return the draft email as-is
    // TODO: Implement actual user approval flow
    return emailDraft;
}

// Sends confirmation message to user after task completion to maintain feedback loop
export async function ConfirmTaskCompletion(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
) {
  console.log("starting [ConfirmTaskCompletion] workflow", {
    thread_type,
    thread_id,
    sender_number,
    message_count: threadMessages.length
  });

  try {
    
    const confirmationMessage = await generateAgentResponse(
        threadMessages,
        basicWorkflowsPrompt.task_confirmation.user
    );

    // Prepare message data
    const messageData = {
      content: confirmationMessage,
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: "whatsapp" as const,
    };

    // Send message using A1Base client
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
  } catch (error) {
    console.error("[ConfirmTaskCompletion] Error:", error);

    // Prepare error message
    const errorMessageData = {
      content: "Sorry, I encountered an error confirming task completion",
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

