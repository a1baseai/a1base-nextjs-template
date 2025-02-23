/**
 * Configuration for workflow behavior
 */
export interface WorkflowConfig {
  /** Whether to split messages into paragraphs */
  SPLIT_PARAGRAPHS: boolean;
  /** Maximum length for each message part */
  MAX_MESSAGE_LENGTH: number;
}

/**
 * Email draft structure
 */
export interface EmailDraft {
  /** Email subject line */
  subject: string;
  /** Email body content */
  body: string;
  /** Optional recipient email address */
  recipientEmail?: string;
}

/**
 * Task confirmation result
 */
export interface TaskConfirmation {
  /** Whether the task was confirmed */
  confirmed: boolean;
  /** Optional message about the confirmation */
  message?: string;
  /** Any additional data */
  data?: Record<string, unknown>;
}
