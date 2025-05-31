/**
 * A1Cron Webhook Handler
 * 
 * Receives success/failure callbacks from A1Cron when jobs execute
 */
import { NextResponse } from "next/server";
import { CronWebhookPayload } from "@/lib/a1cron/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CronWebhookPayload;
    
    console.log("[A1CRON-WEBHOOK] Received callback:", {
      cron_job_id: body.cron_job_id,
      execution_id: body.execution_id,
      status: body.status,
      executed_at: body.executed_at,
      response_code: body.response_code,
      response_time_ms: body.response_time_ms
    });

    // Handle the webhook based on status
    if (body.status === 'success') {
      console.log(`[A1CRON-WEBHOOK] Job ${body.cron_job_id} executed successfully`);
      // TODO: Add any success handling logic here
      // For example: update database, send notifications, etc.
    } else {
      console.error(`[A1CRON-WEBHOOK] Job ${body.cron_job_id} failed:`, body.error_message);
      // TODO: Add any failure handling logic here
      // For example: send alerts, retry logic, etc.
    }

    return NextResponse.json({ 
      status: "success",
      message: "Webhook processed successfully" 
    });
  } catch (error) {
    console.error('[A1CRON-WEBHOOK] Error processing webhook:', error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500 }
    );
  }
} 