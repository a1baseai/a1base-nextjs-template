import { OnboardingFlow } from "../onboarding-flow/types";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * Handles the agentic onboarding flow processing
 * Takes the onboarding settings and returns a streaming response with AI-guided conversation
 * 
 * @param onboardingPrompt The system prompt for agentic onboarding
 * @returns A streaming response with the AI-guided onboarding
 */
export async function handleAgenticOnboarding(onboardingPrompt: string) {
  console.log('[AGENTIC-ONBOARDING] Starting agentic onboarding flow');
  
  try {
    // For agentic onboarding, we use the message as the system prompt
    // and let the AI handle the conversation naturally
    const result = streamText({
      model: openai('gpt-4'), // Using GPT-4 for better understanding of complex instructions
      system: onboardingPrompt, // Use the agentic prompt as the system message
      messages: [
        {
          role: "assistant",
          content: "Hello! I'm here to help you get set up. Let me ask you a few questions to personalize your experience."
        }
      ],
      temperature: 0.7, // Slightly higher temperature for more natural conversation
      maxTokens: 1000,
    });
    
    console.log('[AGENTIC-ONBOARDING] Created streaming response for agentic onboarding');
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('[AGENTIC-ONBOARDING] Error creating agentic onboarding stream:', error);
    throw error;
  }
}

/**
 * Creates a system prompt for agentic onboarding based on the onboarding settings
 * 
 * @param onboardingFlow The complete onboarding flow configuration
 * @returns The formatted system prompt for the AI
 */
export function createAgenticOnboardingPrompt(onboardingFlow: OnboardingFlow): string {
  if (!onboardingFlow.agenticSettings) {
    throw new Error("Agentic settings not available in the onboarding flow");
  }
  
  // Use the configured system prompt for agentic onboarding
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
  
  console.log("[AGENTIC-ONBOARDING] Generated AI prompt for agentic onboarding");
  return aiPrompt;
}
