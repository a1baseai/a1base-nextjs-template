/**
 * Onboarding workflow functionality
 * Handles the process of introducing new users to the system
 * through guided conversation flows.
 */

import { A1BaseAPI } from "a1base-node";
import { ThreadMessage } from "@/types/chat";
import { loadOnboardingFlow } from "../onboarding-flow/onboarding-storage";
import { OnboardingFlow } from "../onboarding-flow/types";
import OpenAI from 'openai';

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Creates a system prompt for onboarding based on the onboarding settings
 * 
 * @param onboardingFlow The complete onboarding flow configuration
 * @returns The formatted system prompt for the AI
 */
export function createAgenticOnboardingPrompt(onboardingFlow: OnboardingFlow): string {
  if (!onboardingFlow.agenticSettings) {
    throw new Error("Agentic settings not available in the onboarding flow");
  }
  
  // Use the configured system prompt for onboarding
  const systemPrompt = onboardingFlow.agenticSettings.systemPrompt;
  
  // Convert user fields to instructions for the AI
  const fieldInstructions = onboardingFlow.agenticSettings.userFields
    .map(field => {
      const requiredText = field.required ? "(required)" : "(optional)";
      return `- ${field.description} ${requiredText}. Store as '${field.id}'.`;
    })
    .join("\n");
  
  // Combine system prompt with field instructions
  const aiPrompt = `${systemPrompt}\n\nCollect the following information:\n${fieldInstructions}\n\nAfter collecting all required information, respond with: ${onboardingFlow.agenticSettings.finalMessage}`;
  
  console.log("[Onboarding] Generated AI prompt for onboarding");
  return aiPrompt;
}

/**
 * Generate a conversational onboarding message using OpenAI
 * @param systemPrompt The system prompt containing onboarding instructions
 * @returns A conversational, user-friendly onboarding message
 */
async function generateOnboardingMessage(systemPrompt: string): Promise<string> {
  try {
    console.log('[Onboarding] Generating conversational onboarding message with OpenAI');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: "Hello!"
        }
      ],
      temperature: 0.7,
    });
    
    const generatedMessage = completion.choices[0]?.message?.content || 
      "Hello! I'm your assistant. To get started, could you please tell me your name?";
    
    console.log('[Onboarding] Successfully generated conversational message');
    return generatedMessage;
  } catch (error) {
    console.error('[Onboarding] Error generating conversational message:', error);
    return "Hello! I'm your assistant. To help you get set up, could you please tell me your name?";
  }
}

/**
 * Handles the onboarding flow when triggered by "Start onboarding"
 * Creates an AI-powered onboarding experience where the AI guides the conversation
 * @returns A structured onboarding response with a user-friendly message
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

    console.log("Using AI-driven onboarding conversation");
    
    // Create the system prompt for onboarding
    const systemPrompt = createAgenticOnboardingPrompt(onboardingFlow);
    
    console.log("[Onboarding] System prompt created, generating user-friendly message");
    
    // Generate a conversational message using the system prompt
    const conversationalMessage = await generateOnboardingMessage(systemPrompt);
    
    // Create a single message with the conversational prompt
    const onboardingMessage = { text: conversationalMessage, waitForResponse: true };
    
    // For WhatsApp or other channels, send the message through A1Base
    // Skip sending if we're using the special skip marker
    if ((thread_type === "group" || thread_type === "individual") && 
        service !== "web-ui" && 
        service !== "__skip_send") {
      
      console.log("Sending onboarding message(s) via A1Base API");
      const messageData = {
        content: onboardingMessage.text,
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
    
    // Return the conversational message for the web UI or other channels
    return { messages: [onboardingMessage] };
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
