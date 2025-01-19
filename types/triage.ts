export type MessageRecord = {
  message_id: string;
  content: string;
  sender_number: string;
  sender_name: string;
  timestamp: string;
};

export type TriageParams = {
  thread_id: string;
  message_id: string;
  content: string;
  sender_name: string;
  sender_number: string;
  thread_type: string;
  timestamp: string;
  messagesByThread: Map<string, MessageRecord[]>;
};
