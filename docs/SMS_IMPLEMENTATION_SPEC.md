# SMS Implementation Specification for A1Base Framework

## Overview

This document outlines the implementation plan for adding SMS functionality to the existing A1Base messaging framework. The implementation will support both sending and receiving SMS messages while maintaining compatibility with the existing WhatsApp integration.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Requirements](#implementation-requirements)
3. [Sending SMS](#sending-sms)
4. [Receiving SMS](#receiving-sms)
5. [Security Implementation](#security-implementation)
6. [Status Webhooks](#status-webhooks)
7. [Database Schema Updates](#database-schema-updates)
8. [System Prompt Updates](#system-prompt-updates)
9. [Integration Points](#integration-points)
10. [Testing Plan](#testing-plan)
11. [Migration Strategy](#migration-strategy)

## Architecture Overview

### Current State
- **Supported Services**: WhatsApp only
- **Message Flow**: Webhook → Message Processing → Storage → Response
- **Storage**: Supabase for message and chat persistence
- **Agent**: OpenAI for generating responses

### Target State
- **Supported Services**: WhatsApp + SMS
- **Unified Message Flow**: Service-agnostic processing with service-specific handlers
- **Character Limits**: SMS (1200 chars GSM-7), WhatsApp (no practical limit)
- **Webhook Security**: HMAC-SHA256 signature verification for SMS
- **Message Handling**: Block SMS messages exceeding limits (no splitting)

## Implementation Requirements

### Core Requirements
1. Support SMS sending with 1200 character limit (GSM-7 charset)
2. Block messages exceeding SMS limits with clear error messages
3. Receive and process incoming SMS messages
4. Implement HMAC-SHA256 webhook signature verification
5. Handle SMS status webhooks
6. Maintain backward compatibility with WhatsApp
7. Update AI system prompts to be SMS-aware

### Technical Stack
- Node.js/TypeScript
- A1Base Node SDK (extend if needed)
- Supabase for storage
- Express.js for webhook endpoints

## Sending SMS

### Implementation Steps

#### 1. Update A1Base Client Configuration
```typescript
// lib/a1base/client.ts
interface SendSMSPayload {
  content: {
    message: string;
  };
  from: string;
  to: string;
  service: 'sms';
  type: 'individual';
}

// Extend existing A1BaseAPI client
export class ExtendedA1BaseAPI extends A1BaseAPI {
  async sendSMS(accountId: string, payload: SendSMSPayload) {
    // Validate GSM-7 charset and 1200 char limit
    if (!isGSM7(payload.content.message)) {
      throw new Error('SMS content contains non-GSM-7 characters');
    }
    
    if (payload.content.message.length > 1200) {
      throw new Error(`SMS content exceeds 1200 character limit (${payload.content.message.length} chars). Please shorten your message.`);
    }
    
    return this.sendIndividualMessage(accountId, payload);
  }
}
```

#### 2. Create SMS Service Handler
```typescript
// lib/services/sms-handler.ts
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

#### 3. Update Message Sending Function
```typescript
// lib/messaging/send-message.ts
export async function sendResponseMessage({
  text,
  from,
  threadType,
  recipientId,
  threadId,
  service = 'whatsapp', // Default to WhatsApp for backward compatibility
  chatId,
  adapter,
}: SendMessageParams) {
  if (service === 'sms') {
    // Validate SMS content
    const validation = SMSHandler.validateSMSContent(text);
    
    if (!validation.valid) {
      // Log the error and return early
      console.error(`[SMS Send Error] ${validation.error}`);
      
      // Store failed attempt in database
      await adapter.storeMessage({
        chatId,
        senderId: agentSenderId,
        messageId: generateMessageId('sms-failed', chatId),
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
    
    // Send validated SMS
    const smsPayload: SendSMSPayload = {
      content: { message: SMSHandler.sanitizeForSMS(text) },
      from,
      to: recipientId,
      service: 'sms',
      type: 'individual',
    };
    
    await client.sendSMS(process.env.A1BASE_ACCOUNT_ID!, smsPayload);
    
    // Store in database
    await adapter.storeMessage({
      chatId,
      senderId: agentSenderId,
      messageId: generateMessageId('sms', chatId),
      messageType: 'text',
      service: 'sms',
      content: { text: SMSHandler.sanitizeForSMS(text) },
    });
  } else {
    // Existing WhatsApp logic
    // ... existing code ...
  }
}
```

## Receiving SMS

### Implementation Steps

#### 1. Create SMS Webhook Endpoint
```typescript
// app/api/a1base/sms/route.ts
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-timestamp');
    const receivedSig = req.headers.get('x-signature');
    
    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, timestamp, receivedSig)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
    
    // Check timestamp to prevent replay attacks (5 minute window)
    if (!isTimestampValid(timestamp)) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 403 });
    }
    
    // Parse and process SMS
    const payload = JSON.parse(rawBody);
    await processSMSWebhook(payload);
    
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('[SMS Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

#### 2. Implement Webhook Security
```typescript
// lib/security/webhook-verification.ts
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
  
  // Reject if older than 5 minutes
  return timeDiff >= 0 && timeDiff <= 300;
}
```

#### 3. Process SMS Webhook
```typescript
// lib/webhooks/sms-processor.ts
interface SMSWebhookPayload {
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
  message_content: string;
  direction: 'inbound';
}

export async function processSMSWebhook(payload: SMSWebhookPayload) {
  console.log('[SMS Webhook] Processing:', payload.message_id);
  
  // Skip if from agent
  if (payload.is_from_agent) {
    console.log('[SMS Webhook] Skipping agent message');
    return;
  }
  
  // Transform to unified format
  const unifiedPayload = {
    message_id: payload.message_id,
    thread_id: payload.thread_id,
    thread_type: payload.thread_type,
    sender_number: payload.sender_number,
    sender_name: payload.sender_name,
    message_content: { text: payload.message_content },
    message_type: payload.message_type,
    timestamp: new Date(payload.timestamp).toISOString(),
    service: 'sms' as const,
  };
  
  // Use existing message processing pipeline
  await processWebhookPayload(unifiedPayload);
}
```

## Status Webhooks

### Implementation
```typescript
// lib/webhooks/status-processor.ts
interface StatusWebhookPayload {
  event: 'message_status';
  message_id: string;
  service: 'sms';
  to: string;
  from: string;
  body: string;
  status: 'sent' | 'delivered' | 'failed';
  direction: 'outbound';
}

export async function processStatusWebhook(payload: StatusWebhookPayload) {
  const adapter = getInitializedAdapter();
  
  // Update message status in database
  await adapter.updateMessageStatus({
    messageId: payload.message_id,
    status: payload.status,
    updatedAt: new Date().toISOString(),
  });
  
  // Log for monitoring
  console.log(`[SMS Status] Message ${payload.message_id} status: ${payload.status}`);
  
  // Handle failed messages
  if (payload.status === 'failed') {
    await handleFailedSMS(payload);
  }
}
```

## Database Schema Updates

### New Columns Needed

```sql
-- Add service column to messages table if not exists
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS service VARCHAR(20) DEFAULT 'whatsapp';

-- Add index for service-based queries
CREATE INDEX IF NOT EXISTS idx_messages_service ON messages(service);

-- Add message status tracking
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP;
```

## System Prompt Updates

### SMS-Aware System Prompt Addition
When the service is SMS, append this to the system prompt:

```typescript
// lib/services/prompt-builder.ts
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

// Usage in OpenAI call
const systemPrompt = buildSystemPrompt(originalSystemPrompt, service);
```

### Update Agent Response Generation
```typescript
// lib/services/openai.ts
export async function generateAgentResponse({
  messages,
  systemPrompt,
  service,
  // ... other params
}) {
  // Add SMS context to system prompt
  const contextualPrompt = buildSystemPrompt(systemPrompt, service);
  
  // Add service context to messages
  if (service === 'sms') {
    messages.push({
      role: 'system',
      content: 'Remember: This is an SMS conversation. Keep responses short and use only basic characters.'
    });
  }
  
  // Continue with OpenAI call...
}
```

## Integration Points

### 1. Workflow Updates
```typescript
// lib/workflows/base-workflow.ts
export interface WorkflowContext {
  threadMessages: ThreadMessage[];
  thread_type: "individual" | "group";
  thread_id?: string;
  sender_number?: string;
  service: "whatsapp" | "sms" | "web-ui" | "__skip_send";
  chatId?: string;
}
```

### 2. Onboarding Flow Updates
```typescript
// lib/workflows/onboarding-workflow.ts
// Update the onboarding message generation to be SMS-aware
export function createAgenticOnboardingPrompt(
  onboardingFlow: OnboardingFlow,
  existingData?: Record<string, any>,
  service?: string
): string {
  let systemPrompt = onboardingFlow.agenticSettings.systemPrompt;
  
  // Add SMS context if needed
  if (service === 'sms') {
    systemPrompt = buildSystemPrompt(systemPrompt, 'sms');
  }
  
  // ... rest of the function
}
```

### 3. Memory System Updates
- No changes needed - works with unified message format

## Testing Plan

### Unit Tests
1. SMS content validation (GSM-7 charset, length)
2. Message length blocking
3. Webhook signature verification
4. Timestamp validation

### Integration Tests
1. End-to-end SMS sending
2. Webhook processing
3. Long message rejection
4. Status webhook updates

### Test Cases
```typescript
// tests/sms/sms-handler.test.ts
describe('SMSHandler', () => {
  test('validates GSM-7 charset correctly', () => {
    expect(SMSHandler.validateSMSContent('Hello World!').valid).toBe(true);
    expect(SMSHandler.validateSMSContent('Hello 😊').valid).toBe(false);
  });
  
  test('blocks messages over 1200 characters', () => {
    const longMessage = 'A'.repeat(1201);
    const result = SMSHandler.validateSMSContent(longMessage);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
    expect(result.length).toBe(1201);
  });
  
  test('sanitizes Unicode characters', () => {
    const input = 'Hello "world" — it's great…';
    const expected = 'Hello "world" - it\'s great...';
    expect(SMSHandler.sanitizeForSMS(input)).toBe(expected);
  });
});
```

## Migration Strategy

### Phase 1: Infrastructure (Week 1)
1. Deploy webhook endpoints
2. Update database schema
3. Configure webhook URLs in A1Base dashboard

### Phase 2: Core Implementation (Week 2)
1. Implement SMS sending logic with blocking
2. Implement webhook processing
3. Add security verification
4. Update system prompts

### Phase 3: Testing & Rollout (Week 3)
1. Internal testing with test numbers
2. Limited beta with select users
3. Full rollout

### Environment Variables
```env
# Existing
A1BASE_API_KEY=your_api_key
A1BASE_API_SECRET=your_api_secret
A1BASE_ACCOUNT_ID=your_account_id
A1BASE_AGENT_NUMBER=+14154268268

# New for SMS
SMS_WEBHOOK_PATH=/api/a1base/sms
SMS_STATUS_WEBHOOK_PATH=/api/a1base/sms/status
ENABLE_SMS=true
SMS_MAX_LENGTH=1200
```

## Best Practices

1. **Message Formatting**
   - Keep messages conversational and concise
   - Avoid Unicode characters
   - Use sentence case for better readability
   - AI should naturally keep responses short for SMS

2. **Error Handling**
   - Block and log messages exceeding limits
   - Provide clear error messages to users
   - Store failed attempts for debugging

3. **Monitoring**
   - Log all SMS transactions
   - Track blocked messages
   - Monitor webhook processing times

4. **Security**
   - Always verify webhook signatures
   - Implement rate limiting
   - Sanitize user inputs

## Conclusion

This specification provides a comprehensive plan for integrating SMS functionality into the A1Base framework. The implementation maintains backward compatibility while adding robust SMS support with proper security, error handling, and AI awareness of SMS limitations. 