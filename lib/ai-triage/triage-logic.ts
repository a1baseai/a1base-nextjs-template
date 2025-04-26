import { ThreadMessage } from "@/types/chat";
import { getInitializedAdapter } from "../supabase/config";
import {
  DefaultReplyToMessage,
  ConstructEmail,
  SendEmailFromAgent,
} from "../workflows/basic_workflow";
import { triageMessageIntent } from "../services/openai";
import { A1BaseAPI } from "a1base-node";
import fetch from "node-fetch";

const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Helper function to get the base URL for API requests
const getBaseUrl = () => {
  // Browser context: use relative URLs
  if (typeof window !== "undefined") {
    return "";
  }

  // Server context: we need absolute URLs
  // First check for NEXTAUTH_URL which is commonly set in Next.js apps
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) return nextAuthUrl;

  // Then check for VERCEL_URL which is set in Vercel deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  // Finally, default to localhost if no environment variables are set
  return "http://localhost:3000";
};

type MessageRecord = {
  message_id: string;
  content: string;
  sender_number: string;
  sender_name: string;
  timestamp: string;
  message_type?: string;
  message_content?: {
    text?: string;
    data?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
    quoted_message_content?: string;
    quoted_message_sender?: string;
    reaction?: string;
    groupName?: string;
    inviteCode?: string;
    error?: string;
  };
};

type TriageParams = {
  thread_id: string;
  message_id: string;
  content: string;
  message_type: string;
  message_content: {
    text?: string;
    data?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
    quoted_message_content?: string;
    quoted_message_sender?: string;
    reaction?: string;
    groupName?: string;
    inviteCode?: string;
    error?: string;
  };
  sender_name: string;
  sender_number: string;
  thread_type: string;
  timestamp: string;
  messagesByThread: Map<string, MessageRecord[]>;
  service: string;
};

type TriageResult = {
  type: "identity" | "default" | "email" | "onboarding";
  success: boolean;
  message?: string;
  data?: string[] | { subject?: string; body?: string };
};

// ======================== MAIN TRIAGE LOGIC ========================
// Processes incoming messages and routes them to appropriate workflows
// in basic_workflow.ts. Currently triages for:
// - Simple response to one off message
// - Sharing A1 Agent Identity card
// - Drafting and sending an email
//
// To add new triage cases:
// 1. Add new responseType to triageMessageIntent() in openai.ts
// 2. Add corresponding workflow function in basic_workflow.ts
// 3. Add new case in switch statement below
// 4. Update TriageResult type if needed
// ===================================================================
/**
 * Trigger the onboarding flow for a user via WhatsApp
 *
 * @param threadId The WhatsApp thread ID
 * @param phoneNumber The recipient's phone number
 * @returns Promise resolving to a TriageResult indicating success or failure
 */
export async function triggerOnboardingFlow(
  threadId: string,
  phoneNumber: string
): Promise<TriageResult> {
  try {
    console.log(`[TRIAGE] Triggering onboarding flow for thread ${threadId}`);

    // Get onboarding messages from the API
    const response = await fetch(`${getBaseUrl()}/api/onboarding-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ threadId, phoneNumber }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get onboarding messages: ${response.statusText}`
      );
    }

    const { messages } = await response.json();

    if (!messages || messages.length === 0) {
      throw new Error("No onboarding messages returned from API");
    }

    console.log(`[TRIAGE] Got ${messages.length} onboarding messages to send`);

    // Send messages with delays
    for (const message of messages) {
      await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
        content: message.content,
        from: process.env.A1BASE_AGENT_NUMBER!,
        to: phoneNumber,
        service: "whatsapp",
      });

      // Only add delay between messages when not waiting for response
      if (
        !message.wait_for_response &&
        messages.indexOf(message) < messages.length - 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2500)); // 2.5 second delay
      }
    }

    console.log(
      `[TRIAGE] Successfully completed onboarding flow for thread ${threadId}`
    );
    return {
      type: "onboarding",
      success: true,
      message: "Onboarding flow completed successfully",
      data: messages.map((m: any) => m.content),
    };
  } catch (error) {
    console.error(
      `[TRIAGE] Error running onboarding flow for thread ${threadId}:`,
      error
    );
    return {
      type: "onboarding",
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error occurred during onboarding",
    };
  }
}

export async function triageMessage({
  thread_id,
  // content,
  // sender_name,
  sender_number,
  thread_type,
  messagesByThread,
  service,
}: TriageParams): Promise<TriageResult> {
  console.log("[triageMessage] Starting message triage");

  try {
    let threadMessages: MessageRecord[] = [];

    // Skip Supabase for web-ui service
    if (service === "web-ui") {
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
          console.log(threadMessages);
        }
      } else {
        console.log(
          "[triageMessage] Using in-memory storage for message history"
        );
        threadMessages = messagesByThread.get(thread_id) || [];
      }
    }

    // Convert to ThreadMessage format
    const messages: ThreadMessage[] = threadMessages.map((msg) => ({
      content: msg.content,
      sender_number: msg.sender_number,
      sender_name: msg.sender_name,
      thread_id,
      thread_type,
      timestamp: msg.timestamp,
      message_id: msg.message_id,
      message_type: (msg.message_type ||
        "text") as ThreadMessage["message_type"],
      message_content: msg.message_content || {
        text: msg.content,
      },
    }));

    const triage = await triageMessageIntent(messages);
    // Based on the triage result, choose the appropriate workflow

    switch (triage.responseType) {
      case "handleEmailAction":
        console.log("Running Email Workflow");

        const emailData = await ConstructEmail(messages);

        if (service === "web-ui") {
          return {
            type: "email",
            success: true,
            message: `Email drafted with subject: ${emailData.subject}`,
            data: emailData,
          };
        }

        const emailConfirmation = `I've prepared an email with the subject "${emailData.subject}". Would you like me to send it?`;

        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          content: emailConfirmation,
          from: process.env.A1BASE_AGENT_NUMBER!,
          to: sender_number,
          service: "whatsapp",
        });

        return {
          type: "email",
          success: true,
          message: emailConfirmation,
          data: emailData,
        };

      case "simpleResponse":
      default:
        console.log("Running Default Response");

        const response = await DefaultReplyToMessage(
          messages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service
        );

        console.log("Response:", response);

        if (service === "web-ui") {
          return {
            type: "default",
            success: true,
            message: response,
          };
        }

        return {
          type: "default",
          success: true,
          message: response || "Default response sent",
        };
    }
  } catch (error) {
    console.error("[Triage] Error:", error);
    return {
      type: "default",
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
