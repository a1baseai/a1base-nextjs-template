import { OnboardingFlow } from "../onboarding-flow/types";

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
