/**
 * Webhook Verification Module
 * Handles HMAC-SHA256 signature verification for secure webhooks
 */

import crypto from 'crypto';

/**
 * Verifies the webhook signature using HMAC-SHA256
 * @param rawBody The raw request body as a string
 * @param timestamp The timestamp header value
 * @param receivedSig The signature header value
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  receivedSig: string | null
): boolean {
  if (!timestamp || !receivedSig) {
    console.error('[Webhook Verification] Missing timestamp or signature headers');
    return false;
  }
  
  const secret = process.env.A1BASE_API_SECRET;
  if (!secret) {
    console.error('[Webhook Verification] A1BASE_API_SECRET not configured');
    return false;
  }
  
  try {
    // Create the expected signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(timestamp + rawBody)
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSig);
    const receivedBuffer = Buffer.from(receivedSig);
    
    if (expectedBuffer.length !== receivedBuffer.length) {
      console.error('[Webhook Verification] Signature length mismatch');
      return false;
    }
    
    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    
    if (!isValid) {
      console.error('[Webhook Verification] Signature mismatch');
      console.error('Expected:', expectedSig);
      console.error('Received:', receivedSig);
    }
    
    return isValid;
  } catch (error) {
    console.error('[Webhook Verification] Error during verification:', error);
    return false;
  }
}

/**
 * Validates if the webhook timestamp is within acceptable range
 * @param timestamp The timestamp header value
 * @param maxAgeSeconds Maximum age in seconds (default: 300 = 5 minutes)
 * @returns True if timestamp is valid
 */
export function isTimestampValid(
  timestamp: string | null,
  maxAgeSeconds: number = 300
): boolean {
  if (!timestamp) {
    console.error('[Webhook Verification] Missing timestamp');
    return false;
  }
  
  try {
    const requestTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - requestTime;
    
    // Check if timestamp is in the future
    if (timeDiff < 0) {
      console.error('[Webhook Verification] Timestamp is in the future');
      return false;
    }
    
    // Check if timestamp is too old
    if (timeDiff > maxAgeSeconds) {
      console.error(`[Webhook Verification] Timestamp too old: ${timeDiff}s > ${maxAgeSeconds}s`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Webhook Verification] Error parsing timestamp:', error);
    return false;
  }
}

/**
 * Complete webhook verification including signature and timestamp
 * @param rawBody The raw request body
 * @param headers The request headers
 * @returns Verification result with details
 */
export function verifyWebhook(
  rawBody: string,
  headers: {
    'x-signature'?: string | null;
    'x-timestamp'?: string | null;
  }
): {
  valid: boolean;
  error?: string;
  details?: {
    signatureValid?: boolean;
    timestampValid?: boolean;
  };
} {
  const timestamp = headers['x-timestamp'] || null;
  const signature = headers['x-signature'] || null;
  
  // Check timestamp first (cheaper operation)
  const timestampValid = isTimestampValid(timestamp);
  if (!timestampValid) {
    return {
      valid: false,
      error: 'Invalid or expired timestamp',
      details: { timestampValid: false }
    };
  }
  
  // Then verify signature
  const signatureValid = verifyWebhookSignature(rawBody, timestamp, signature);
  if (!signatureValid) {
    return {
      valid: false,
      error: 'Invalid webhook signature',
      details: { timestampValid: true, signatureValid: false }
    };
  }
  
  return {
    valid: true,
    details: { timestampValid: true, signatureValid: true }
  };
}

/**
 * Generates a webhook signature for testing
 * @param rawBody The request body
 * @param timestamp The timestamp
 * @param secret The secret key
 * @returns The generated signature
 */
export function generateWebhookSignature(
  rawBody: string,
  timestamp: string,
  secret: string
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(timestamp + rawBody)
    .digest('hex');
} 