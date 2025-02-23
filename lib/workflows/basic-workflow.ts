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
import type { ThreadMessage } from "../../types/chat";
import { basicWorkflowsPrompt } from "./basic-workflows-prompt";

/** Message splitting configuration */
const SPLIT_PARAGRAPHS = false;

/** A1Base API client instance */
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  }
});

/**
 * Basic Send and Verification Workflow
 * 
 * Functions for sending messages and verifying agent identity:
 * - verifyAgentIdentity: Sends identity verification message
 * - DefaultReplyToMessage: Generates and sends simple response
 */

/**
 * Sends identity verification messages and the agent's identity card.
 * 
 * This function handles identity verification requests by:
 * 1. Generating a personalized introduction using the agent's profile
 * 2. Sending the introduction message(s)
 * 3. Sending the agent's A1Base identity card link
 * 
 * The function supports both individual and group chats, using the appropriate
 * A1Base API endpoints based on the thread type.
 * 
 * @param message - The user's message requesting identity verification
 * @param thread_type - Whether this is an individual or group chat
 * @param thread_id - For group messages, the ID of the group thread
 * @param sender_number - For individual messages, the recipient's phone number
 * @returns Array of sent messages including introduction and identity card link
 * @throws Error if message type is invalid or required parameters are missing
 */
export async function verifyAgentIdentity(
  message: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string
): Promise<string[]> {
  console.log("Workflow Start [verifyAgentIdentity]");

  const agentIdCard = 'https://www.a1base.com/identity-and-trust/8661d846-d43d-4ee7-a095-0dcc97764b97'

  try {
    // Generate response message for identity verification
    const response = await generateAgentIntroduction(message);
    const messages = SPLIT_PARAGRAPHS ? response.split('\n').filter(msg => msg.trim()) : [response];
    
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

    return [...messages, "Here's my A1Base identity card for verification:", agentIdCard];
  } catch (error) {
    console.error("[verifyAgentIdentity] Error:", error);
    throw error;
  }
}

/**
 * Generates and sends a simple response to a message thread.
 * 
 * This function handles standard message responses by:
 * 1. Using OpenAI to generate a contextually appropriate response
 * 2. Optionally splitting the response into paragraphs if configured
 * 3. Sending each message part through the appropriate A1Base channel
 * 
 * The function includes error handling that sends user-friendly error messages
 * back through the same channel if something goes wrong.
 * 
 * @param threadMessages - Array of messages providing conversation context
 * @param thread_type - Whether this is an individual or group chat
 * @param thread_id - For group messages, the ID of the group thread
 * @param sender_number - For individual messages, the recipient's phone number
 * @throws Error if message type is invalid or required parameters are missing
 */
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
    const messages = SPLIT_PARAGRAPHS ? response.split('\n').filter(msg => msg.trim()) : [response];

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
      } else {
        throw new Error("Invalid message type or missing required parameters");
      }
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

/**
 * Email Workflows
 * 
 * Functions for handling email-related tasks like constructing and sending emails
 * through the A1 agent's email address. These workflows are triggered when the
 * message triage detects an email-related request from the user.
 */


/**
 * Generates an email draft from conversation context.
 * 
 * This function analyzes the conversation to create an appropriate email by:
 * 1. Using OpenAI to understand the email requirements
 * 2. Generating subject and body content
 * 3. Attempting to identify the recipient from context
 * 
 * The email is not sent immediately - this function only creates the draft
 * which can then be reviewed before sending.
 * 
 * @param threadMessages - Array of messages providing email context
 * @returns Email draft containing recipient, subject, and body
 * @throws Error if email content generation fails
 */
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
/**
 * Sends an email through the A1Base API and confirms delivery.
 * 
 * This function handles the actual email sending process by:
 * 1. Using A1Base's email API to send the message
 * 2. Sending confirmation messages back to the user
 * 3. Handling any errors that occur during sending
 * 
 * The function sends a series of confirmation messages back through
 * the original channel (WhatsApp) to keep the user informed about
 * the email's status.
 * 
 * @param emailData - Object containing email recipient and content
 * @param thread_type - Whether this is an individual or group chat
 * @param thread_id - For group messages, the ID of the group thread
 * @param sender_number - For individual messages, the recipient's phone number
 * @returns Response from the A1Base email API
 * @throws Error if email sending fails or message type is invalid
 */
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

    // Send confirmation messages
    const confirmationMessages = [
      "Email sent successfully!",
      `Subject: ${emailData.emailContent.subject}`,
      `To: ${emailData.recipientEmail}`
    ];

    for (const msg of confirmationMessages) {
      const messageData = {
        content: msg,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp" as const
      };

      if (thread_type === "group" && thread_id) {
        await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          thread_id
        });
      } else if (thread_type === "individual" && sender_number) {
        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          to: sender_number
        });
      }
    }

    return response;
  } catch (error) {
    console.error('[SendEmailFromAgent] Error:', error);
    throw error;
  }
}


/**
 * Task Approval Workflows
 * 
 * Workflows requiring explicit user approval before executing tasks.
 * Shows task details, waits for approval, executes if approved,
 * then confirms completion or cancellation.
 */


/**
 * Requests user confirmation before proceeding with a task.
 * 
 * This function implements a confirmation workflow that:
 * 1. Shows the user what action will be taken
 * 2. Waits for explicit approval
 * 3. Returns the confirmed task details
 * 
 * Currently focused on email confirmation, but designed to be
 * extensible for other types of task confirmation workflows.
 * 
 * @param threadMessages - Array of messages providing conversation context
 * @param emailDraft - Draft email content to be confirmed
 * @returns Confirmed email data, potentially modified based on user feedback
 * @throws Error if confirmation process fails
 */
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


/**
 * Sends a completion confirmation message after a task is finished.
 * 
 * This function maintains the feedback loop with users by:
 * 1. Generating an appropriate completion message
 * 2. Sending it through the original communication channel
 * 3. Handling any errors in the confirmation process
 * 
 * The confirmation message is generated using the agent's profile to
 * maintain consistent tone and style in communications.
 * 
 * @param threadMessages - Array of messages providing conversation context
 * @param thread_type - Whether this is an individual or group chat
 * @param thread_id - For group messages, the ID of the group thread
 * @param sender_number - For individual messages, the recipient's phone number
 * @throws Error if message type is invalid or required parameters are missing
 */
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

    const messages = SPLIT_PARAGRAPHS ? confirmationMessage.split('\n').filter(msg => msg.trim()) : [confirmationMessage];

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
      } else {
        throw new Error("Invalid message type or missing required parameters");
      }
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
