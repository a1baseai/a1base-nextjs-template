import { generateAgentResponse } from "../services/openai";
import { ThreadMessage } from "@/types/chat";
import { DefaultReplyToMessage, SendEmailFromAgent } from "../workflows/basic_workflow";
import { triageMessageIntent } from "../services/openai";
import { MessageRecord, TriageParams } from "@/types/triage";

export async function triageMessage({
  thread_id,
  content,
  sender_name,
  sender_number,
  thread_type,
  messagesByThread,
}: TriageParams) {
  console.log("[triageMessage] Starting message triage");

  try {
    const threadMessages = messagesByThread.get(thread_id) || [];
    
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

    // Triage message intent
    const triage = await triageMessageIntent(messages);
    console.log("[triageMessage] Triage result:", triage);
    
    // Based on the triage result, choose the appropriate workflow
    switch (triage.responseType) {
      case 'generateEmail':
        console.log('Running Generate Email')
        // Triage to send an email using the agent's email address
        // TODO: case where an email isn't mentioned in the message
        await SendEmailFromAgent(threadMessages)
        
      case 'followUpResponse':
        console.log('Running Follow Up Response')
        // Triage to ask a follow up question
        
        break;
        
      case 'simpleResponse':
      default:
        console.log('Running Default Response')
        // Use the default workflow
        await DefaultReplyToMessage(
          messages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number
        );
    }
  } catch (error) {
    console.error("[Triage] Error:", error);
    throw error;
  }
}
