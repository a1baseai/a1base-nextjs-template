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
import { SupabaseAdapter } from "../supabase/adapter";
import { getInitializedAdapter } from "../supabase/config";

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
  
  // Console log removed
  return aiPrompt;
}

/**
 * Generate a conversational onboarding message using OpenAI
 * @param systemPrompt The system prompt containing onboarding instructions
 * @returns A conversational, user-friendly onboarding message
 */
async function generateOnboardingMessage(systemPrompt: string): Promise<string> {
  try {
    // Console log removed
    
    const messages = [
      {
        role: "system" as const,
        content: systemPrompt
      },
      {
        role: "user" as const,
        content: "Hello!"
      }
    ];
    console.log("Onboarding prompt messages:", JSON.stringify(messages, null, 2));
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      temperature: 0.7,
    });
    
    const generatedMessage = completion.choices[0]?.message?.content || 
      "Hello! I'm your assistant. To get started, could you please tell me your name?";
    
    // Console log removed
    return generatedMessage;
  } catch (error) {
    console.error('Error generating onboarding message:', error);
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
    const conversationalMessageText = await generateOnboardingMessage(systemPrompt);
    
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
