# A1Cron Integration Guide

## Overview

A1Cron is A1Base's powerful cron job management system that enables you to schedule and automate HTTP requests. This integration allows you to create, manage, and monitor scheduled tasks directly from your application.

## Features

- Schedule HTTP requests at specific intervals (hourly, daily, weekly, monthly)
- Automatic retry configuration for failed requests
- Webhook callbacks for job execution results
- Timezone support with automatic DST handling
- Job tagging for easy organization
- Execution logs and monitoring

## Setup

The A1Cron integration uses your existing A1Base credentials:

```env
A1BASE_API_KEY=your-api-key
A1BASE_API_SECRET=your-api-secret
A1BASE_ACCOUNT_ID=your-account-id
```

## Usage

### Import the Service

```typescript
import { getA1Cron } from '@/lib/a1cron';

const a1cron = getA1Cron();
```

### Create a Daily Cron Job

```typescript
const dailyJob = await a1cron.createDailyCronJob({
  name: 'Daily Sales Report',
  description: 'Generate daily sales report at 9 AM',
  endpoint_url: 'https://your-app.com/api/reports/daily',
  time: '09:00',
  timezone: 'America/New_York',
  headers: {
    'Authorization': 'Bearer your-token'
  },
  callbacks: {
    success_url: 'https://your-app.com/api/a1base/cron-webhook',
    failure_url: 'https://your-app.com/api/a1base/cron-webhook'
  },
  tags: ['reports', 'daily']
});
```

### Create an Hourly Cron Job

```typescript
const hourlyJob = await a1cron.createHourlyCronJob({
  name: 'API Health Check',
  endpoint_url: 'https://your-app.com/api/health',
  repeat_every: 1, // Every hour
  time: '00:00', // At the top of the hour
  timezone: 'UTC',
  retry_config: {
    max_retries: 3,
    retry_delay_seconds: 60,
    timeout_seconds: 30
  }
});
```

### Create a Custom Schedule

```typescript
const customJob = await a1cron.createCronJob({
  name: 'Weekly Team Summary',
  endpoint_url: 'https://your-app.com/api/team/summary',
  method: 'POST',
  timezone: 'America/Chicago',
  schedule_config: {
    repeat_type: 'weeks',
    repeat_every: 1,
    time: '17:00',
    days_of_week: ['1', '2', '3', '4', '5'], // Monday-Friday
    end_type: 'never'
  },
  body: JSON.stringify({ format: 'detailed' })
});
```

### List All Cron Jobs

```typescript
const jobs = await a1cron.listCronJobs({
  is_active: true,
  tags: ['reports'],
  limit: 10
});

jobs.data.forEach(job => {
  console.log(`${job.name}: Next run at ${job.next_run_at}`);
});
```

### Update a Cron Job

```typescript
await a1cron.updateCronJob(jobId, {
  is_active: false, // Pause the job
  schedule_config: {
    repeat_type: 'days',
    repeat_every: 2, // Change to every 2 days
    time: '10:00'
  }
});
```

### Manually Trigger a Job

```typescript
const result = await a1cron.triggerCronJob(jobId);
console.log(`Job executed with status: ${result.data.status}`);
```

### Get Execution Logs

```typescript
const logs = await a1cron.getExecutionLogs(jobId, {
  limit: 20,
  status: 'failure' // Only show failures
});
```

### Delete a Cron Job

```typescript
await a1cron.deleteCronJob(jobId);
```

## Webhook Handler

The integration includes a webhook handler at `/api/a1base/cron-webhook` that receives callbacks when jobs execute:

```typescript
// app/api/a1base/cron-webhook/route.ts
export async function POST(request: Request) {
  const payload = await request.json() as CronWebhookPayload;
  
  if (payload.status === 'success') {
    // Handle successful execution
  } else {
    // Handle failed execution
    console.error(`Job ${payload.cron_job_id} failed:`, payload.error_message);
  }
}
```

## Testing

Use the included test script to interact with A1Cron:

```bash
# List all cron jobs
node scripts/test-a1cron.js list

# Create a test job
node scripts/test-a1cron.js create

# Manually trigger a job
node scripts/test-a1cron.js trigger <job-id>

# Delete a job
node scripts/test-a1cron.js delete <job-id>
```

## Schedule Types

### Hourly
```typescript
schedule_config: {
  repeat_type: 'hourly',
  repeat_every: 2, // Every 2 hours
  time: '00:30' // 30 minutes past the hour
}
```

### Daily
```typescript
schedule_config: {
  repeat_type: 'days',
  repeat_every: 1, // Every day
  time: '09:00' // 9 AM
}
```

### Weekly
```typescript
schedule_config: {
  repeat_type: 'weeks',
  repeat_every: 1, // Every week
  time: '08:00',
  days_of_week: ['1', '3', '5'] // Mon, Wed, Fri
}
```

### Monthly
```typescript
schedule_config: {
  repeat_type: 'months',
  repeat_every: 1, // Every month
  time: '00:00' // Midnight on the 1st
}
```

## Best Practices

1. **Use Descriptive Names**: Make job names clear and searchable
2. **Set Appropriate Timeouts**: Configure timeout_seconds based on expected endpoint response time
3. **Use Tags**: Organize jobs with tags like 'production', 'reports', 'maintenance'
4. **Configure Callbacks**: Set up webhook URLs to monitor job execution
5. **Test First**: Use manual trigger to test jobs before enabling scheduled execution
6. **Handle Failures**: Implement proper error handling in your webhook callbacks

## Rate Limits

- Maximum 100 active cron jobs per account
- Minimum interval of 1 hour for hourly jobs
- API rate limit: 1000 requests per hour

## Troubleshooting

### Job Not Running
- Verify `is_active` is true
- Check timezone settings
- Ensure endpoint is publicly accessible
- Review execution logs for errors

### Authentication Errors
- Verify A1BASE credentials in environment variables
- Check API key and secret are correct

### Timeout Issues
- Increase `timeout_seconds` in retry configuration
- Optimize endpoint for faster response
- Consider breaking long-running tasks into smaller jobs 