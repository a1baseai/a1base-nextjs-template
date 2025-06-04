# SMS vs WhatsApp Quick Reference

This document provides a quick reference for the key differences between SMS and WhatsApp implementations in the A1Base framework.

## Key Differences

| Feature | WhatsApp | SMS |
|---------|----------|-----|
| **Character Limit** | No practical limit | 1200 chars (GSM-7) |
| **Character Set** | Unicode supported | GSM-7 only |
| **Media Support** | Images, videos, documents | Text only |
| **Webhook Security** | Basic validation | HMAC-SHA256 signature |
| **Message Format** | Rich content object | Plain text string |
| **Delivery Status** | Read receipts | Sent/Delivered/Failed |
| **Threading** | Persistent threads | Phone number based |
| **Cost** | Lower per message | Higher per message |
| **Long Messages** | Supported | Blocked if > 1200 chars |
| **AI Awareness** | Standard prompts | SMS-aware prompts |

## Implementation Differences

### 1. Sending Messages

**WhatsApp:**
```typescript
const payload = {
  content: message, // Can be text, image, etc.
  from: agentNumber,
  to: recipientNumber,
  service: "whatsapp",
  thread_id: threadId // Optional
};
```

**SMS:**
```typescript
const payload = {
  content: { message: text }, // Text only
  from: agentNumber,
  to: recipientNumber,
  service: "sms",
  type: "individual" // Always individual
};
```

### 2. Webhook Payloads

**WhatsApp Webhook:**
```json
{
  "message_id": "msg-123",
  "thread_id": "whatsapp-14155551234-14155555678",
  "sender_number": "+14155551234",
  "message_content": {
    "text": "Hello",
    "media": { /* optional */ }
  },
  "service": "whatsapp"
}
```

**SMS Webhook:**
```json
{
  "message_id": "msg-456",
  "thread_id": "sms-14155551234-14155555678",
  "sender_number": "+14155551234",
  "message_content": "Hello", // Plain string
  "service": "sms",
  "timestamp": 1712067900000 // Unix timestamp
}
```

### 3. Security Headers

**WhatsApp:** Standard webhook headers

**SMS:** Additional security headers
```
x-signature: HMAC-SHA256 signature
x-timestamp: Unix timestamp
```

### 4. Message Processing

**WhatsApp:**
- Direct processing
- No character validation needed
- Supports rich content

**SMS:**
- Character validation required
- Messages > 1200 chars are blocked
- Sanitization for Unicode → GSM-7
- System prompts include SMS limitations

### 5. Error Handling

**WhatsApp:**
```typescript
// Standard error handling
try {
  await sendWhatsAppMessage(content);
} catch (error) {
  console.error('WhatsApp send failed:', error);
}
```

**SMS:**
```typescript
// Validation before sending
const validation = SMSHandler.validateSMSContent(content);
if (!validation.valid) {
  // Log blocked message
  await logBlockedMessage(content, validation.error);
  throw new Error(validation.error);
}
// If valid, send SMS
await sendSMS(sanitizedContent);
```

## Code Patterns

### Handling Service-Specific Logic

```typescript
// In message handlers
if (service === 'sms') {
  // SMS-specific logic
  const sanitized = SMSHandler.sanitizeForSMS(content);
  const validation = SMSHandler.validateSMSContent(sanitized);
  
  if (!validation.valid) {
    // Handle blocked message
    throw new Error(validation.error);
  }
  
  await sendSMS(sanitized);
} else if (service === 'whatsapp') {
  // WhatsApp logic - can send as-is
  await sendWhatsAppMessage(content);
}
```

### System Prompt Updates

```typescript
// Build service-aware prompts
const systemPrompt = buildSystemPrompt(basePrompt, service);

// For SMS, this adds:
// - Character limit awareness
// - ASCII-only character guidance
// - Conciseness requirements
```

### Unified Storage

Both services use the same storage format:
```typescript
{
  chatId: string,
  senderId: string,
  messageId: string,
  messageType: 'text' | 'image' | 'video',
  service: 'whatsapp' | 'sms',
  content: MessageContent,
  status?: 'sent' | 'delivered' | 'failed',
  createdAt: timestamp
}
```

## Best Practices

### For SMS:
1. Always validate GSM-7 charset before sending
2. Block messages exceeding 1200 characters
3. Use SMS-aware system prompts
4. Log blocked messages for analysis
5. Keep AI responses concise

### For WhatsApp:
1. Utilize rich media capabilities
2. Maintain conversation context
3. Use message templates for notifications
4. Handle media upload/download
5. Implement proper error handling for media

## Common Pitfalls

### SMS Pitfalls:
- ❌ Sending Unicode characters without sanitization
- ❌ Not checking message length before sending
- ❌ Ignoring webhook signature verification
- ❌ Not updating system prompts for SMS context
- ❌ Attempting to send media via SMS

### WhatsApp Pitfalls:
- ❌ Not handling media upload failures
- ❌ Ignoring rate limits
- ❌ Not maintaining thread context
- ❌ Missing error handling for unsupported media types

## Testing Considerations

### SMS Testing:
- Test character validation with emojis/Unicode
- Verify messages > 1200 chars are blocked
- Test webhook signature validation
- Verify AI keeps responses short
- Test with international numbers

### WhatsApp Testing:
- Test all media types
- Verify thread persistence
- Test group messaging
- Check rate limit handling
- Test with various file sizes

## Migration Checklist

When adding SMS to existing WhatsApp implementation:

- [ ] Run database migration (sms-migration.sql)
- [ ] Add `service` field handling in code
- [ ] Implement SMS character validation
- [ ] Add webhook security verification
- [ ] Update system prompts with SMS awareness
- [ ] Test both services in parallel
- [ ] Monitor blocked SMS messages
- [ ] Document SMS limitations for users 