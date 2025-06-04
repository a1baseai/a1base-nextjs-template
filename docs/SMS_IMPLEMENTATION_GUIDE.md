# SMS Implementation Guide

This guide provides step-by-step instructions for implementing SMS functionality based on the [SMS Implementation Specification](./SMS_IMPLEMENTATION_SPEC.md).

## Prerequisites

- [ ] Ensure A1Base number is activated for SMS
- [ ] Have A1Base API credentials ready
- [ ] Access to Supabase database
- [ ] Node.js/TypeScript development environment

## Implementation Checklist

### Phase 1: Database Setup

1. **For New Installations**
   Use the updated `supabase.sql` file which includes all SMS fields.

2. **For Existing Installations**
   Run the migration script:
   ```sql
   -- Run sms-migration.sql in Supabase SQL editor
   -- This adds the necessary columns for SMS support
   ```

3. **Update Environment Variables**
   ```env
   # Add to .env.local
   SMS_WEBHOOK_PATH=/api/a1base/sms
   SMS_STATUS_WEBHOOK_PATH=/api/a1base/sms/status
   ENABLE_SMS=true
   SMS_MAX_LENGTH=1200
   ```

### Phase 2: Core SMS Handler

1. **Create SMS Handler Service**
   
   Create `lib/services/sms-handler.ts`:
   ```typescript
   export class SMSHandler {
     private static readonly MAX_SMS_LENGTH = 1200;
     private static readonly GSM7_REGEX = /^[\x00-\x7F\u00A0-\u00FF\u20AC]*$/;
     
     static validateSMSContent(content: string): {
       valid: boolean;
       error?: string;
       length?: number;
     } {
       const sanitized = this.sanitizeForSMS(content);
       
       if (!this.GSM7_REGEX.test(sanitized)) {
         return {
           valid: false,
           error: 'Message contains characters not supported by SMS'
         };
       }
       
       if (sanitized.length > this.MAX_SMS_LENGTH) {
         return {
           valid: false,
           error: `Message too long for SMS (${sanitized.length}/${this.MAX_SMS_LENGTH} characters)`,
           length: sanitized.length
         };
       }
       
       return { valid: true, length: sanitized.length };
     }
     
     static sanitizeForSMS(content: string): string {
       // Replace common Unicode with GSM-7 equivalents
       return content
         .replace(/['']/g, "'")
         .replace(/[""]/g, '"')
         .replace(/—/g, '-')
         .replace(/…/g, '...')
         .replace(/•/g, '*');
     }
   }
   ```

2. **Extend A1Base Client**
   
   Create `lib/a1base/extended-client.ts`:
   ```typescript
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
     async sendSMS(accountId: string, payload: SendSMSPayload) {
       const sanitized = SMSHandler.sanitizeForSMS(payload.content.message);
       const validation = SMSHandler.validateSMSContent(sanitized);
       
       if (!validation.valid) {
         throw new Error(validation.error);
       }
       
       return this.sendIndividualMessage(accountId, {
         ...payload,
         content: { message: sanitized }
       });
     }
   }
   
   // Export singleton instance
   export const extendedClient = new ExtendedA1BaseAPI({
     credentials: {
       apiKey: process.env.A1BASE_API_KEY!,
       apiSecret: process.env.A1BASE_API_SECRET!,
     },
   });
   ```

### Phase 3: System Prompt Updates

1. **Create Prompt Builder**
   
   Create `lib/services/prompt-builder.ts`:
   ```typescript
   export function buildSystemPrompt(basePrompt: string, service: string): string {
     let prompt = basePrompt;
     
     if (service === 'sms') {
       prompt += `
   
   IMPORTANT SMS LIMITATIONS:
   - You are responding via SMS, which has strict limitations.
   - Keep your responses under 1200 characters (ideally under 160 for single SMS).
   - Use only basic ASCII characters - avoid emojis, special symbols, or Unicode.
   - Be extremely concise while remaining helpful.
   - If a detailed response is needed, offer to continue via WhatsApp or another channel.
   - Common replacements: use * for bullets, ... for ellipsis, - for em dash.
   - Current message service: SMS`;
     }
     
     return prompt;
   }
   ```

### Phase 4: Webhook Security

