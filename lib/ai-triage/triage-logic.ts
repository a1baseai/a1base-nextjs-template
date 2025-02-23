import { ThreadMessage } from "@/types/chat";
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

type MessageRecord = {
  message_id: string;
  content: string;
  sender_number: string;
  sender_name: string;
  timestamp: string;
};

type TriageParams = {
  thread_id: string;
  message_id: string;
  content: string;
  sender_name: string;
  sender_number: string;
  thread_type: string;
  timestamp: string;
  messagesByThread: Map<string, MessageRecord[]>;
  service: string;
};

type TriageResult = {
  type: 'identity' | 'email' | 'default' | 'default-webchat';
  success: boolean;
  message?: string;
  data?: any;
};

// ======================== MAIN TRIAGE LOGIC ========================
// Processes incoming messages and routes them to appropriate workflows
// in basic-workflow.ts. Currently triages for:
// - Simple response to one off message
// - Sharing A1 Agent Identity card
// - Drafting and sending an email
// ===================================================================
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
    const messages: ThreadMessage[] = threadMessages.map(msg => ({
      content: msg.content,
      sender_number: msg.sender_number,
      sender_name: msg.sender_name,
      thread_id,
      thread_type,
      timestamp: msg.timestamp,
      message_id: msg.message_id
    }));

    
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
