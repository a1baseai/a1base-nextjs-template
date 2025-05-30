# Multimedia Messaging Test Plan

This test plan provides step-by-step instructions to verify that multimedia messaging is fully functional in your A1Framework deployment.

## Prerequisites

Before starting the tests:
- [ ] Ensure the base `supabase.sql` has been applied to your database
- [ ] Apply the `supabase-multimedia.sql` migration
- [ ] Configure all environment variables in `.env.local`
- [ ] Start the development server with `npm run dev`
- [ ] Set up ngrok or similar to expose your local server
- [ ] Configure the webhook URL in A1Base dashboard

## Test 1: Database Setup Verification

### 1.1 Verify Migration Applied
Run this SQL query in Supabase SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('media_url', 'media_type', 'media_caption', 'media_metadata');
```

**Expected Result:** 
- 4 rows returned showing all multimedia columns

### 1.2 Verify Media Files Table
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'media_files';
```

**Expected Result:**
- 1 row showing 'media_files' table exists

### 1.3 Verify Functions and Views
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_media_messages', 'extract_media_info');
```

**Expected Result:**
- 2 rows showing both functions exist

## Test 2: Sending Media Messages

### 2.1 Send Image via API
```bash
curl -X POST http://localhost:3000/api/messaging/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "threadType": "individual",
    "recipientId": "+1234567890",
    "mediaUrl": "https://via.placeholder.com/300/09f/fff.png",
    "mediaType": "image",
    "caption": "Test image from API"
  }'
```

**Expected Result:**
- Response: `{"success": true, "message": "Multimedia message sent successfully", ...}`
- WhatsApp recipient receives image with caption

### 2.2 Send Video
```bash
curl -X POST http://localhost:3000/api/messaging/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "threadType": "individual",
    "recipientId": "+1234567890",
    "mediaUrl": "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    "mediaType": "video",
    "caption": "Test video"
  }'
```

**Expected Result:**
- Success response
- Video received on WhatsApp

### 2.3 Send Document
```bash
curl -X POST http://localhost:3000/api/messaging/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "threadType": "individual",
    "recipientId": "+1234567890",
    "mediaUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "mediaType": "document",
    "caption": "Test PDF document"
  }'
```

**Expected Result:**
- Success response
- Document received on WhatsApp

### 2.4 Test Invalid Media URL
```bash
curl -X POST http://localhost:3000/api/messaging/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "threadType": "individual",
    "recipientId": "+1234567890",
    "mediaUrl": "https://invalid-url-that-does-not-exist.com/image.jpg",
    "mediaType": "image",
    "caption": "This should fail"
  }'
```

**Expected Result:**
- Error response: "Media URL is not accessible"

## Test 3: Receiving Media Messages

### 3.1 Send Image to Bot
1. Open WhatsApp
2. Send an image to your bot's WhatsApp number
3. Add caption: "Here is my product photo"

**Expected Result:**
- Check server logs for: `[Image received: Here is my product photo]`
- Bot responds acknowledging the image

### 3.2 Verify Image Storage
```sql
SELECT 
  message_id,
  content,
  message_type,
  media_type,
  media_caption,
  created_at
FROM messages 
WHERE media_type = 'image'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Result:**
- 1 row with media_type = 'image' and caption
- content field shows `[Image received: caption]` instead of base64 data
- Rich media data is stored in rich_content field

### 3.2b Verify Content Field Optimization
```sql
SELECT 
  LENGTH(content) as content_length,
  LENGTH(rich_content::text) as rich_content_length,
  message_type
FROM messages 
WHERE media_type IS NOT NULL
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected Result:**
- content_length should be small (under 100 characters) for media messages
- rich_content_length may be large (contains actual media data)
- This confirms base64 data is not stored in content field

### 3.3 Send Location
1. In WhatsApp, click attachment icon
2. Select "Location"
3. Send current location to bot

**Expected Result:**
- Server logs show: `[Location shared: ...]`
- Bot responds acknowledging location

### 3.4 Send Audio Message
1. In WhatsApp, hold microphone icon
2. Record a voice message
3. Send to bot

**Expected Result:**
- Server logs show: `[Audio received]`
- Bot responds acknowledging audio

## Test 4: Workflow Integration

### 4.1 Test Product Image Workflow
Create a test file `test-multimedia.js`:
```javascript
const { SendProductImage } = require('./lib/workflows/multimedia-workflow');

async function test() {
  await SendProductImage(
    [],
    "https://via.placeholder.com/500",
    "Amazing Product",
    "This product has great features!",
    "individual",
    undefined,
    "+1234567890"
  );
}

