/**
 * This file defines the safety and compliance settings for the AI agent.
 * It includes configurations for content filtering, data handling, privacy, and compliance requirements.
 *
 * These settings help ensure the agent operates within appropriate boundaries and follows
 * necessary regulations and guidelines.
 */

export interface ProfanityFilter {
  /** Whether to allow any form of profanity in responses */
  allowProfanity: boolean;
}

export interface DataSensitivity {
  /** How to handle customer data: 'doNotStore', 'encryptAndStore', etc. */
  handleCustomerData: "storeFull" | "doNotStore" | "encryptAndStore" | "anonymizeAndStore";
  /** How to handle personally identifiable information */
  piiHandling:"collectCarefully" | "doNotCollect" | "collectWithConsent" | "anonymize";
}

export interface JokeSettings {
  /** Whether the agent is allowed to tell jokes */
  allowJokes: boolean;
}

export interface LanguageGuidelines {
  /** Whether to avoid using slang or colloquial language */
  avoidSlang: boolean;
}

export interface ResponsePolicies {
  /** Whether to actively avoid disallowed content categories */
  avoidDisallowedContent: boolean;
  /** List of content categories that should not be included in responses */
  disallowedContentCategories: string[];
}

export interface PrivacySettings {
  /** Whether to anonymize user data in responses and logs */
  anonymizeUserData: boolean;
  /** Whether to log sensitive data */
  logSensitiveData: boolean;
}

export interface ComplianceSettings {
  /** Whether to follow GDPR guidelines */
  gdpr: boolean;
  /** Whether to follow CCPA guidelines */
  ccpa: boolean;
}

export interface CustomSafetyPrompts {
  /** Custom safety instructions for the agent */
  [key: string]: string;
}

export interface SafetySettings {
  profanityFilter: ProfanityFilter;
  dataSensitivity: DataSensitivity;
  tellJokes: JokeSettings;
  languageGuidelines: LanguageGuidelines;
  responsePolicies: ResponsePolicies;
  privacy: PrivacySettings;
  compliance: ComplianceSettings;
  customSafetyPrompts: CustomSafetyPrompts;
}

const safetySettings: SafetySettings = {
  profanityFilter: {
    allowProfanity: false,
  },
  dataSensitivity: {
    handleCustomerData: "storeFull",
    piiHandling: "collectCarefully",
  },
  tellJokes: {
    allowJokes: true,
  },
  languageGuidelines: {
    avoidSlang: true,
  },
  responsePolicies: {
    avoidDisallowedContent: true,
    disallowedContentCategories: [
      "profanity",
      "hateSpeech",
      "harassment",
      "politics",
      "religion",
      "sexuality",
      "violence",
      "suicide",
      "selfHarm",
      "discrimination",
      "personalData",
    ],
  },
  privacy: {
    anonymizeUserData: true,
    logSensitiveData: false,
  },
  compliance: {
    gdpr: true,
    ccpa: true,
  },
  customSafetyPrompts: {
    dontMakeUpInformation: "You should not make up information.",
    doubleCheckYourWork: "You should double check your work before responding.",
    dontKnowResponse:
      "If you don't know the answer, say you don't know and respond honestly.",
  },
};

export default safetySettings;
