# API Architecture Migration Guide

## Overview

This document outlines the recent API architecture migration for webhook endpoints, moving from a mixed pattern to a service-aligned structure.

## New Architecture

All A1Base webhooks are now organized under `/api/a1base/`:

```
app/api/a1base/
├── messaging/route.ts    # WhatsApp, SMS, RCS, iMessage
└── email/route.ts        # Email only
```

## Old vs New Endpoints

| Service | Old Endpoint | New Endpoint | Status |
|---------|--------------|--------------|--------|
| WhatsApp/SMS/etc | `/api/messaging/incoming` | `/api/a1base/messaging` | ✅ Migrated with redirect |
| WhatsApp (legacy) | `/api/whatsapp/incoming` | `/api/a1base/messaging` | ✅ Migrated with redirect |
| Email | `/api/webhook/a1mail` | `/api/a1base/email` | ✅ Migrated with redirect |

## Key Benefits

1. **Service-Aligned**: Matches A1Base's webhook organization
2. **Clean URLs**: `POST /api/a1base/messaging` is cleaner than scattered endpoints
3. **Provider-Centric**: Makes it clear these are A1Base integrations
4. **Scalable**: Easy to add more providers (e.g., `/api/twilio/sms`)

## Migration Details

### Backward Compatibility

All old endpoints have been converted to redirects:

```typescript
// app/api/messaging/incoming/route.ts
export { POST } from "@/app/api/a1base/messaging/route";
```

### Updated Imports

All TypeScript imports have been updated:

```typescript
// Before
import { WebhookPayload } from "@/app/api/messaging/incoming/route";

// After
import { WebhookPayload } from "@/app/api/a1base/messaging/route";
```

### Multi-Service Support

The messaging endpoint now supports multiple services:

```typescript
switch (body.service?.toLowerCase()) {
  case 'whatsapp':
    await handleWhatsAppIncoming(body);
    break;
  case 'sms':
  case 'rcs':
  case 'imessage':
    // Future implementation
    break;
}
```

## Webhook Configuration

When configuring webhooks in A1Base:

- **Messaging Webhook**: `https://your-domain.com/api/a1base/messaging`
- **Email Webhook**: `https://your-domain.com/api/a1base/email`

## Testing

The test script has been updated:

```bash
# Test email webhook
node scripts/test-email-webhook.js http://localhost:3006/api/a1base/email
```

## Future Considerations

1. The old endpoints will continue to work via redirects
2. Consider removing redirects after all webhook configurations are updated
3. Documentation (README, guides) should be updated to reflect new endpoints
4. Monitor logs to ensure smooth transition 