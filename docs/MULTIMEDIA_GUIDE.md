# Multimedia Messaging Guide

This guide explains how to send and receive multimedia messages through the WhatsApp integration using the A1Base API.

## Table of Contents
- [Overview](#overview)
- [Supported Media Types](#supported-media-types)
- [Sending Multimedia Messages](#sending-multimedia-messages)
- [Receiving Multimedia Messages](#receiving-multimedia-messages)
- [API Endpoints](#api-endpoints)
- [Workflow Examples](#workflow-examples)
- [Best Practices](#best-practices)

## Overview

The framework now supports sending and receiving various types of multimedia content through WhatsApp, including:
- Images
- Videos
- Audio messages
- Documents
- Location data

## Supported Media Types

### Media Type Specifications

| Media Type | Max Size | Supported Formats |
|------------|----------|-------------------|
| Image | 5MB | JPG, PNG, GIF, WEBP |
| Video | 16MB | MP4, 3GP |
| Audio | 16MB | MP3, OGG, AMR, AAC |
| Document | 100MB | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX |

## Sending Multimedia Messages

### Using the Multimedia Handler

```typescript
import { sendMultimediaMessage } from "@/lib/messaging/multimedia-handler";

// Send an image
await sendMultimediaMessage(
  client,
  accountId,
  'individual', // or 'group'
  recipientPhoneNumber,
  'https://example.com/image.jpg',
  'image',
  'Optional caption for the image'
);
```

### Using the API Endpoint

Send a POST request to `/api/messaging/send-media`:

```json
{
  "threadType": "individual",
  "recipientId": "+1234567890",
  "mediaUrl": "https://example.com/image.jpg",
  "mediaType": "image",
  "caption": "Check out this product!"
}
```

### Using Workflow Functions

```typescript
import { SendProductImage } from "@/lib/workflows/multimedia-workflow";

// Send a product image
await SendProductImage(
  threadMessages,
  "https://example.com/product.jpg",
  "Amazing Product",
  "This product has incredible features...",
  "individual",
  undefined,
  "+1234567890"
);
```

## Receiving Multimedia Messages

When a multimedia message is received through the webhook, it will be processed automatically:

### Webhook Payload Structure

```json
{
  "thread_id": "chat_123456789",
  "message_id": "msg_987654321",
  "thread_type": "individual",
  "sender_number": "+1234567890",
  "sender_name": "John Doe",
  "message_type": "image",
  "message_content": {
    "data": "base64_encoded_image_data"
  }
}
```

### Processing Different Media Types

The system automatically processes incoming media and converts it to a text representation for the AI to understand:

- **Images**: `[Image received: caption if provided]`
- **Videos**: `[Video received: caption if provided]`
- **Audio**: `[Audio received]`
- **Documents**: `[Document received: filename]`
- **Location**: `[Location shared: name at latitude, longitude]`

## API Endpoints

### Send Media Message
`POST /api/messaging/send-media`

Request body:
```json
{
  "threadType": "individual" | "group",
  "recipientId": "phone_number or thread_id",
  "mediaUrl": "https://example.com/media.jpg",
  "mediaType": "image" | "video" | "audio" | "document",
  "caption": "optional caption"
}
```

## Workflow Examples

### 1. Send Product Gallery

```typescript
import { SendImageGallery } from "@/lib/workflows/multimedia-workflow";

const productImages = [
  { url: "https://example.com/product1.jpg", caption: "Front view" },
  { url: "https://example.com/product2.jpg", caption: "Side view" },
  { url: "https://example.com/product3.jpg", caption: "Back view" }
];

await SendImageGallery(
  threadMessages,
  productImages,
  "Product Gallery",
  "individual",
  undefined,
  "+1234567890"
);
```

### 2. Send Tutorial Video

```typescript
import { SendVideoTutorial } from "@/lib/workflows/multimedia-workflow";

await SendVideoTutorial(
  threadMessages,
  "https://example.com/tutorial.mp4",
  "How to use our product",
  "individual",
  undefined,
  "+1234567890"
);
```

### 3. Send Document

```typescript
import { SendDocument } from "@/lib/workflows/multimedia-workflow";

await SendDocument(
  threadMessages,
  "https://example.com/manual.pdf",
  "User Manual",
  "individual",
  undefined,
  "+1234567890",
  "Complete guide for using our product"
);
```

## Best Practices

### 1. Media URL Requirements
- URLs must be publicly accessible
- Use HTTPS URLs for security
- Ensure proper CORS headers if hosting media

### 2. File Size Optimization
- Compress images before uploading
- Use appropriate video codecs for smaller file sizes
- Consider using thumbnails for previews

### 3. Error Handling
```typescript
try {
  await sendMultimediaMessage(...);
} catch (error) {
  if (error.message.includes('not accessible')) {
    // Handle inaccessible URL
  } else if (error.message.includes('size limit')) {
    // Handle file too large
  }
}
```

### 4. Caption Best Practices
- Keep captions concise and informative
- Use captions to provide context
- Include call-to-actions when appropriate

### 5. Media Validation
Always validate media URLs before sending:

```typescript
import { validateMediaUrl } from "@/lib/messaging/multimedia-handler";

const isValid = await validateMediaUrl(mediaUrl);
if (!isValid) {
  // Handle invalid URL
}
```

## Integration with AI Responses

The AI can be prompted to suggest sending media in response to user queries:

```typescript
// In your AI prompt
"If the user asks about a product, suggest sending product images using the SendProductImage workflow."
```

## Troubleshooting

### Common Issues

1. **Media not sending**
   - Check if URL is publicly accessible
   - Verify media type is correct
   - Ensure file size is within limits

2. **Webhook not receiving media**
   - Verify webhook URL is configured correctly
   - Check webhook signature validation
   - Ensure proper handling of base64 data

3. **AI not understanding media context**
   - Check if media is being processed into text representation
   - Verify the processIncomingMediaMessage function is working
   - Ensure message content is being passed to AI

## Security Considerations

1. **URL Validation**: Always validate media URLs before sending
2. **File Type Verification**: Ensure media types match expected formats
3. **Size Limits**: Enforce size limits to prevent abuse
4. **Access Control**: Implement proper authentication for media endpoints
5. **Content Moderation**: Consider implementing content scanning for uploaded media 