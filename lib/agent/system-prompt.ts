/*
  This file manages the core personality and behavior settings for the A1Base agent through system prompts.
  
  It combines safety settings, agent profile configurations, and other behavioral guidelines into a unified
  system prompt that defines how the agent interacts with users. The file exports a getSystemPrompt function
  that generates the complete prompt by:

  1. Loading safety configurations from safety-settings.ts
  2. Loading agent personality settings from file storage, localStorage, or defaults
  3. Loading base information from file storage, localStorage, or defaults
  4. Combining them into a structured prompt with safety guidelines and agent profile information

  This is a critical file for customizing the agent's personality, tone, and behavioral boundaries.
  Settings can be customized through the profile editor UI.
*/

import safetySettings from "../safety-config/safety-settings";
import {
  defaultAgentProfileSettings,
  getAgentProfileSettings,
} from "../agent-profile/agent-profile-settings";
import {
  getFormattedInformation,
  getAgentBaseInformation,
} from "../agent-profile/agent-base-information";

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

function getAgentProfileSnippet(
  profile: typeof defaultAgentProfileSettings
): string {
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

async function getAgentBaseInformationSnippet(): Promise<string> {
  // Get the most up-to-date base information (from file storage, localStorage, or defaults)
  const baseInfo = await getAgentBaseInformation();
  return `
${getFormattedInformation(baseInfo)}
`;
}

export const getSystemPrompt = async (): Promise<string> => {
  // Get the most up-to-date profile settings (from file storage, localStorage, or defaults)
  const profileSettings = await getAgentProfileSettings();

  // Get the formatted base information
  const baseInfoSnippet = await getAgentBaseInformationSnippet();

  return `  
<YOUR PROFILE>
${getAgentProfileSnippet(profileSettings)}
</YOUR PROFILE>

<AGENT BASE INFORMATION>
${baseInfoSnippet}
</AGENT BASE INFORMATION>

<SAFETY>
${getSafetyPrompt(safetySettings)}
</SAFETY>


`;
};
