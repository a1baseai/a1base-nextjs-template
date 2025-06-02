# Email Status Reports Feature

This feature allows users to receive project status reports via email, either on-demand or on a scheduled basis.

## Features

- **On-Demand Reports**: Users can request an immediate email report of their project status
- **Scheduled Reports**: Users can schedule daily, weekly, or monthly reports
- **Beautiful HTML Email Templates**: Reports are formatted with responsive HTML templates
- **Project Summaries**: Shows active projects, completed projects, tasks, and recent activity
- **Conversation Summaries**: Includes recent chat activity and message counts

## User Commands

### Requesting On-Demand Reports
- "Send me a report now"
- "Email me my project status"
- "I want a report"
- "Send report"

### Scheduling Reports
- "Send me daily reports"
- "Email me weekly updates"
- "I want monthly reports at 9am"
- "Schedule reports every week"

### Canceling Scheduled Reports
- "Stop sending reports"
- "Cancel email reports"
- "Unsubscribe from reports"

## Technical Implementation

### No Database Changes Required

This implementation uses the existing database structure:
- **User metadata**: Stores email addresses, scheduled reports, and report history
- **Existing tables**: Uses `conversation_users`, `projects`, `messages`, and `chats` tables

All report data is stored in the user's metadata field as JSON:
```json
{
  "email": "user@example.com",
  "email_reports": {
    "scheduled": {
      "report_id": { /* scheduled report details */ }
    },
    "history": [ /* last 20 reports */ ]
  }
}
```

### Services

1. **ReportSchedulerService** (`lib/services/report-scheduler.ts`)
   - Manages scheduled reports stored in user metadata
   - Integrates with A1Cron for scheduling
   - Handles report cancellation
   - Logs report history (last 20 entries)

2. **ReportGeneratorService** (`lib/services/report-generator.ts`)
   - Fetches user-specific data from existing tables
   - Generates HTML email content
   - Formats reports with tables and summaries

3. **Email Report Helpers** (`lib/services/email-report-helpers.ts`)
   - Email extraction from messages
   - User email management
   - Time parsing utilities

### API Endpoints

1. **POST /api/reports/trigger-scheduled-report**
   - Called by A1Cron for scheduled reports
   - Requires internal authentication

2. **POST /api/reports/send-on-demand-report**
   - Handles immediate report requests
   - Can be called internally

### NLP Integration

The feature integrates with the existing NLP system through:
- New intent type: `emailReportFlow`
- Report action recognition: `request_on_demand`, `request_scheduled`, `cancel_scheduled`
- Automatic email extraction from user messages

## Required Environment Variables

```env
# A1Base API Credentials
A1BASE_API_KEY=your_a1base_api_key
A1BASE_API_SECRET=your_a1base_api_secret
A1BASE_ACCOUNT_ID=your_a1base_account_id

# A1Base Agent Configuration
A1BASE_AGENT_EMAIL=agent@yourdomain.a1send.com

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
INTERNAL_API_SECRET=your-internal-api-secret
```

## Setup Instructions

1. **Configure Environment Variables**
   - Set all required A1Base credentials
   - Configure the agent email address
   - Set the application URL for A1Cron callbacks

2. **Test the Feature**
   - Send a message: "Send me a project status report"
   - If no email is on file, provide it when prompted
   - Check your inbox for the report

## Email Report Contents

Reports include:

### Summary Section
- Total active projects
- Total completed projects
- Total tasks across all projects
- Total messages sent

### Projects Section
- **Active Projects**: Name, description, task count, last activity
- **Completed Projects**: Name, description, completion time

### Conversations Section
- Recent chat activity
- Message counts per conversation
- Last activity timestamps

## Customization

### Report Templates
Edit `lib/services/report-generator.ts` to customize:
- HTML template styling
- Data included in reports
- Table formatting

### Report Frequency Options
Modify `lib/services/report-scheduler.ts` to add:
- Custom time zones
- Additional frequency options
- Different report types

## Troubleshooting

### Common Issues

1. **"I need to identify you first before I can send reports"**
   - User is not registered in the system
   - Check that the phone number is properly saved

2. **"I'll need your email address to send you reports"**
   - User has no email on file
   - Respond with: "My email is user@example.com"

3. **Reports not being sent**
   - Check A1Cron job status
   - Verify A1Mail configuration
   - Check user metadata for report history

### Debug Commands

Check user's scheduled reports and history:
```javascript
// In your debugging console
const user = await adapter.supabase
  .from('conversation_users')
  .select('metadata')
  .eq('phone_number', 'USER_PHONE')
  .single();

console.log('Scheduled Reports:', user.data?.metadata?.email_reports?.scheduled);
console.log('Report History:', user.data?.metadata?.email_reports?.history);
```

Check if A1Cron job exists:
```javascript
const reports = user.data?.metadata?.email_reports?.scheduled;
Object.values(reports || {}).forEach(report => {
  console.log('Report ID:', report.id);
  console.log('A1Cron Job ID:', report.a1cron_job_id);
  console.log('Is Active:', report.is_active);
  console.log('Last Sent:', report.last_sent_at);
});
```

## Security Considerations

- Internal API endpoints are protected with secret authentication
- User data is scoped to individual users
- Email addresses are stored in user metadata
- A1Cron callbacks are verified
- Report history is limited to last 20 entries to prevent metadata bloat

## Data Structure

### Scheduled Report Object
```typescript
{
  id: string;              // Unique report ID
  a1cron_job_id?: string;  // A1Cron job ID
  email_address: string;   // Recipient email
  report_type: string;     // Type of report
  frequency: 'daily' | 'weekly' | 'monthly';
  scheduled_time?: string; // Time in HH:MM format
  timezone: string;        // User timezone
  last_sent_at?: string;   // ISO timestamp
  is_active: boolean;      // Active status
  created_at: string;      // ISO timestamp
}
```

### Report History Entry
```typescript
{
  type: 'scheduled' | 'on_demand';
  email_address: string;
  subject: string;
  status: 'sent' | 'failed';
  error?: string;
  sent_at: string; // ISO timestamp
} 