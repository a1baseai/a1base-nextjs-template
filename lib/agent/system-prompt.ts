/*
  This file manages the core personality and behavior settings for the A1Base agent through system prompts.
  
  It combines safety settings, agent profile configurations, and other behavioral guidelines into a unified
  system prompt that defines how the agent interacts with users. The file exports a getSystemPrompt function
  that generates the complete prompt by:

  1. Loading safety configurations from safety-settings.ts
  2. Loading agent personality settings from agent-profile-settings.ts
  3. Combining them into a structured prompt with safety guidelines and agent profile information

  This is a critical file for customizing the agent's personality, tone, and behavioral boundaries.
  Modify the imported TypeScript configuration files to adjust the agent's behavior for your use case.
*/

import safetySettings from "../safety-config/safety-settings";
import agentProfileSettings from "../agent-profile/agent-profile-settings";
import { getFormattedInformation } from "../agent-profile/agent-base-information";

/**
 * Generates the safety-related portion of the system prompt.
 * 
 * This function takes the safety settings configuration and formats it into a
 * structured prompt section that defines the agent's safety boundaries and
 * behavioral restrictions. It includes:
 * 
 * - Profanity filtering rules
 * - Data handling policies
 * - Language guidelines
 * - Content restrictions
 * - Privacy and compliance requirements
 * - Custom safety prompts
 * 
 * @param settings - Safety configuration object from safety-settings.ts
 * @returns Formatted safety prompt section
 */
function getSafetyPrompt(settings: typeof safetySettings): string {
  // Create a readable list of any custom safety prompts
  let customPromptsList = "";
  if (settings?.customSafetyPrompts) {
    const promptsArray = Object.values(settings.customSafetyPrompts);
    if (promptsArray.length) {
      customPromptsList = promptsArray
        .map((prompt) => `- ${prompt}`)
        .join("\n");
    }
  }

  return `
Safety Guidelines:

1) Profanity Filter: ${
    settings.profanityFilter.allowProfanity ? "Allowed" : "Disallowed"
  }

2) Data Sensitivity:
   - handleCustomerData: ${settings.dataSensitivity.handleCustomerData}
   - piiHandling: ${settings.dataSensitivity.piiHandling}

3) Language Guidelines:
   - avoidSlang: ${settings.languageGuidelines.avoidSlang}

4) Response Policies:
   - avoidDisallowedContent: ${settings.responsePolicies.avoidDisallowedContent}
   - disallowedContentCategories: ${settings.responsePolicies.disallowedContentCategories.join(
     ", "
   )}

5) Privacy:
   - anonymizeUserData: ${settings.privacy.anonymizeUserData}
   - logSensitiveData: ${settings.privacy.logSensitiveData}

6) Compliance:
   - GDPR? ${settings.compliance.gdpr}
   - CCPA? ${settings.compliance.ccpa}

7) Tell Jokes: ${settings.tellJokes.allowJokes ? "Allowed" : "Disallowed"}

Additional Notes:
${customPromptsList}

Please ensure you strictly follow these safety guidelines in every response.

`;
}

/**
 * Creates the agent profile section of the system prompt.
 * 
 * This function formats the agent's core identity and personality settings into
 * a structured prompt section. It includes:
 * 
 * - Agent name and company affiliation
 * - Core purpose and objectives
 * - Language preferences and style
 * - Communication tone settings
 * 
 * @param profile - Agent profile configuration from agent-profile-settings.ts
 * @returns Formatted agent profile section
 */
function getAgentProfileSnippet(profile: typeof agentProfileSettings): string {
  const { name, companyName, botPurpose, languageStyle } = profile;
  const tone = languageStyle?.tone?.join(" ");
  return `
[AGENT PROFILE]

Name: ${name}
Company: ${companyName}
Purpose: ${botPurpose?.join(" ")}
Language: ${languageStyle?.language} (${languageStyle?.dialect})
Tone: ${tone}

[/AGENT PROFILE]
`;
}

/**
 * Retrieves and formats the agent's base information.
 * 
 * This function gets the foundational information about the agent from
 * agent-base-information.ts and formats it for inclusion in the system prompt.
 * This includes static information that defines the agent's core capabilities
 * and knowledge base.
 * 
 * @returns Formatted base information section
 */
function getAgentBaseInformationSnippet(): string {
  return `
${getFormattedInformation()}
`;
}

/**
 * Generates the complete system prompt that defines the agent's behavior and personality.
 * 
 * This function combines multiple configuration sources to create a comprehensive prompt
 * that guides the AI model's responses. It incorporates:
 * 
 * 1. Agent profile and identity information
 * 2. Base capabilities and knowledge
 * 3. Safety settings and behavioral boundaries
 * 4. User-specific customizations
 * 
 * The resulting prompt ensures consistent agent behavior while maintaining appropriate
 * safety boundaries and personalization for each user interaction.
 * 
 * @param userName - Name of the user for personalizing the prompt
 * @returns Complete formatted system prompt string
 */
export const getSystemPrompt = (userName: string) => `
<YOUR PROFILE>
${getAgentProfileSnippet(agentProfileSettings)}
</YOUR PROFILE>

<AGENT BASE INFORMATION>
${getAgentBaseInformationSnippet()}
</AGENT BASE INFORMATION>

<SAFETY>
${getSafetyPrompt(safetySettings)}
</SAFETY>

<USER CONTEXT>
Name: ${userName}
</USER CONTEXT>
`;
