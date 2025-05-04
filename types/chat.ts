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