/**
 * SMS Webhook Processor
 * Processes incoming SMS webhooks and transforms them to unified format
 */

import { DatabaseAdapterInterface } from '../interfaces/database-adapter';

// SMS-specific webhook payload structure
export interface SMSWebhookPayload {
  event: 'incoming_message';
  thread_id: string;
  message_id: string;
  thread_type: 'individual';
  sender_number: string;
  sender_name: string;
  a1_account_number: string;
  a1_account_id: string;
  timestamp: number;
  service: 'sms';
  message_type: 'text';
  is_from_agent: boolean;
  a1_phone_number: string;
  message_content: string; // Plain string for SMS
  direction: 'inbound';
}

// SMS status webhook payload
export interface SMSStatusWebhookPayload {
  event: 'message_status';
  message_id: string;
  service: 'sms';
  to: string;
  from: string;
  body: string;
  status: 'sent' | 'delivered' | 'failed';
  direction: 'outbound';
  error_code?: string;
  error_message?: string;
}

/**
 * Processes an incoming SMS webhook
 * @param payload The SMS webhook payload
 * @param adapter The database adapter
 * @returns Promise that resolves when processing is complete
 */
export async function processSMSWebhook(
  payload: SMSWebhookPayload,
  adapter: DatabaseAdapterInterface
): Promise<void> {
  console.log('[SMS Webhook] Processing incoming SMS:', payload.message_id);
  console.log('[SMS Webhook] From:', payload.sender_number);
  console.log('[SMS Webhook] Content length:', payload.message_content.length);
  
  // Skip if from agent to prevent loops
  if (payload.is_from_agent) {
    console.log('[SMS Webhook] Skipping agent message to prevent loop');
    return;
  }
  
  // Validate required fields
  if (!payload.message_id || !payload.sender_number || !payload.message_content) {
    console.error('[SMS Webhook] Missing required fields:', {
      hasMessageId: !!payload.message_id,
      hasSenderNumber: !!payload.sender_number,
      hasContent: !!payload.message_content
    });
    throw new Error('Invalid SMS webhook payload: missing required fields');
  }
  
  // Transform to unified format for processing
  const unifiedPayload = {
    message_id: payload.message_id,
    thread_id: payload.thread_id,
    thread_type: payload.thread_type as 'individual',
    sender_number: payload.sender_number,
    sender_name: payload.sender_name || payload.sender_number, // Use number as name if not provided
    message_content: { text: payload.message_content }, // Wrap in object for unified format
    message_type: 'text' as const, // SMS is always text
    timestamp: new Date(payload.timestamp).toISOString(),
    service: 'sms' as const,
  };
  
  console.log('[SMS Webhook] Transformed to unified format:', {
    message_id: unifiedPayload.message_id,
    thread_id: unifiedPayload.thread_id,
    service: unifiedPayload.service
  });
  
  // Use existing message processing pipeline
  try {
    await adapter.processWebhookPayload(unifiedPayload);
    console.log('[SMS Webhook] Successfully processed SMS message');
  } catch (error) {
    console.error('[SMS Webhook] Error processing SMS:', error);
    throw error;
  }
}

/**
 * Processes an SMS status webhook
 * @param payload The SMS status webhook payload
 * @param adapter The database adapter
 * @returns Promise that resolves when processing is complete
 */
export async function processSMSStatusWebhook(
  payload: SMSStatusWebhookPayload,
  adapter: any
): Promise<void> {
  console.log(`[SMS Status] Processing status update for message ${payload.message_id}`);
  console.log(`[SMS Status] Status: ${payload.status}`);
  
  try {
    // Update message status in database
    await adapter.updateMessageStatus({
      messageId: payload.message_id,
      status: payload.status,
      updatedAt: new Date().toISOString(),
      errorCode: payload.error_code,
      errorMessage: payload.error_message
    });
    
    // Log status update
    console.log(`[SMS Status] Updated message ${payload.message_id} status to ${payload.status}`);
    
    // Handle failed messages
    if (payload.status === 'failed') {
      console.error(`[SMS Status] Message failed:`, {
        messageId: payload.message_id,
        to: payload.to,
        errorCode: payload.error_code,
        errorMessage: payload.error_message
      });
      
      // You could implement retry logic or notifications here
      await handleFailedSMS(payload);
    }
  } catch (error) {
    console.error('[SMS Status] Error updating message status:', error);
    throw error;
  }
}

/**
 * Handles failed SMS messages
 * @param payload The failed SMS status payload
 */
async function handleFailedSMS(payload: SMSStatusWebhookPayload): Promise<void> {
  // Log detailed failure information
  console.error('[SMS Failed] SMS delivery failed:', {
    messageId: payload.message_id,
    recipient: payload.to,
    errorCode: payload.error_code,
    errorMessage: payload.error_message,
    timestamp: new Date().toISOString()
  });
  
  // TODO: Implement any additional failure handling logic
  // Examples:
  // - Send notification to admin
  // - Retry with different provider
  // - Switch to WhatsApp fallback
  // - Update user preferences
} 