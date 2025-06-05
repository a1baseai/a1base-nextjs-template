/**
 * Common types used throughout the agent profile system.
 * This file centralizes all type definitions to maintain consistency and avoid duplication.
 */

/**
 * Represents a section of information about the company or product
 * that will be provided to the AI agent as context.
 */
export interface InformationSection {
  /** Title of the information section */
  title: string;
  /** Actual content/text of the information section */
  content: string;
  /** Priority value (higher = more important) that affects ordering */
  priority: number;
}

/**
 * Defines the communication style preferences for the agent
 */
export interface LanguageStyle {
  /** Primary language the agent should use */
  language: string;
  /** List of key principles that define the agent's communication style */
  tone: string[];
  /** Specific dialect or regional variation of the language */
  dialect: string;
}

/**
 * Defines workflow-related settings for the agent
 */
export interface WorkflowSettings {
  /** Type of workflow the agent should follow */
  workflow: string;
}

/**
 * Defines core agent behavior settings
 */
export interface AgentSettings {
  /** Specific role or type of agent */
  agent: string;
  /** URL to the animated profile GIF */
  profileGifUrl?: string;
}

/**
 * Defines group chat behavior preferences for the agent
 */
export interface GroupChatPreferences {
  /** Whether the agent should only respond to group messages when explicitly mentioned */
  respond_only_when_mentioned: boolean;
  /** Additional group chat settings can be added here in the future */
}

/**
 * Comprehensive profile settings for configuring an agent's identity and behavior
 */
export interface AgentProfileSettings {
  /** Name of the agent - how it should identify itself */
  name: string;
  /** Company name the agent represents */
  companyName: string;
  /** Whether the agent is personified */
  isPersonified: boolean;
  /** Role of the agent */
  role: string;
  /** List of primary objectives and purposes of the agent */
  botPurpose: string[];
  /** Language and communication style settings */
  languageStyle: LanguageStyle;
  /** Workflow-specific configurations */
  workflowSettings: WorkflowSettings;
  /** General agent behavior settings */
  agentSettings: AgentSettings;
  /** Description of the company the agent represents */
  companyDescription: string;
  /** URL of the profile image/GIF for the agent */
  profileImageUrl?: string;
  /** Group chat behavior preferences */
  groupChatPreferences: GroupChatPreferences;
} 