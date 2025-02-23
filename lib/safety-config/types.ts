/**
 * Safety configuration for content filtering
 */
export interface SafetyConfig {
  /** Content filtering settings */
  contentFiltering: {
    /** Whether to enable profanity filtering */
    enableProfanityFilter: boolean;
    /** Whether to enable sensitive content filtering */
    enableSensitiveFilter: boolean;
    /** Custom words to filter */
    customFilterWords: string[];
  };
  /** Response moderation settings */
  responseModeration: {
    /** Maximum response length */
    maxLength: number;
    /** Whether to allow external links */
    allowLinks: boolean;
    /** Whether to allow code snippets */
    allowCode: boolean;
  };
}
