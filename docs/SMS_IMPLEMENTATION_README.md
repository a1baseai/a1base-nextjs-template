# SMS Implementation for A1Base Framework

## Overview
This implementation adds full SMS support to the A1Base messaging framework, allowing the AI agent to communicate via SMS with the same features as WhatsApp, with appropriate SMS-specific constraints.

## Key Features

### ✅ SMS Sending & Receiving
- Send and receive SMS messages through A1Base API
- Automatic character limit enforcement (1200 chars max)
- GSM-7 character validation and Unicode sanitization
- Message blocking for oversized content (no splitting)

### 🤖 AI SMS Awareness
- System prompts automatically adjusted for SMS constraints
- AI generates concise responses suitable for SMS
- Smart fallback suggestions for detailed conversations

### 🔐 Security
- HMAC-SHA256 webhook signature verification
- Timestamp validation to prevent replay attacks
- Secure message status tracking

### 📊 Status Tracking
- Real-time delivery status updates (sent/delivered/failed)
- Failed message error logging
- Database storage of all SMS interactions

## Quick Start

### 1. Database Setup

**For New Installations:**
- Use the updated `supabase.sql` file (already includes SMS fields)

**For Existing Installations:**
```sql
-- Run sms-migration.sql in Supabase
```

### 2. Environment Variables
Add to `.env.local`:
```env
# SMS Configuration
ENABLE_SMS=true
SMS_MAX_LENGTH=1200
SMS_WEBHOOK_PATH=/api/a1base/sms
SMS_STATUS_WEBHOOK_PATH=/api/a1base/sms/status
ENABLE_SMS_SIGNATURE_VERIFICATION=true
```

### 3. A1Base Dashboard Setup
Configure webhook URLs:
- SMS Webhook: `https://yourdomain.com/api/a1base/sms`
- Status Webhook: `https://yourdomain.com/api/a1base/sms/status`

## Usage

The SMS integration works seamlessly with existing workflows. The system automatically:

1. **Detects service type** from incoming webhooks
2. **Applies SMS constraints** when service is 'sms'
3. **Validates content** before sending
4. **Blocks oversized messages** with user-friendly errors
5. **Updates AI context** to generate appropriate responses

## Example Flow

1. User sends SMS → A1Base webhook
2. Webhook verified (HMAC signature)
3. Message processed and stored
4. AI generates SMS-aware response
5. Response validated (length/charset)
6. SMS sent or error returned
7. Delivery status tracked

## Testing

Run the test suite:
```bash
npx ts-node tests/sms/test-sms-send.ts
```

## Implementation Files

### Core Components
- `lib/services/sms-handler.ts` - SMS validation and sanitization
- `lib/a1base/extended-client.ts` - Extended A1Base client with SMS support
- `lib/services/prompt-builder.ts` - Service-aware prompt building
- `lib/security/webhook-verification.ts` - HMAC verification

### API Routes
- `app/api/a1base/sms/route.ts` - SMS webhook endpoint
- `app/api/a1base/sms/status/route.ts` - Status webhook endpoint

### Database
- `supabase.sql` - Updated schema with SMS fields
- `sms-migration.sql` - Migration for existing databases

### Documentation
- `SMS_IMPLEMENTATION_SPEC.md` - Detailed technical specification
- `SMS_IMPLEMENTATION_GUIDE.md` - Step-by-step implementation guide
- `SMS_VS_WHATSAPP_REFERENCE.md` - Service comparison reference

## Best Practices

1. **Keep messages concise** - AI is prompted to be brief for SMS
2. **Test character limits** - Use the SMS preview function
3. **Monitor blocked messages** - Check logs for failed sends
4. **Handle errors gracefully** - Provide clear feedback to users

## Limitations

- **No media support** - SMS is text-only
- **No group messaging** - SMS doesn't support group threads
- **Character restrictions** - GSM-7 charset only
- **Length limit** - 1200 characters maximum

## Support

For issues or questions:
1. Check the implementation guide
2. Review test examples
3. Contact A1Base support

---

**Note:** Ensure your A1Base number is SMS-enabled before testing. 