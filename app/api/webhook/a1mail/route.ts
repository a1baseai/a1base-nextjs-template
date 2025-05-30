/**
 * A1Mail Email Webhook Handler
 * 
 * Receives incoming emails from A1Base and processes them through the workflow system
 */
import { NextResponse } from "next/server";
import { handleEmailIncoming } from "@/lib/ai-triage/handle-email-incoming";

// Define webhook payload type based on A1Mail documentation
export interface EmailWebhookPayload {
  email_id: string;
  subject: string;
  sender_address: string;
  recipient_address: string;
  timestamp: string;
  service: "email";
  raw_email_data: string;
}

export async function POST(request: Request) {
  try {
    // Log the raw request
    const body = (await request.json()) as EmailWebhookPayload;
    
    console.log("[EMAIL-WEBHOOK] Received email:", {
      email_id: body.email_id,
      from: body.sender_address,
      to: body.recipient_address,
      subject: body.subject,
      timestamp: body.timestamp
    });

    // Process the email through our handler
    await handleEmailIncoming(body);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error('[EMAIL-WEBHOOK] Error processing incoming email:', error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500 }
    );
  }
} 