/**
 * SMS Status Webhook Route Handler
 * Handles SMS delivery status updates from A1Base
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, isTimestampValid } from '@/lib/security/webhook-verification';
import { processSMSStatusWebhook } from '@/lib/webhooks/sms-processor';
import { getInitializedAdapter } from '@/lib/supabase/config';

export async function POST(req: NextRequest) {
  console.log('[SMS Status Route] Received SMS status webhook request');
  
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-timestamp');
    const receivedSig = req.headers.get('x-signature');
    
    console.log('[SMS Status Route] Headers:', {
      hasTimestamp: !!timestamp,
      hasSignature: !!receivedSig
    });
    
    // Verify webhook signature if enabled
    if (process.env.ENABLE_SMS_SIGNATURE_VERIFICATION !== 'false') {
      if (!verifyWebhookSignature(rawBody, timestamp, receivedSig)) {
        console.error('[SMS Status Route] Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
      
      // Check timestamp to prevent replay attacks (5 minute window)
      if (!isTimestampValid(timestamp)) {
        console.error('[SMS Status Route] Invalid or expired timestamp');
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 403 });
      }
      
      console.log('[SMS Status Route] Webhook signature and timestamp verified');
    } else {
      console.warn('[SMS Status Route] Webhook signature verification is disabled');
    }
    
    // Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[SMS Status Route] Failed to parse JSON payload:', parseError);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    
    // Log status update details
    console.log('[SMS Status Route] SMS Status Update:', {
      event: payload.event,
      message_id: payload.message_id,
      status: payload.status,
      to: payload.to,
      service: payload.service,
      error_code: payload.error_code
    });
    
    // Ensure it's an SMS status webhook
    if (payload.service !== 'sms' || payload.event !== 'message_status') {
      console.error('[SMS Status Route] Not an SMS status webhook:', {
        service: payload.service,
        event: payload.event
      });
      return NextResponse.json({ error: 'Not an SMS status webhook' }, { status: 400 });
    }
    
    // Get database adapter
    const adapter = await getInitializedAdapter();
    
    if (!adapter) {
      console.error('[SMS Status Route] Failed to initialize database adapter');
      return NextResponse.json({ error: 'Database initialization failed' }, { status: 500 });
    }
    
    // Process the status update
    await processSMSStatusWebhook(payload, adapter);
    
    console.log('[SMS Status Route] SMS status processed successfully');
    return NextResponse.json({ status: 'success' }, { status: 200 });
    
  } catch (error) {
    console.error('[SMS Status Route] Error processing SMS status webhook:', error);
    
    // Return 500 for server errors
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 