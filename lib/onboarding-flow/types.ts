/**
 * Types for the Agent Onboarding Flow
 */

export interface OnboardingMessage {
  id: string;
  text: string;
  waitForResponse: boolean;
  order: number;
}

export interface OnboardingFlow {
  enabled: boolean;
  messages: OnboardingMessage[];
  mode: 'flow' | 'agentic';
  settings: {
    // General settings for the onboarding flow
    skipForReturningUsers: boolean;
    // Additional optional settings specific to the onboarding flow
    captureUserPreferences?: boolean;
    askForName?: boolean;
    askForBusinessType?: boolean;
  };
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
  mode: 'flow',
  settings: {
    skipForReturningUsers: true,
    captureUserPreferences: false,
    askForName: false,
    askForBusinessType: false
  }
};
