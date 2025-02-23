/**
 * Configuration for agent system prompts
 */
export interface SystemPromptConfig {
  /** Base personality traits */
  personality: {
    /** Primary traits that define the agent */
    traits: string[];
    /** Communication style preferences */
    style: string[];
  };
  /** Safety and content guidelines */
  safety: {
    /** Topics to avoid */
    restrictedTopics: string[];
    /** Allowed response types */
    allowedResponses: string[];
  };
  /** Task handling preferences */
  taskHandling: {
    /** How to approach complex tasks */
    approach: string;
    /** Error handling preferences */
    errorHandling: string;
  };
}
