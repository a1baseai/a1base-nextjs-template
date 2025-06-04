/**
 * SMS Webhook Route Handler
 * Handles incoming SMS messages from A1Base
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, isTimestampValid } from '@/lib/security/webhook-verification';
import { processSMSWebhook } from '@/lib/webhooks/sms-processor';
import { getInitializedAdapter } from '@/lib/supabase/config';

export async function POST(req: NextRequest) {
  console.log('[SMS Route] Received SMS webhook request');
  
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-timestamp');
    const receivedSig = req.headers.get('x-signature');
    
    console.log('[SMS Route] Headers:', {
      hasTimestamp: !!timestamp,
      hasSignature: !!receivedSig,
      timestamp: timestamp ? `${timestamp.substring(0, 10)}...` : 'none'
    });
    
    // Verify webhook signature if enabled
    if (process.env.ENABLE_SMS_SIGNATURE_VERIFICATION !== 'false') {
      if (!verifyWebhookSignature(rawBody, timestamp, receivedSig)) {
        console.error('[SMS Route] Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
      
      // Check timestamp to prevent replay attacks (5 minute window)
      if (!isTimestampValid(timestamp)) {
        console.error('[SMS Route] Invalid or expired timestamp');
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 403 });
      }
      
      console.log('[SMS Route] Webhook signature and timestamp verified');
    } else {
      console.warn('[SMS Route] Webhook signature verification is disabled');
    }
    
    // Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[SMS Route] Failed to parse JSON payload:', parseError);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    
    // Log incoming SMS details
    console.log('[SMS Route] Incoming SMS:', {
      event: payload.event,
      message_id: payload.message_id,
      sender: payload.sender_number,
      service: payload.service,
      contentLength: payload.message_content?.length
    });
    
    // Ensure it's an SMS webhook
    if (payload.service !== 'sms') {
      console.error('[SMS Route] Not an SMS webhook, service:', payload.service);
      return NextResponse.json({ error: 'Not an SMS webhook' }, { status: 400 });
    }
    
    // Process based on event type
    if (payload.event === 'incoming_message') {
      // Get database adapter
      const adapter = await getInitializedAdapter();
      
      if (!adapter) {
        console.error('[SMS Route] Failed to initialize database adapter');
        return NextResponse.json({ error: 'Database initialization failed' }, { status: 500 });
      }
      
      // Process the SMS
      await processSMSWebhook(payload, adapter);
      
      console.log('[SMS Route] SMS processed successfully');
      return NextResponse.json({ status: 'success' }, { status: 200 });
      
    } else {
      console.warn('[SMS Route] Unhandled event type:', payload.event);
      return NextResponse.json({ 
        status: 'success',
        warning: `Unhandled event type: ${payload.event}`
      }, { status: 200 });
    }
    
  } catch (error) {
    console.error('[SMS Route] Error processing SMS webhook:', error);
    
    // Return 500 for server errors
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 