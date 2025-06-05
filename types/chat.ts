export interface ThreadMessage {
  message_id: string
  content: string
  message_type: 'text' | 'rich_text' | 'image' | 'video' | 'audio' | 'location' | 'reaction' | 'group_invite' | 'unsupported_message_type'
  message_content: {
    text?: string
    data?: string
    latitude?: number
    longitude?: number
    name?: string
    address?: string
    quoted_message_content?: string
    quoted_message_sender?: string
    reaction?: string
    groupName?: string
    inviteCode?: string
    error?: string
  }
  sender_number: string
  sender_name: string
  timestamp: string
  thread_id?: string
  thread_type?: string
  role?: 'user' | 'assistant' | 'system'
}

export interface MessageRecord {
  message_id: string
  external_id?: string
  content: string
  message_type: string
  message_content: {
    text?: string
    data?: string
    latitude?: number
    longitude?: number
    name?: string
    address?: string
    quoted_message_content?: string
    quoted_message_sender?: string
    reaction?: string
    groupName?: string
    inviteCode?: string
    error?: string
    [key: string]: any
  }
  service?: string
  sender_id?: string
  sender_number: string
  sender_name: string
  sender_service?: string
  sender_metadata?: Record<string, any>
  timestamp: string
}

// User settings interfaces
export interface UserPreferences {
  respond_only_when_mentioned?: boolean
  email?: string
  [key: string]: any
}

export interface UserMetadata {
  onboarding_complete?: boolean
  preferences?: UserPreferences
  [key: string]: any
}

// Extended webhook payload with agent_mentioned
export interface ExtendedWebhookPayload {
  thread_id: string
  message_id: string
  thread_type: 'group' | 'individual' | 'broadcast'
  sender_number: string
  sender_name: string
  a1_account_id: string
  timestamp: string
  service: string
  message_type: 'text' | 'rich_text' | 'image' | 'video' | 'audio' | 'location' | 'reaction' | 'group_invite' | 'unsupported_message_type'
  is_from_agent: boolean
  agent_mentioned?: boolean  // New field for mention detection
  message_content: {
    text?: string
    data?: string
    latitude?: number
    longitude?: number
    name?: string
    address?: string
    quoted_message_content?: string
    quoted_message_sender?: string
    reaction?: string
    groupName?: string
    inviteCode?: string
    error?: string
  }
}