import { handleWhatsAppIncoming } from "@/lib/ai-triage/handle-whatsapp-incoming";
import { WhatsAppIncomingData } from "a1base-node";
import { NextResponse } from "next/server";

// Define webhook payload type
interface WebhookPayload {
  thread_id: string;
  message_id: string;
  thread_type: 'group' | 'individual' | 'broadcast';
  content: string;
  sender_number: string;
  sender_name: string;
  a1_account_number: string;
  a1_account_id: string;
  timestamp: string;
}

export async function POST(request: Request) {
  try {
    // Log the raw request
    const body = (await request.json()) as WebhookPayload;
    
    // == LOGGGING THE MESSAGE
    console.log("\n=== INCOMING WHATSAPP MESSAGE ===");
    console.log("\n[Message Details]", {
      message_id: body.message_id,
      thread_id: body.thread_id,
      thread_type: body.thread_type,
      sender_number: body.sender_number,
      sender_name: body.sender_name,
      timestamp: body.timestamp,
      a1_account_number: body.a1_account_number,
      a1_account_id: body.a1_account_id,
    });
    // == END LOGS

    // Patch bug where group message sender number is missing if sender is a1base agent
    if (body.thread_type === 'group' && body.sender_number === "+") {
      body.sender_number = process.env.A1BASE_AGENT_NUMBER!;
    }

    // Cast to WhatsAppIncomingData with all required fields
    const whatsappData: WhatsAppIncomingData = {
      message_id: body.message_id,
      thread_id: body.thread_id,
      thread_type: body.thread_type,
      content: body.content,
      sender_number: body.sender_number,
      sender_name: body.sender_name,
      timestamp: body.timestamp,
      a1_account_id: body.a1_account_id,
      service: "whatsapp",
    };

    await handleWhatsAppIncoming(whatsappData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
