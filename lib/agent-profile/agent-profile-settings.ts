/**
 * Agent Profile Settings
 * 
 * Defines the core personality and behavioral characteristics of the AI agent.
 * Configures the agent's identity, communication style, and workflow preferences.
 * 
 * Configuration can come from:
 * 1. Server-side file storage (if editing via the profile editor UI)
 * 2. Browser localStorage (as fallback if file storage is unavailable)
 * 3. AGENT_PROFILE_SETTINGS environment variable
 * 4. Default settings if none of the above are available
 */

import { 
  LanguageStyle, 
  WorkflowSettings, 
  AgentSettings, 
  AgentProfileSettings 
} from './types';
import { loadFromLocalStorage, LOCAL_STORAGE_KEYS } from '../storage/local-storage';
import { loadProfileSettings } from '../storage/file-storage';

// Default settings that will be used if no custom settings are found
export const defaultAgentProfileSettings: AgentProfileSettings = {
  name: "Amy",
  role: "AI Customer Success Manager",
  isPersonified: true,
  companyName: "A1Base",
  companyDescription: "A1Base helps AI developers build AI agents that can communicate with users via WhatsApp, email, and other channels.",
  botPurpose: [
    "My purpose is to help developers understand and implement A1Base's API for giving AI agents real-world communication capabilities",
    "Guide users in setting up AI agents with verified phone numbers, email addresses, and trusted identities",
    "Explain how to integrate A1Base with various AI models and services like OpenAI and Anthropic",
    "Demonstrate how A1Base enables AI agents to interact via WhatsApp, email, and other channels",
  ],
  languageStyle: {
    language: "English",
    tone: [
      "You are friendly and approachable while being knowledgeable about A1Base features",
      "You explain technical concepts in a warm, conversational way that's easy to follow",
      "You show genuine excitement and encouragement when helping developers build AI applications", 
      "You offer helpful guidance with a supportive and patient approach",
      "You engage in natural dialogue and make developers feel comfortable asking questions"
    ],
    dialect: "American",
  },
  workflowSettings: {
    workflow: "Technical Guide",
  },
  agentSettings: {
    agent: "Product Guide",
  },
};

/**
 * Get the current agent profile settings with fallback chain:
 * 1. Server-side file storage
 * 2. Browser localStorage
 * 3. Environment variable
 * 4. Default settings
 */
const getAgentProfileSettings = async (): Promise<AgentProfileSettings> => {
  // First try to load from file storage via API
  try {
    const fileSettings = await loadProfileSettings();
    if (fileSettings) {
      return fileSettings;
    }
  } catch (error) {
    console.warn('Error loading profile settings from API:', error);
    // Continue to next method if API fails
  }
  
  // Next try to load from localStorage (browser only)
  if (typeof window !== 'undefined') {
    const localStorageSettings = loadFromLocalStorage<AgentProfileSettings>(LOCAL_STORAGE_KEYS.AGENT_PROFILE);
    if (localStorageSettings) {
      return localStorageSettings;
    }
  }
  
  // Next try environment variable
  if (process.env.AGENT_PROFILE_SETTINGS) {
    try {
      return JSON.parse(process.env.AGENT_PROFILE_SETTINGS);
    } catch (error) {
      console.warn('Error parsing AGENT_PROFILE_SETTINGS env variable:', error);
      // Continue to defaults if parsing fails
    }
  }
  
  // Fall back to default settings
  return defaultAgentProfileSettings;
};

/**
 * Synchronous version for use in contexts where async is not possible
 * This only checks localStorage and defaults, not file storage
 */
const getAgentProfileSettingsSync = (): AgentProfileSettings => {
  // Try to load from localStorage (browser only)
  if (typeof window !== 'undefined') {
    const localStorageSettings = loadFromLocalStorage<AgentProfileSettings>(LOCAL_STORAGE_KEYS.AGENT_PROFILE);
    if (localStorageSettings) {
      return localStorageSettings;
    }
  }
  
  // Next try environment variable
  if (process.env.AGENT_PROFILE_SETTINGS) {
    try {
      return JSON.parse(process.env.AGENT_PROFILE_SETTINGS);
    } catch (error) {
      // Continue to defaults if parsing fails
    }
  }
  
  // Fall back to default settings
  return defaultAgentProfileSettings;
};

// Export the sync version of settings for immediate use
// This might not have the file storage data, but components can fetch that separately if needed
const agentProfileSettings = getAgentProfileSettingsSync();
export default agentProfileSettings;

// Also export the async getter for components that can wait for the file data
export { getAgentProfileSettings };
