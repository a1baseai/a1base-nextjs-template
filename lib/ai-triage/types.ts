/**
 * Represents a message record in the thread history
 */
export interface MessageRecord {
  message_id: string;
  content: string;
  sender_number: string;
  sender_name: string;
  timestamp: string;
}

/**
 * Parameters required for message triage
 */
export interface TriageParams {
  thread_id: string;
  message_id: string;
  content: string;
  sender_name: string;
  sender_number: string;
  thread_type: string;
  timestamp: string;
  messagesByThread: Map<string, MessageRecord[]>;
  service: string;
}

/**
 * Result of message triage operation
 */
export interface TriageResult {
  /** Type of response determined by triage */
  type: 'identity' | 'email' | 'default' | 'default-webchat';
  /** Whether the triage operation was successful */
  success: boolean;
  /** Optional message describing the result */
  message?: string;
  /** Additional data associated with the result */
  data?: Record<string, unknown>;
}
