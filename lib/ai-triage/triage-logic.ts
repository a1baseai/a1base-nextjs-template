import type { ThreadMessage } from "../../types/chat";
import { getInitializedAdapter } from "../supabase/config";
import { 
  DefaultReplyToMessage,
  SendEmailFromAgent, 
  ConfirmTaskCompletion,
  ConstructEmail,
  taskActionConfirmation,
  verifyAgentIdentity
} from "../workflows/basic-workflow";
import { 
  generateAgentResponse,
  triageMessageIntent 
} from "../services/openai";
import {
  convertToThreadMessages,
  sendWhatsAppMessage,
  handleMessageError
} from "./message-utils";

import type { MessageRecord, TriageParams, TriageResult } from "../services/types";

/**
 * Main message triage logic that processes incoming messages and routes them to appropriate workflows.
 * 
 * This function serves as the central routing mechanism for all incoming messages, determining
 * how they should be processed based on their content and context. It handles:
 * 
 * - Simple responses to one-off messages
 * - Sharing the A1 Agent Identity card when requested
 * - Drafting and sending emails based on user requests
 * 
 * The function first retrieves message history from either Supabase or in-memory storage,
 * then uses AI to determine the appropriate workflow for handling the message.
 * 
 * @param params - Parameters containing message details and thread context
 * @returns A TriageResult object indicating the outcome of the triage operation
 * @throws Will throw an error if message processing fails
 */
export async function triageMessage({
  thread_id,
  content,
  sender_name,
  sender_number,
  thread_type,
  messagesByThread,
  service,
}: TriageParams): Promise<TriageResult> {
  console.log("[triageMessage] Starting message triage");

  try {
    let threadMessages: MessageRecord[] = [];
    
    // Skip Supabase for web-ui service
    if (service === 'web-ui') {
      threadMessages = messagesByThread.get(thread_id) || [];
    } else {
      // Try to get messages from Supabase first
      const adapter = await getInitializedAdapter();
      
      if (adapter) {
        console.log("[triageMessage] Using Supabase for message history");
        const thread = await adapter.getThread(thread_id);
        if (thread?.messages) {
          // Get last 10 messages from the thread
          threadMessages = thread.messages.slice(-10);
          console.log(threadMessages)
        }
      } else {
        console.log("[triageMessage] Using in-memory storage for message history");
        threadMessages = messagesByThread.get(thread_id) || [];
      }
    }
    
    // Convert to ThreadMessage format
    const messages: ThreadMessage[] = convertToThreadMessages(threadMessages, thread_id, thread_type);

    
    const triage = await triageMessageIntent(messages);
    // Based on the triage result, choose the appropriate workflow
    
    switch (triage.responseType) {
      case 'sendIdentityCard':
        console.log('Running Identity Verification Workflow')
      
        const identityMessages = await verifyAgentIdentity(
          threadMessages[threadMessages.length - 1].content,
          thread_type as "individual" | "group",
          thread_id,
          sender_number
        );

        return {
          type: 'identity',
          success: true,
          message: identityMessages.join('\n'),
          data: identityMessages
        };

      case 'handleEmailAction':
        console.log('Running Email Workflow')
        // Triage to send an email using the agent's email address
        
        const emailDraft = await ConstructEmail(threadMessages)
              
        // Get user confirmation and send email
        // const confirmedEmail = await taskActionConfirmation(threadMessages, emailDraft);
       
        await SendEmailFromAgent(
          emailDraft, 
          thread_type as "individual" | "group", 
          thread_id, 
          sender_number
        );

        // Send confirmation message back to user
        await ConfirmTaskCompletion(
          messages,
          thread_type as "individual" | "group", 
          thread_id,
          sender_number
        );

        return {
          type: 'email',
          success: true,
          message: 'Email sent successfully',
          data: emailDraft
        };

      case 'simpleResponse':
      default:
        console.log('Running Default Response')
        // Use the default workflow
        const response = await DefaultReplyToMessage(
          messages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number
        );

        // Return different response type for web UI
        if (service === 'web-ui') {
          return {
            type: 'default-webchat',
            success: true,
            message: 'Default response sent',
            data: response
          };
        }

        return {
          type: 'default', 
          success: true,
          message: 'Default response sent',
          data: response
        };
    }
  } catch (error) {
    console.error("[Triage] Error:", error);
    return {
      type: 'default',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
