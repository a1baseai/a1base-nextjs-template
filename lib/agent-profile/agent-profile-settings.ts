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

// Extend the AgentProfileSettings type to include source tracking
interface AgentProfileSettingsWithSource extends AgentProfileSettings {
  _source?: string;
}
import { loadFromLocalStorage, LOCAL_STORAGE_KEYS } from '../storage/local-storage';
import { loadProfileSettings } from '../storage/file-storage';

// Default settings that will be used if no custom settings are found
export const defaultAgentProfileSettings: AgentProfileSettingsWithSource = {
  name: "Amy",
  role: "AI Customer Success Manager",
  isPersonified: true,
  companyName: "A1Base",
  companyDescription: "A1Base helps AI developers build AI agents that can communicate with users via WhatsApp, email, and other channels.",
  profileImageUrl: "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250210_1742_Corporate+Serene+Smile_simple_compose_01jkq9gs6rea3v4n7w461rwye2.gif",
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
const getAgentProfileSettings = async (): Promise<AgentProfileSettingsWithSource> => {
  console.log('[PROFILE SETTINGS] Starting to load agent profile settings...');
  // First try to load from file storage via API
  try {
    console.log('[PROFILE SETTINGS] Attempting to load from file storage...');
    const fileSettings = await loadProfileSettings();
    if (fileSettings) {
      console.log(`[PROFILE SETTINGS] Successfully loaded settings for "${fileSettings.name}" from file storage`);
      return { ...fileSettings, _source: 'file_storage' };
    } else {
      console.log('[PROFILE SETTINGS] No settings found in file storage');
    }
  } catch (error) {
    console.warn('[PROFILE SETTINGS] Error loading profile settings from API:', error);
    // Continue to next method if API fails
  }
  
  // Next try to load from localStorage (browser only)
  if (typeof window !== 'undefined') {
    console.log('[PROFILE SETTINGS] Attempting to load from localStorage...');
    const localStorageSettings = loadFromLocalStorage<AgentProfileSettings>(LOCAL_STORAGE_KEYS.AGENT_PROFILE);
    if (localStorageSettings) {
      console.log(`[PROFILE SETTINGS] Successfully loaded settings for "${localStorageSettings.name}" from localStorage`);
      return { ...localStorageSettings, _source: 'local_storage' };
    } else {
      console.log('[PROFILE SETTINGS] No settings found in localStorage');
    }
  }
  
  // Next try environment variable
  if (process.env.AGENT_PROFILE_SETTINGS) {
    console.log('[PROFILE SETTINGS] Attempting to load from environment variable...');
    try {
      const envSettings = JSON.parse(process.env.AGENT_PROFILE_SETTINGS);
      console.log(`[PROFILE SETTINGS] Successfully loaded settings for "${envSettings.name}" from environment variable`);
      return { ...envSettings, _source: 'environment_variable' };
    } catch (error) {
      console.warn('[PROFILE SETTINGS] Error parsing AGENT_PROFILE_SETTINGS env variable:', error);
      // Continue to defaults if parsing fails
    }
  } else {
    console.log('[PROFILE SETTINGS] AGENT_PROFILE_SETTINGS environment variable not found');
  }
  
  // Fall back to default settings
  console.log(`[PROFILE SETTINGS] Using default settings for "${defaultAgentProfileSettings.name}"`);
  return { ...defaultAgentProfileSettings, _source: 'default' };
};

/**
 * Synchronous version for use in contexts where async is not possible
 * This only checks localStorage and defaults, not file storage
 */
const getAgentProfileSettingsSync = (): AgentProfileSettingsWithSource => {
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
  console.log(`[PROFILE SETTINGS] Using default settings for "${defaultAgentProfileSettings.name}"`);
  return { ...defaultAgentProfileSettings, _source: 'default' };
};

// Export the sync version of settings for immediate use
// This might not have the file storage data, but components can fetch that separately if needed
const agentProfileSettings = getAgentProfileSettingsSync();
export default agentProfileSettings;

// Also export the async getter for components that can wait for the file data
export { getAgentProfileSettings };
