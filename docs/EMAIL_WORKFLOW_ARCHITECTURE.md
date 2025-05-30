# Email Workflow Architecture

This document explains the architecture and file structure of the email workflow system in A1Framework.

## 📁 File Structure

The email functionality is organized into dedicated modules for better maintainability:

### Core Email Files

1. **`lib/workflows/email_workflow.ts`** - Main email workflow functions
   - `GenerateEmailResponse()` - Generates professional email responses
   - `ConstructEmail()` - Creates email drafts from conversations
   - `SendEmailFromAgent()` - Sends emails via A1Base API
   - `CreateEmailAddress()` - Creates new email addresses

2. **`lib/workflows/email_workflow_prompt.js`** - Email-specific prompts
   - Professional email response templates
   - Email formatting guidelines
   - Context-aware email generation prompts

3. **`lib/ai-triage/handle-email-incoming.ts`** - Email webhook handler
   - Processes incoming emails from A1Mail webhooks
   - Extracts email content from raw data
   - Manages email threads and conversation context
   - Triggers AI responses

4. **`app/api/webhook/a1mail/route.ts`** - Webhook endpoint
   - Receives email webhooks from A1Mail
   - Validates webhook payloads
   - Routes to email handler

## 🔄 Email Processing Flow

1. **Incoming Email** → A1Mail receives email → Webhook triggered
2. **Webhook Processing** → `route.ts` validates → `handle-email-incoming.ts` processes
3. **AI Response** → `GenerateEmailResponse()` creates professional reply
4. **Send Email** → `SendEmailFromAgent()` sends via A1Base API
5. **Store Response** → Email thread updated in database

## 💾 Database Schema

The email system uses dedicated tables:

- **`email_threads`** - Conversation threads
- **`email_messages`** - Individual emails
- **Database functions** for thread management

See `supabase-email-schema.sql` for complete schema.

## 🎯 Key Features

### Professional Email Responses
The system generates properly formatted business emails with:
- Appropriate greetings and closings
- Professional tone and language
- Proper email structure
- Context-aware responses

### Thread Management
- Groups related emails into conversations
- Maintains conversation context
- Tracks email history

### Error Handling
- Validates email data
- Handles API errors gracefully
- Sends error notifications when needed

## 🛠️ Configuration

Required environment variables:
```bash
A1BASE_API_KEY=your_api_key
A1BASE_API_SECRET=your_api_secret
A1BASE_ACCOUNT_ID=your_account_id
A1BASE_AGENT_EMAIL=agent@a1send.com
```

## 📝 Usage Example

```typescript
import { SendEmailFromAgent } from "@/lib/workflows/email_workflow";

// Send an email
await SendEmailFromAgent({
  subject: "Meeting Confirmation",
  body: "Dear Client,\n\nI'm confirming our meeting...",
  recipient_address: "client@example.com"
});
```

## 🔧 Customization

To customize email responses:

1. Edit prompts in `email_workflow_prompt.js`
2. Modify the `GenerateEmailResponse` function for different formatting
3. Add new email templates as needed

## 🚀 Best Practices

1. **Always use `GenerateEmailResponse`** for AI-generated emails
2. **Trim email addresses** to avoid whitespace issues  
3. **Handle errors gracefully** with appropriate fallbacks
4. **Test with real email providers** to ensure deliverability

## 📚 Related Documentation

- [Email Webhook Guide](./EMAIL_WEBHOOK_GUIDE.md) - Setup instructions
- [API Reference](../README.md) - General API documentation 