1. **Create Webhook Verification Module**
   
   Create `lib/security/webhook-verification.ts`:
   ```typescript
   import crypto from 'crypto';
   
   export function verifyWebhookSignature(
     rawBody: string,
     timestamp: string | null,
     receivedSig: string | null
   ): boolean {
     if (!timestamp || !receivedSig) return false;
     
     const secret = process.env.A1BASE_API_SECRET;
     if (!secret) {
       console.error('[Webhook] API secret not configured');
       return false;
     }
     
     const expectedSig = crypto
       .createHmac('sha256', secret)
       .update(timestamp + rawBody)
       .digest('hex');
     
     return crypto.timingSafeEqual(
       Buffer.from(receivedSig),
       Buffer.from(expectedSig)
     );
   }
   
   export function isTimestampValid(timestamp: string | null): boolean {
     if (!timestamp) return false;
     
     const requestTime = parseInt(timestamp);
     const currentTime = Math.floor(Date.now() / 1000);
     const timeDiff = currentTime - requestTime;
     
     return timeDiff >= 0 && timeDiff <= 300; // 5 minute window
   }
   ```

### Phase 5: SMS Webhook Endpoints

1. **Create SMS Webhook Route**
   
   Create `app/api/a1base/sms/route.ts`:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { verifyWebhookSignature, isTimestampValid } from '@/lib/security/webhook-verification';
   import { processSMSWebhook } from '@/lib/webhooks/sms-processor';
   
   export async function POST(req: NextRequest) {
     try {
       const rawBody = await req.text();
       const timestamp = req.headers.get('x-timestamp');
       const receivedSig = req.headers.get('x-signature');
       
       if (!verifyWebhookSignature(rawBody, timestamp, receivedSig)) {
         return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
       }
       
       if (!isTimestampValid(timestamp)) {
         return NextResponse.json({ error: 'Invalid timestamp' }, { status: 403 });
       }
       
       const payload = JSON.parse(rawBody);
       await processSMSWebhook(payload);
       
       return NextResponse.json({ status: 'success' }, { status: 200 });
     } catch (error) {
       console.error('[SMS Webhook] Error:', error);
       return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
     }
   }
   ```

2. **Create SMS Processor**
   
   Create `lib/webhooks/sms-processor.ts`:
   ```typescript
   import { processWebhookPayload } from '../messaging/process-webhook';
   
   interface SMSWebhookPayload {
     event: 'incoming_message';
     thread_id: string;
     message_id: string;
     thread_type: 'individual';
     sender_number: string;
     sender_name: string;
     timestamp: number;
     service: 'sms';
     message_type: 'text';
     is_from_agent: boolean;
     message_content: string;
     direction: 'inbound';
   }
   
   export async function processSMSWebhook(payload: SMSWebhookPayload) {
     console.log('[SMS Webhook] Processing:', payload.message_id);
     
     if (payload.is_from_agent) {
       console.log('[SMS Webhook] Skipping agent message');
       return;
     }
     
     const unifiedPayload = {
       message_id: payload.message_id,
       thread_id: payload.thread_id,
       thread_type: payload.thread_type as 'individual',
       sender_number: payload.sender_number,
       sender_name: payload.sender_name,
       message_content: { text: payload.message_content },
       message_type: payload.message_type,
       timestamp: new Date(payload.timestamp).toISOString(),
       service: 'sms' as const,
     };
     
     await processWebhookPayload(unifiedPayload);
   }
   ```

### Phase 6: Update Message Sending

1. **Update Send Message Function**
   
   Modify `lib/messaging/send-message.ts`:
   ```typescript
   import { extendedClient } from '../a1base/extended-client';
   import { SMSHandler } from '../services/sms-handler';
   
   export async function sendResponseMessage({
     text,
     from,
     threadType,
     recipientId,
     threadId,
     service = 'whatsapp',
     chatId,
     adapter,
   }: SendMessageParams) {
     if (service === 'sms') {
       // Validate SMS content
       const validation = SMSHandler.validateSMSContent(text);
       
       if (!validation.valid) {
         console.error(`[SMS Send Error] ${validation.error}`);
         
         // Store failed attempt
         await adapter.storeMessage({
           chatId,
           senderId: agentSenderId,
           messageId: `sms-failed-${Date.now()}`,
           messageType: 'text',
           service: 'sms',
           content: {
             text: text.substring(0, 100) + '... [MESSAGE TOO LONG]',
             error: validation.error,
             originalLength: validation.length
           },
           status: 'failed',
         });
         
         throw new Error(validation.error);
       }
       
       // Send SMS
       const smsPayload = {
         content: { message: SMSHandler.sanitizeForSMS(text) },
         from,
         to: recipientId,
         service: 'sms' as const,
         type: 'individual' as const,
       };
       
       await extendedClient.sendSMS(
         process.env.A1BASE_ACCOUNT_ID!, 
         smsPayload
       );
       
       await adapter.storeMessage({
         chatId,
         senderId: agentSenderId,
         messageId: `sms-${chatId}-${Date.now()}`,
         messageType: 'text',
         service: 'sms',
         content: { text: SMSHandler.sanitizeForSMS(text) },
       });
     } else {
       // Existing WhatsApp logic
     }
   }
   ```

### Phase 7: Testing

1. **Create Test Suite**
   
   Create `tests/sms/sms-integration.test.ts`:
   ```typescript
   import { SMSHandler } from '@/lib/services/sms-handler';
   
   describe('SMS Integration', () => {
     describe('SMSHandler', () => {
       test('validates GSM-7 charset', () => {
         const result1 = SMSHandler.validateSMSContent('Hello!');
         expect(result1.valid).toBe(true);
         
         const result2 = SMSHandler.validateSMSContent('Hello 👋');
         expect(result2.valid).toBe(false);
         expect(result2.error).toContain('not supported');
       });
       
       test('blocks messages over 1200 chars', () => {
         const longText = 'A'.repeat(1201);
         const result = SMSHandler.validateSMSContent(longText);
         
         expect(result.valid).toBe(false);
         expect(result.error).toContain('too long');
         expect(result.length).toBe(1201);
       });
       
       test('sanitizes Unicode correctly', () => {
         const input = 'Hello "world" — it's great…';
         const expected = 'Hello "world" - it\'s great...';
         expect(SMSHandler.sanitizeForSMS(input)).toBe(expected);
       });
     });
   });
   ```

2. **Manual Testing Checklist**
   - [ ] Send test SMS via API
   - [ ] Test message length validation (try >1200 chars)
   - [ ] Test Unicode character sanitization
   - [ ] Receive inbound SMS webhook
   - [ ] Verify webhook signature validation
   - [ ] Verify status webhook processing
   - [ ] Test AI responses stay within limits

### Phase 8: Deployment

1. **Configure A1Base Dashboard**
   - [ ] Add SMS webhook URL: `https://yourdomain.com/api/a1base/sms`
   - [ ] Add status webhook URL: `https://yourdomain.com/api/a1base/sms/status`
   - [ ] Verify SMS is enabled for your number

