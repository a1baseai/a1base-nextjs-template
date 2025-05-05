import { handleWhatsAppIncoming } from "@/lib/ai-triage/handle-whatsapp-incoming";
import { NextResponse } from "next/server";

// Define our own complete interface to avoid type compatibility issues
export interface ExtendedWhatsAppIncomingData {
  thread_id: string;
  message_id: string;
  content: string;
  message_type: string;
  message_content: {
    text?: string;
    data?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
    quoted_message_content?: string;
    quoted_message_sender?: string;
    reaction?: string;
    groupName?: string;
    inviteCode?: string;
    error?: string;
  };
  sender_name: string;
  sender_number: string;
  thread_type: string;
  timestamp: string;
  service: string;
  a1_account_id?: string;
  is_from_agent?: boolean;
}

// Define webhook payload type based on new A1Base documentation
export interface WebhookPayload {
  thread_id: string;
  message_id: string;
  thread_type: 'group' | 'individual' | 'broadcast';
  sender_number: string;
  sender_name: string;
  a1_account_id: string;
  timestamp: string;
  service: string;
  message_type: 'text' | 'rich_text' | 'image' | 'video' | 'audio' | 'location' | 'reaction' | 'group_invite' | 'unsupported_message_type';
  is_from_agent: boolean;
  message_content: {
    text?: string; // for message_type: text
    data?: string; // base64 encoded string, for message_type: video, audio, image
    latitude?: number; // for message_type: location
    longitude?: number; // for message_type: location
    name?: string; // for message_type: location
    address?: string; // for message_type: location
    quoted_message_content?: string; // for message_type: rich_text
    quoted_message_sender?: string;  // for message_type: rich_text
    reaction?: string; // for message_type: reaction 
    groupName?: string; // for message_type: group_invite
    inviteCode?: string; // for message_type: group_invite
    error?: string; // for message_type: unsupported_message_type
  };
}

export async function POST(request: Request) {
  try {
    // Log the raw request
    const body = (await request.json()) as WebhookPayload;
    
    // == LOGGING THE MESSAGE
    // Console log removed - INCOMING WHATSAPP MESSAGE
    // Console log removed - [Message Details] with message details like ID, thread, sender info, etc.

    // Console log removed - [Message Content]
    // == END LOGS

    // Patch bug where group message sender number is missing if sender is a1base agent
    if (body.thread_type === 'group' && body.sender_number === "+") {
      body.sender_number = process.env.A1BASE_AGENT_NUMBER!;
    }

    // Just pass the WebhookPayload directly
    await handleWhatsAppIncoming(body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error processing incoming message:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
