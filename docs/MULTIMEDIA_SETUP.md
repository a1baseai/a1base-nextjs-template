# Multimedia Messaging Setup Guide

This guide walks you through setting up multimedia messaging support in your A1Framework deployment.

## Database Setup

### 1. Apply the Multimedia Migration

After setting up your base Supabase tables (from `supabase.sql`), apply the multimedia migration to add support for media messages:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-multimedia.sql`
4. Click "Run" to execute the migration

This migration adds:
- Media-specific columns to the `messages` table
- A `media_files` table for advanced media metadata
- Indexes for efficient media queries
- Helper functions and views for media analytics
- Automatic triggers to extract media information

### 2. Verify the Migration

Run this query to verify the new columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('media_url', 'media_type', 'media_caption', 'media_metadata');
```

You should see all four columns listed.

## Environment Configuration

Ensure your `.env.local` file has all required A1Base credentials:

```env
A1BASE_API_KEY=your_api_key
A1BASE_API_SECRET=your_api_secret
A1BASE_ACCOUNT_ID=your_account_id
A1BASE_AGENT_NUMBER=+1234567890
A1BASE_AGENT_NAME=Your Agent Name
```

## Testing Multimedia Features

### 1. Test Sending Media

Use the API endpoint to send a test image:

```bash
curl -X POST http://localhost:3000/api/messaging/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "threadType": "individual",
    "recipientId": "+1234567890",
    "mediaUrl": "https://via.placeholder.com/150",
    "mediaType": "image",
    "caption": "Test image"
  }'
```

### 2. Test Receiving Media

1. Send an image to your WhatsApp agent number
2. Check the logs to see the processed message
3. Verify the media is stored in the database:

```sql
SELECT * FROM messages 
WHERE media_type IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

## Webhook Configuration

The webhook at `/api/whatsapp/incoming` automatically handles multimedia messages. When a media message is received:

1. The base64 data is processed
2. Media type is identified
3. A text representation is created for the AI
4. The message is stored with media metadata

## Supported Media Formats

### Images
- Formats: JPG, PNG, GIF, WEBP
- Max size: 5MB
- Stored as: base64 data in `rich_content.data`

### Videos
- Formats: MP4, 3GP
- Max size: 16MB
- Stored as: base64 data in `rich_content.data`

### Audio
- Formats: MP3, OGG, AMR, AAC
- Max size: 16MB
- Stored as: base64 data in `rich_content.data`

### Documents
- Formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- Max size: 100MB
- Stored as: base64 data in `rich_content.data`

### Location
- Stored as: coordinates in `rich_content`
- Fields: latitude, longitude, name, address

## Using Media in Workflows

### Send Product Images
```typescript
import { SendProductImage } from "@/lib/workflows/multimedia-workflow";

await SendProductImage(
  threadMessages,
  "https://example.com/product.jpg",
  "Product Name",
  "Product description",
  "individual",
  undefined,
  "+1234567890"
);
```

### Handle Incoming Media
```typescript
import { HandleIncomingMedia } from "@/lib/workflows/multimedia-workflow";

const response = await HandleIncomingMedia(
  threadMessages,
  "image",
  "individual",
  undefined,
  "+1234567890",
  mediaData,
  caption
);
```

## Database Queries

### Get All Media Messages
```sql
SELECT * FROM get_media_messages(NULL, NULL, 100);
```

### Get Media by Type
```sql
SELECT * FROM get_media_messages(NULL, 'image', 50);
```

### Media Statistics
```sql
SELECT * FROM media_message_stats;
```

## Troubleshooting

### Media Not Storing
1. Check that the migration was applied successfully
2. Verify the webhook is receiving the full payload
3. Check logs for any database errors

### Media Not Sending
1. Verify the media URL is publicly accessible
2. Check that the media type is correct
3. Ensure file size is within limits

### AI Not Understanding Media
1. Verify `processIncomingMediaMessage` is being called
2. Check that text representations are being created
3. Review the AI prompt to ensure it handles media context

## Security Considerations

1. **URL Validation**: Always validate media URLs before sending
2. **Size Limits**: Enforce file size limits to prevent abuse
3. **Content Type**: Verify MIME types match expected formats
4. **Access Control**: Use RLS policies to control media access
5. **Storage**: Consider external storage for large media files

## Performance Tips

1. Use the `media_type` index for filtering queries
2. Limit the number of messages retrieved with media
3. Consider archiving old media messages
4. Use pagination for media galleries
5. Implement caching for frequently accessed media

## Next Steps

1. Set up external storage (S3, Cloudinary) for media files
2. Implement media compression and optimization
3. Add content moderation for uploaded media
4. Create analytics dashboards for media usage
5. Implement media search functionality 