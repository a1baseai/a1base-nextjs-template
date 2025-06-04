/**
 * Extended A1Base Client
 * Extends the base A1Base API client with SMS-specific functionality
 */

import { A1BaseAPI } from "a1base-node";
import { SMSHandler } from "../services/sms-handler";

interface SendSMSPayload {
  content: { message: string };
  from: string;
  to: string;
  service: 'sms';
  type: 'individual';
}

export class ExtendedA1BaseAPI extends A1BaseAPI {
  /**
   * Sends an SMS message with validation and sanitization
   * @param accountId The A1Base account ID
   * @param payload The SMS payload
   * @returns Promise with the send result
   */
  async sendSMS(accountId: string, payload: SendSMSPayload) {
    // Sanitize the message content
    const sanitized = SMSHandler.sanitizeForSMS(payload.content.message);
    
    // Validate the sanitized content
    const validation = SMSHandler.validateSMSContent(sanitized);
    
    if (!validation.valid) {
      throw new Error(validation.error || 'SMS validation failed');
    }
    
    // Log the SMS send attempt
    console.log(`[SMS] Sending message to ${payload.to} (${validation.length} chars)`);
    
    // Send using the base API's sendIndividualMessage method
    return this.sendIndividualMessage(accountId, {
      content: sanitized,
      from: payload.from,
      to: payload.to,
      service: payload.service,
      type: payload.type
    } as any);
  }
  
  /**
   * Validates if a message can be sent via SMS
   * @param message The message to validate
   * @returns Validation result
   */
  validateSMS(message: string) {
    return SMSHandler.validateSMSContent(message);
  }
  
  /**
   * Gets a preview of how a message will appear in SMS
   * @param message The message to preview
   * @returns Preview information
   */
  previewSMS(message: string) {
    return SMSHandler.getSMSPreview(message);
  }
}

// Export singleton instance with credentials from environment
export const extendedClient = new ExtendedA1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Export the class for testing or custom instances
export { ExtendedA1BaseAPI as ExtendedA1BaseAPIClass }; 