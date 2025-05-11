/**
 * Onboarding workflow functionality
 * Handles the process of introducing new users to the system
 * through guided conversation flows.
 */

import { A1BaseAPI } from "a1base-node";
import { ThreadMessage } from "@/types/chat";
import { loadOnboardingFlow } from "../onboarding-flow/onboarding-storage";
import { OnboardingFlow } from "../onboarding-flow/types";
import { SupabaseAdapter } from "../supabase/adapter";
import { getInitializedAdapter } from "../supabase/config";
import { generateAgentResponse } from "../services/openai";

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

/**
 * Creates a system prompt for onboarding based on the onboarding settings
 * 
 * @param onboardingFlow The complete onboarding flow configuration
 * @param existingData Optional. An object containing already collected user data.
 * @returns The formatted system prompt for the AI
 */
export function createAgenticOnboardingPrompt(
  onboardingFlow: OnboardingFlow,
  existingData?: Record<string, any>
): string {
  if (!onboardingFlow.agenticSettings) {
    throw new Error("Agentic settings not available in the onboarding flow");
  }
  
  // Use the configured system prompt for onboarding
  const systemPrompt = onboardingFlow.agenticSettings.systemPrompt;
  
  // Filter userFields to only include those not yet collected or empty
  const fieldsToCollect = onboardingFlow.agenticSettings.userFields.filter(field => {
    return !existingData || !existingData[field.id] || existingData[field.id] === "";
  });

  // If all required fields are collected (or no fields were defined to be collected),
  // instruct AI to use the final message.
  if (fieldsToCollect.length === 0) {
    return `${systemPrompt}\n\nAll required information has been collected. Now, respond with: ${onboardingFlow.agenticSettings.finalMessage}`;
  }
  
  // Convert user fields to instructions for the AI
  const fieldInstructions = fieldsToCollect
    .map(field => {
      const requiredText = field.required ? "(required)" : "(optional)";
      return `- ${field.description} ${requiredText}. Store as '${field.id}'.`;
    })
    .join("\n");
  
  // Combine system prompt with field instructions
  const aiPrompt = `${systemPrompt}\n\nCollect the following information:\n${fieldInstructions}\n\nAfter collecting all required information, respond with: ${onboardingFlow.agenticSettings.finalMessage}`;
  
  // Console log removed
  return aiPrompt;
}

/**
 * Generate a conversational onboarding message using OpenAI
 * @param systemPrompt The system prompt containing onboarding instructions
 * @param service The service being used
 * @returns A conversational, user-friendly onboarding message
 */
async function generateOnboardingMessage(systemPrompt: string, service?: string): Promise<string> {
  try {
    // console.log("[generateOnboardingMessage] System prompt for onboarding:", systemPrompt);

    // Use generateAgentResponse. For an initial onboarding message, there are no prior threadMessages.
    // The systemPrompt created by createAgenticOnboardingPrompt will be the main driver.
    // We provide a simple initial user message like "Hello!" to kick off the AI's response generation
    // based on the detailed system prompt.
    const generatedMessage = await generateAgentResponse(
      [], // No prior messages
      "Hello!", // Initial user-like prompt to elicit response from the system prompt
      "individual", // Assuming onboarding starts as individual, can be adjusted if needed
      [], // No participants needed for this direct system prompt driven response
      [], // No projects needed
      service // Pass service through
    );

    // console.log("[generateOnboardingMessage] Generated onboarding message:", generatedMessage);
    return generatedMessage || "Hello! I'm your assistant. To get started, could you please tell me your name?";
  } catch (error) {
    // console.error('[generateOnboardingMessage] Error generating onboarding message:', error);
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
  // Console log removed

  try {
    // Safely load the onboarding flow
    const onboardingFlow = await loadOnboardingFlow();
  
    // If onboarding is disabled, just skip
    if (!onboardingFlow.enabled) {
      // Console log removed
      return { messages: [] };
    }

    // Console log removed
    
    // Create the system prompt for onboarding
    const systemPrompt = createAgenticOnboardingPrompt(onboardingFlow);
    
    // Console log removed
    
    // Generate a conversational message using the system prompt
    const conversationalMessageText = await generateOnboardingMessage(systemPrompt, service);
    
    // Create a single message with the conversational prompt
    const onboardingMessage = { text: conversationalMessageText, waitForResponse: true };

    // Store AI message before sending to user
    if (thread_id && process.env.A1BASE_AGENT_NUMBER && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const supabaseAdapter = await getInitializedAdapter();
      
      if (!supabaseAdapter) { 
        console.error("[StartOnboarding] Supabase adapter not initialized. Cannot store AI message.");
        // Optionally handle this error, e.g., by returning or throwing
      } else {
        const messageContentForDb = { text: conversationalMessageText };
        const aiMessageId = `ai-onboarding-${Date.now()}`;

        console.log(`[StartOnboarding] Attempting to store initial AI onboarding message. Thread ID: ${thread_id}, Service: ${service}, Type: ${thread_type}, AI Message ID: ${aiMessageId}`);
        try {
          await supabaseAdapter.storeMessage(
            thread_id, 
            process.env.A1BASE_AGENT_NUMBER, 
            aiMessageId, 
            messageContentForDb, 
            'text', 
            service || 'whatsapp', 
            messageContentForDb 
          );
          console.log(`[StartOnboarding] Successfully stored initial AI onboarding message. AI Message ID: ${aiMessageId}`);
        } catch (storeError) {
          console.error(`[StartOnboarding] Error storing initial AI onboarding message. AI Message ID: ${aiMessageId}, Error:`, storeError);
        }
      }
    }
    
    // For WhatsApp or other channels, send the message through A1Base
    // Skip sending if we're using the special skip marker
    if ((thread_type === "group" || thread_type === "individual") && 
        service !== "web-ui" && 
        service !== "__skip_send") {
      
      // Console log removed
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
      // Console log removed
    }
    
    // Return the conversational message for the web UI or other channels
    return { messages: [onboardingMessage] };
  } catch (error) {
    console.error('Error in onboarding workflow:', error);
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
