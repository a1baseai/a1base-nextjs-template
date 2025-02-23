import { ThreadMessage } from "../../types/chat";

/** Valid roles for chat messages */
export type ChatRole = "system" | "user" | "assistant" | "function";

/** Configuration for email generation */
export interface EmailGenerationResult {
  /** Email address of the recipient */
  recipientEmail: string;
  /** Whether a recipient was successfully identified */
  hasRecipient: boolean;
  /** Generated email content */
  emailContent: {
    /** Email subject line */
    subject: string;
    /** Email body content */
    body: string;
  } | null;
}

/** Response from message triage */
export interface MessageTriageResponse {
  responseType: 
    | "sendIdentityCard"
    | "simpleResponse"
    | "followUpResponse"
    | "handleEmailAction"
    | "taskActionConfirmation";
}
