# Email Webhook Integration Guide

This guide explains how to set up and use the A1Mail email webhook integration to receive and automatically respond to emails.

## Overview

The email webhook integration allows your A1Base agent to:
- Receive incoming emails via webhook
- Process email content using AI
- Automatically send responses
- Maintain conversation history

## Setup Instructions

### 1. Configure Email Webhook URL

In your A1Mail dashboard:
1. Navigate to Email Settings
2. Find your email address and click "Configure Webhook"
3. Enter your webhook URL: `https://your-domain.com/api/webhook/a1mail`
4. Save the configuration

### 2. Set Environment Variables

Ensure your `.env` file includes:
```bash
# A1Base Email Configuration
A1BASE_AGENT_EMAIL=your-agent@a1send.com
```

### 3. Test the Integration

1. Send a test email to your A1Base email address
2. Check your server logs for webhook receipt
3. Verify the AI response is sent back

## How It Works

### Webhook Payload

When an email is received, A1Mail sends a POST request to your webhook with:

```json
{
  "email_id": "unique-email-id",
  "subject": "Email Subject",
  "sender_address": "sender@example.com",
  "recipient_address": "your-agent@a1send.com",
  "timestamp": "2025-03-19T10:24:08.46083+00:00",
  "service": "email",
  "raw_email_data": "Full email content with headers"
}
```

### Processing Flow

1. **Webhook Receipt**: The endpoint at `/api/webhook/a1mail` receives the email
2. **Content Extraction**: The system extracts the email body from raw email data
3. **Thread Management**: Creates or retrieves an email conversation thread
4. **AI Processing**: Generates a contextual response using your AI configuration
5. **Response Sending**: Automatically sends the reply via A1Mail API

### Features

- **Conversation Threading**: Maintains context across email exchanges with the same sender
- **Smart Subject Lines**: Automatically adds "Re:" to response subjects
- **Error Handling**: Sends error notifications if processing fails
- **Database Storage**: Stores email history for context (if Supabase is configured)

## Database Schema

The email integration uses dedicated tables for better organization and performance:

### Email Tables

1. **email_threads** - Groups related emails into conversations
   - `sender_email` - Original sender's email address
   - `recipient_email` - Original recipient's email address
   - `subject` - Initial email subject
   - `updated_at` - Last activity timestamp

2. **email_messages** - Stores individual emails
   - `thread_id` - Links to email_threads
   - `email_id` - Unique identifier from webhook
   - `direction` - 'inbound' or 'outbound'
   - `from_address` / `to_address` - Email addresses
   - `subject` - Email subject line
   - `body_text` - Plain text content
   - `raw_email` - Complete raw email data
   - `is_replied` - Tracks if email has been responded to

3. **email_attachments** - For future attachment support
   - Prepared structure for handling file attachments

### Setting Up the Database

To use the email-specific tables, run the migration:

```sql
-- Run the migration in your Supabase SQL editor
-- File: supabase-email-schema.sql
```

This creates:
- Dedicated email storage tables
- Automatic thread management functions
- Email search capabilities
- Conversation tracking views

## Customization

### Response Style

The email responses use the same AI prompt configuration as your messaging responses. To customize email-specific behavior, you can:

1. Add conditional logic in your AI prompts based on the service type
2. Create custom workflows for email-specific actions
3. Implement email parsing for structured data extraction

### Email Body Extraction

The system includes basic email parsing that handles:
- Plain text emails
- HTML emails (with basic tag stripping)
- Multi-part MIME messages

For advanced parsing needs, you may want to integrate a dedicated email parsing library.

## Troubleshooting

### Common Issues

1. **Webhook not receiving emails**
   - Verify webhook URL is correctly configured in A1Mail dashboard
   - Check server is accessible from internet
   - Review firewall/security settings

2. **Emails not sending**
   - Confirm A1BASE_AGENT_EMAIL is set correctly
   - Check A1Base API credentials are valid
   - Verify sender email is authorized in A1Base

3. **Poor email parsing**
   - The built-in parser handles basic formats
   - Complex HTML or attachments may need additional handling
   - Check logs for parsing errors

### Debug Mode

Enable detailed logging by checking the console output for:
- `[EMAIL-WEBHOOK]` - Webhook receipt logs
- `[EmailHandler]` - Processing logs
- `[ExtractEmailBody]` - Email parsing logs

## Best Practices

1. **Rate Limiting**: Implement rate limiting to prevent abuse
2. **Validation**: Validate webhook payloads to ensure they're from A1Mail
3. **Monitoring**: Set up monitoring for failed email processing
4. **Backup**: Consider storing raw email data for debugging

## Next Steps

- Set up custom email templates for specific response types
- Implement attachment handling
- Add email classification workflows
- Create email-to-task conversion workflows 