2. **Deploy Application**
   - [ ] Run database migration (for existing apps)
   - [ ] Deploy application with SMS endpoints
   - [ ] Verify environment variables are set
   - [ ] Test webhooks are accessible

3. **Monitor Initial Usage**
   - [ ] Check logs for webhook processing
   - [ ] Monitor blocked messages
   - [ ] Verify message delivery
   - [ ] Check AI response lengths

## Troubleshooting

### Common Issues

1. **Message Blocked for Length**
   - Check AI system prompts are SMS-aware
   - Verify prompt builder is being used
   - Review failed message logs

2. **Webhook Signature Failures**
   - Verify API secret is correct
   - Check raw body is being used for signature
   - Ensure headers are being passed correctly

3. **Character Encoding Issues**
   - Use SMS sanitization before sending
   - Test with various Unicode characters
   - Check sanitization is working properly

## Best Practices

1. **AI Configuration**
   - Always use the prompt builder for SMS conversations
   - Test AI responses to ensure they stay within limits
   - Monitor failed sends to improve prompts

2. **Error Handling**
   - Log all blocked messages for analysis
   - Provide clear feedback when messages fail
   - Consider fallback to WhatsApp for long content

3. **User Experience**
   - Set expectations about SMS limitations
   - Offer alternative channels for detailed conversations
   - Keep onboarding messages short for SMS users

## Next Steps

After implementation:
1. Monitor AI response lengths and adjust prompts
2. Analyze blocked messages to improve system
3. Create user documentation about SMS limits
4. Consider automated fallback to WhatsApp for long messages 