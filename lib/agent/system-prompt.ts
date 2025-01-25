/*
  This file manages the core personality and behavior settings for the A1Base agent through system prompts.
  
  It combines safety settings, agent profile configurations, and other behavioral guidelines into a unified
  system prompt that defines how the agent interacts with users. The file exports a getSystemPrompt function
  that generates the complete prompt by:

  1. Loading safety configurations from safety-settings.json
  2. Loading agent personality settings from agent-profile-settings.json  
  3. Combining them into a structured prompt with safety guidelines and agent profile information

  This is a critical file for customizing the agent's personality, tone, and behavioral boundaries.
  Modify the imported JSON configuration files to adjust the agent's behavior for your use case.
*/

import safetySettings from "../safety-config/safety-settings.json";
import agentProfileSettings from "../agent-profile/agent-profile-settings.json";
import agentBaseInformation from "../agent-profile/agent-base-information.json";

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

function getAgentBaseInformationSnippet(
  information: typeof agentBaseInformation
): string {
  return `
${information}
`;
}

export const getSystemPrompt = (userName: string) => `
<YOUR PROFILE>
${getAgentProfileSnippet(agentProfileSettings)}
</YOUR PROFILE>

<AGENT BASE INFORMATION>
${getAgentBaseInformationSnippet(agentBaseInformation)}
</AGENT BASE INFORMATION>

<SAFETY>
${getSafetyPrompt(safetySettings)}
</SAFETY>


`;
