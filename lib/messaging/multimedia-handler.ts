import { A1BaseAPI } from "a1base-node";

// Media message types based on A1Base documentation
export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MediaMessageContent {
  type: 'media';
  media_url: string;
  media_type: MediaType;
  caption?: string;
}

export interface TextMessageContent {
  type: 'text';
  text: string;
}

export interface LocationMessageContent {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export type MessageContent = MediaMessageContent | TextMessageContent | LocationMessageContent;

// Individual message payload for media
export interface IndividualMediaMessage {
  from: string;
  to: string;
  service: 'whatsapp';
  message_type: 'media';
  media_url: string;
  media_type: MediaType;
  caption?: string;
}

// Group message payload for media
export interface GroupMediaMessage {
  from: string;
  thread_id: string;
  service: 'whatsapp';
  message_type: 'media';
  media_url: string;
  media_type: MediaType;
  caption?: string;
}

// Universal message format
export interface UniversalMessage {
  from: string;
  to?: string; // For individual messages
  thread_id?: string; // For group messages
  service: 'whatsapp';
  type: 'individual' | 'group';
  content: MessageContent;
}

/**
 * Send a multimedia message to an individual or group
 */
export async function sendMultimediaMessage(
  client: A1BaseAPI,
  accountId: string,
  threadType: 'individual' | 'group',
  recipientId: string, // phone number for individual, thread_id for group
  mediaUrl: string,
  mediaType: MediaType,
  caption?: string
): Promise<void> {
  const baseMessage = {
    from: process.env.A1BASE_AGENT_NUMBER!,
    service: 'whatsapp' as const,
    message_type: 'media' as const,
    media_url: mediaUrl,
    media_type: mediaType,
    caption: caption
  };

  if (threadType === 'group') {
    await client.sendGroupMessage(accountId, {
      ...baseMessage,
      thread_id: recipientId,
    } as any); // Using 'as any' temporarily until SDK types are updated
  } else {
    await client.sendIndividualMessage(accountId, {
      ...baseMessage,
      to: recipientId,
    } as any); // Using 'as any' temporarily until SDK types are updated
  }
}

/**
 * Send a message using the universal endpoint format
 */
export async function sendUniversalMessage(
  accountId: string,
  message: UniversalMessage
): Promise<Response> {
  const response = await fetch(
    `https://api.a1base.com/v1/send/${accountId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.A1BASE_API_KEY!,
        'x-api-secret': process.env.A1BASE_API_SECRET!,
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to send message: ${error.message || response.statusText}`);
  }

  return response;
}

/**
 * Process incoming multimedia message data
 */
export function processIncomingMediaMessage(messageContent: any, messageType: string): {
  mediaData?: string;
  mediaType?: MediaType;
  caption?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
} {
  switch (messageType) {
    case 'image':
    case 'video':
    case 'audio':
      return {
        mediaData: messageContent.data,
        mediaType: messageType as MediaType,
        caption: messageContent.caption
      };
    
    case 'document':
      return {
        mediaData: messageContent.data,
        mediaType: 'document',
        caption: messageContent.caption || messageContent.filename
      };
    
    case 'location':
      return {
        location: {
          latitude: messageContent.latitude,
          longitude: messageContent.longitude,
          name: messageContent.name,
          address: messageContent.address
        }
      };
    
    default:
      return {};
  }
}

/**
 * Validate media URL and check if it's accessible
 */
export async function validateMediaUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error validating media URL:', error);
    return false;
  }
}

/**
 * Get file size limits for different media types
 */
export function getMediaSizeLimit(mediaType: MediaType): number {
  const limits = {
    image: 5 * 1024 * 1024, // 5MB
    video: 16 * 1024 * 1024, // 16MB
    audio: 16 * 1024 * 1024, // 16MB
    document: 100 * 1024 * 1024, // 100MB
  };
  
  return limits[mediaType] || 5 * 1024 * 1024; // Default to 5MB
} 