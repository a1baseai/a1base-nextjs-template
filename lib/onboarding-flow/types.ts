/**
 * Types for the Agent Onboarding Flow
 * Includes both individual and group chat onboarding configurations
 */

export interface OnboardingMessage {
  id: string;
  text: string;
  waitForResponse: boolean;
  order: number;
}

export interface UserField {
  id: string;
  label: string;
  required: boolean;
  description: string;
}

export interface AgenticSettings {
  systemPrompt: string;
  userFields: UserField[];
  finalMessage: string;
}

export interface GroupAgenticSettings {
  systemPrompt: string;
  initialGroupMessage: string;
  userFields: UserField[];
  finalMessage: string;
  participantThreshold: number;
  autoStartOnboarding: boolean;
  reintroduceAgent: boolean;
  reintroductionInterval: number; // in days
}

export interface OnboardingFlow {
  enabled: boolean;
  messages: OnboardingMessage[];
  mode: 'agentic';
  agenticSettings: AgenticSettings;
  settings: {
    // General settings for the onboarding flow
    skipForReturningUsers: boolean;
    // Additional optional settings specific to the onboarding flow
    captureUserPreferences?: boolean;
    askForName?: boolean;
    askForBusinessType?: boolean;
  };
}

export interface GroupOnboardingFlow {
  enabled: boolean;
  mode: 'agentic';
  agenticSettings: GroupAgenticSettings;
}

export const defaultOnboardingFlow: OnboardingFlow = {
  enabled: true,
  messages: [
    {
      id: '1',
      text: 'Hi there! 👋 I\'m your new AI assistant. Welcome!',
      waitForResponse: false,
      order: 1
    },
    {
      id: '2',
      text: 'I\'m here to help with answering your questions and supporting your business needs.',
      waitForResponse: false,
      order: 2
    },
    {
      id: '3',
      text: 'What can I help you with today?',
      waitForResponse: true,
      order: 3
    }
  ],
  mode: 'agentic',
  agenticSettings: {
    systemPrompt: 'You are conducting an onboarding conversation with a new user. Your goal is to make them feel welcome and collect some basic information that will help you assist them better in the future. Be friendly, professional, and conversational.',
    userFields: [
      {
        id: 'name',
        label: 'Full Name',
        required: true,
        description: 'Ask for the user\'s full name'
      },
      {
        id: 'email',
        label: 'Email Address',
        required: true,
        description: 'Ask for the user\'s email address'
      }
    ],
    finalMessage: 'Thank you for sharing this information. I\'ve saved your details and I\'m ready to help you achieve your goals.'
  },
  settings: {
    skipForReturningUsers: true,
    captureUserPreferences: false,
    askForName: false,
    askForBusinessType: false
  }
};

export const defaultGroupOnboardingFlow: GroupOnboardingFlow = {
  enabled: true,
  mode: 'agentic',
  agenticSettings: {
    systemPrompt: 'You are conducting an onboarding conversation in a group chat. Your goal is to introduce yourself to the group, make everyone feel welcome, and gather some basic information about the group and its purpose. Be friendly, professional, and conversational.',
    initialGroupMessage: 'Hello everyone! I\'m your AI assistant. Welcome to this group chat! I\'m here to help facilitate your conversations and provide assistance. Could someone tell me what this group is about so I can better assist you?',
    userFields: [
      {
        id: 'group_purpose',
        label: 'Group Purpose',
        required: true,
        description: 'Ask what the main purpose/goal of this group chat is'
      },
      {
        id: 'expected_topics',
        label: 'Expected Topics',
        required: true,
        description: 'Ask about the primary topics that will be discussed in this group'
      }
    ],
    finalMessage: 'Thank you everyone for sharing this information. I now have a better understanding of this group\'s purpose. I\'m here to assist you all with your discussions and queries.',
    participantThreshold: 3,
    autoStartOnboarding: true,
    reintroduceAgent: true,
    reintroductionInterval: 30
  }
};
