export interface WebhookPayload {
  thread_id: string;
  message_id: string;
  thread_type: "group" | "individual" | "broadcast";
  content: string;
  sender_number: string;
  sender_name: string;
  a1_account_number: string;
  a1_account_id: string;
  timestamp: string;
}