test();
```

**Expected Result:**
- Product image sent with formatted caption

### 4.2 Test Image Gallery
```javascript
const { SendImageGallery } = require('./lib/workflows/multimedia-workflow');

async function testGallery() {
  const images = [
    { url: "https://via.placeholder.com/300/f00", caption: "Red" },
    { url: "https://via.placeholder.com/300/0f0", caption: "Green" },
    { url: "https://via.placeholder.com/300/00f", caption: "Blue" }
  ];
  
  await SendImageGallery(
    [],
    images,
    "Color Gallery",
    "individual",
    undefined,
    "+1234567890"
  );
}

testGallery();
```

**Expected Result:**
- Intro message sent
- 3 images sent in sequence with captions

## Test 5: Database Queries

### 5.1 Test Media Analytics Function
```sql
SELECT * FROM get_media_messages(NULL, NULL, 10);
```

**Expected Result:**
- List of recent media messages with details

### 5.2 Test Media Statistics View
```sql
SELECT * FROM media_message_stats;
```

**Expected Result:**
- Summary of media messages by type and chat

### 5.3 Test Media Type Filter
```sql
SELECT * FROM get_media_messages(NULL, 'image', 5);
```

**Expected Result:**
- Only image messages returned

## Test 6: Error Handling

### 6.1 Test Missing Required Fields
```bash
curl -X POST http://localhost:3000/api/messaging/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "threadType": "individual",
    "recipientId": "+1234567890"
  }'
```

**Expected Result:**
- Error: "Missing required fields"

### 6.2 Test Invalid Media Type
```bash
curl -X POST http://localhost:3000/api/messaging/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "threadType": "individual",
    "recipientId": "+1234567890",
    "mediaUrl": "https://example.com/file.xyz",
    "mediaType": "invalid"
  }'
```

**Expected Result:**
- Error: "Invalid mediaType"

## Test 7: AI Context Understanding

### 7.1 Send Image and Ask About It
1. Send an image of a car to the bot
2. Send text: "What do you think about this?"

**Expected Result:**
- Bot's response references receiving an image
- Context is maintained about the media

### 7.2 Mixed Media Conversation
1. Send text: "I need help with my product"
2. Send an image
3. Send text: "This is what it looks like"

**Expected Result:**
- Bot maintains context across text and media messages

### 7.3 Verify AI Context Optimization
After sending several images, check server logs when the bot processes a new message.

**Expected Result:**
- No large base64 strings appear in AI context logs
- Message content shows `[Image received: caption]` format in logs
- AI can still understand the conversation context

## Test 8: Performance Tests

### 8.1 Large Media Query
```sql
-- Insert test data first if needed
SELECT COUNT(*) FROM messages WHERE media_type IS NOT NULL;
```

**Expected Result:**
- Query executes quickly due to index

### 8.2 Concurrent Media Sends
Run multiple curl commands simultaneously to test concurrent sends.

**Expected Result:**
- All messages sent successfully
- No race conditions

## Test Checklist Summary

- [ ] Database migration verified
- [ ] API endpoint sends images successfully
- [ ] API endpoint sends videos successfully
- [ ] API endpoint sends documents successfully
- [ ] Invalid URLs are rejected
- [ ] Bot receives and processes images
- [ ] Bot receives and processes locations
- [ ] Bot receives and processes audio
- [ ] Media is stored correctly in database
- [ ] Content field uses placeholders instead of base64 data
- [ ] AI context doesn't include large base64 strings
- [ ] Workflow functions work correctly
- [ ] Database queries return expected results
- [ ] Error handling works as expected
- [ ] AI maintains context with media
- [ ] Performance is acceptable

## Troubleshooting Guide

### Issue: Media not sending
1. Check A1Base API credentials
2. Verify media URL is publicly accessible
3. Check server logs for errors
4. Verify webhook is configured

### Issue: Media not storing
1. Check database migration was applied
2. Look for errors in server logs
3. Verify Supabase connection
4. Check message in database directly

### Issue: AI not understanding media
1. Check `processIncomingMediaMessage` is being called
2. Verify text representation is created
3. Check AI prompt includes media context
4. Review server logs for processing errors

## Success Criteria

The multimedia messaging feature is considered fully functional when:
1. All test cases pass successfully
2. Media can be sent and received reliably
3. Database stores media information correctly
4. AI understands and responds to media context
5. Error handling prevents system failures
6. Performance meets acceptable standards 