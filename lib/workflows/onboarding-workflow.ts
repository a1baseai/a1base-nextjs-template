/**
 * Onboarding workflow functionality
 * Handles the process of introducing new users to the system
 * through guided conversation flows.
 */

import { A1BaseAPI } from "a1base-node";
import { ThreadMessage } from "@/types/chat";
import { loadOnboardingFlow } from "../onboarding-flow/onboarding-storage";
import { createAgenticOnboardingPrompt } from "./agentic-onboarding-workflows";

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

/**
 * Handles the onboarding flow when triggered by "Start onboarding"
 * Creates an agentic onboarding experience where the AI guides the conversation
 * @returns A structured onboarding response with a system prompt for the AI
 */
export async function StartOnboarding(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<{ messages: { text: string, waitForResponse: boolean }[] }> {
  console.log("Workflow Start [StartOnboarding]");

  try {
    // Safely load the onboarding flow
    const onboardingFlow = await loadOnboardingFlow();
  
    // If onboarding is disabled, just skip
    if (!onboardingFlow.enabled) {
      console.log("Onboarding flow is disabled, skipping");
      return { messages: [] };
    }

    console.log("Using agentic onboarding mode with AI-driven conversation");
    
    // Use the dedicated function to create the agentic onboarding prompt
    const aiPrompt = createAgenticOnboardingPrompt(onboardingFlow);
    
    // Create a single message with the agentic prompt
    const agenticMessage = { text: aiPrompt, waitForResponse: true };
    
    // For WhatsApp or other channels, send the message through A1Base
    // Skip sending if we're using the special skip marker
    if ((thread_type === "group" || thread_type === "individual") && 
        service !== "web-ui" && 
        service !== "__skip_send") {
      
      console.log("Sending onboarding message(s) via A1Base API");
      const messageData = {
        content: agenticMessage.text,
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
    } else if (service === "__skip_send") {
      console.log("Skipping onboarding message sending as requested by __skip_send marker");
    }
    
    // Return the agentic message for the web UI or other channels
    return { messages: [agenticMessage] };
  } catch (error) {
    console.error("[StartOnboarding] Error:", error);
    const errorMessage = "Sorry, I encountered an error starting the onboarding process.";
    
    // Handle error similarly to DefaultReplyToMessage
    if (service !== "web-ui" && service !== "__skip_send") {
      const errorMessageData = {
        content: errorMessage,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp" as const,
      };
      
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
    
    return { messages: [{ text: errorMessage, waitForResponse: false }] };
  }
}
