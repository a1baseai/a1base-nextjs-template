/**
 * A1Cron Examples
 * 
 * Example use cases for scheduling automated tasks with A1Cron
 */

import { getA1Cron } from './service';
import { CronJob } from './types';

/**
 * Example: Schedule daily summary reports
 * Sends a daily summary of conversations and metrics
 */
export async function scheduleDailySummaryReport(
  webhookUrl: string,
  timezone: string = 'America/New_York'
): Promise<CronJob> {
  const a1cron = getA1Cron();
  
  const job = await a1cron.createDailyCronJob({
    name: 'Daily Conversation Summary',
    description: 'Generate and send daily summary of all conversations',
    endpoint_url: `${webhookUrl}/api/reports/daily-summary`,
    time: '09:00', // 9 AM
    timezone,
    method: 'POST',
    body: JSON.stringify({
      includeMetrics: true,
      includeTrends: true,
      format: 'detailed'
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': process.env.CRON_SECRET || 'your-secret'
    },
    retry_config: {
      max_retries: 3,
      retry_delay_seconds: 300, // 5 minutes
      timeout_seconds: 60
    },
    callbacks: {
      success_url: `${webhookUrl}/api/a1base/cron-webhook`,
      failure_url: `${webhookUrl}/api/a1base/cron-webhook`
    },
    tags: ['reports', 'daily', 'summary']
  });
  
  console.log(`Created daily summary job: ${job.data.id}`);
  return job.data;
}

/**
 * Example: Schedule hourly database cleanup
 * Removes old messages and optimizes storage
 */
export async function scheduleHourlyCleanup(
  webhookUrl: string
): Promise<CronJob> {
  const a1cron = getA1Cron();
  
  const job = await a1cron.createHourlyCronJob({
    name: 'Database Cleanup',
    description: 'Clean up old messages and optimize database',
    endpoint_url: `${webhookUrl}/api/maintenance/cleanup`,
    repeat_every: 1, // Every hour
    time: '00:30', // 30 minutes past the hour
    timezone: 'UTC',
    method: 'POST',
    body: JSON.stringify({
      deleteOlderThan: 30, // days
      optimizeTables: true,
      vacuum: true
    }),
    retry_config: {
      max_retries: 2,
      retry_delay_seconds: 60,
      timeout_seconds: 300 // 5 minutes for cleanup
    },
    tags: ['maintenance', 'cleanup', 'database']
  });
  
  console.log(`Created hourly cleanup job: ${job.data.id}`);
  return job.data;
}

/**
 * Example: Schedule weekly team performance reports
 * Sends performance metrics every Monday morning
 */
export async function scheduleWeeklyTeamReport(
  webhookUrl: string,
  teamEmails: string[]
): Promise<CronJob> {
  const a1cron = getA1Cron();
  
  const job = await a1cron.createCronJob({
    name: 'Weekly Team Performance Report',
    description: 'Send team performance metrics every Monday',
    endpoint_url: `${webhookUrl}/api/reports/team-performance`,
    method: 'POST',
    timezone: 'America/New_York',
    schedule_config: {
      repeat_type: 'weeks',
      repeat_every: 1,
      time: '08:00', // 8 AM
      days_of_week: ['1'], // Monday only
      end_type: 'never'
    },
    body: JSON.stringify({
      recipients: teamEmails,
      metrics: ['response_time', 'resolution_rate', 'satisfaction_score'],
      period: 'last_week',
      includeCharts: true
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    retry_config: {
      max_retries: 3,
      retry_delay_seconds: 600, // 10 minutes
      timeout_seconds: 120
    },
    callbacks: {
      success_url: `${webhookUrl}/api/a1base/cron-webhook`,
      failure_url: `${webhookUrl}/api/a1base/cron-webhook`
    },
    tags: ['reports', 'weekly', 'team', 'performance']
  });
  
  console.log(`Created weekly team report job: ${job.data.id}`);
  return job.data;
}

/**
 * Example: Schedule monthly billing reminders
 * Sends billing reminders on the 25th of each month
 */
export async function scheduleMonthlyBillingReminder(
  webhookUrl: string
): Promise<CronJob> {
  const a1cron = getA1Cron();
  
  const job = await a1cron.createCronJob({
    name: 'Monthly Billing Reminder',
    description: 'Send billing reminders on the 25th of each month',
    endpoint_url: `${webhookUrl}/api/billing/send-reminders`,
    method: 'POST',
    timezone: 'America/New_York',
    schedule_config: {
      repeat_type: 'months',
      repeat_every: 1,
      time: '10:00', // 10 AM on the 1st
      end_type: 'never'
    },
    body: JSON.stringify({
      daysBeforeDue: 5,
      includeInvoice: true,
      sendToOverdue: true
    }),
    retry_config: {
      max_retries: 5,
      retry_delay_seconds: 1800, // 30 minutes
      timeout_seconds: 180
    },
    tags: ['billing', 'monthly', 'reminders']
  });
  
  console.log(`Created monthly billing reminder job: ${job.data.id}`);
  return job.data;
}

/**
 * Example: Schedule limited campaign
 * Runs daily for 30 days then stops
 */
export async function scheduleLimitedCampaign(
  webhookUrl: string,
  campaignDays: number = 30
): Promise<CronJob> {
  const a1cron = getA1Cron();
  
  const job = await a1cron.createCronJob({
    name: '30-Day Marketing Campaign',
    description: 'Daily campaign messages for 30 days',
    endpoint_url: `${webhookUrl}/api/campaigns/send-daily`,
    method: 'POST',
    timezone: 'America/Los_Angeles',
    schedule_config: {
      repeat_type: 'days',
      repeat_every: 1,
      time: '10:00',
      end_type: 'after',
      end_occurrences: campaignDays
    },
    body: JSON.stringify({
      campaignId: 'summer-2024',
      segment: 'active-users',
      template: 'daily-tip'
    }),
    tags: ['campaign', 'marketing', 'limited']
  });
  
  console.log(`Created ${campaignDays}-day campaign job: ${job.data.id}`);
  return job.data;
}

/**
 * Example: Pause and resume a job
 */
export async function pauseAndResumeJob(jobId: string): Promise<void> {
  const a1cron = getA1Cron();
  
  // Pause the job
  console.log(`Pausing job ${jobId}...`);
  await a1cron.toggleCronJob(jobId, false);
  
  // Do something...
  
  // Resume the job
  console.log(`Resuming job ${jobId}...`);
  await a1cron.toggleCronJob(jobId, true);
}

/**
 * Example: Monitor job execution
 */
export async function monitorJobExecution(jobId: string): Promise<void> {
  const a1cron = getA1Cron();
  
  // Get recent execution logs
  const logs = await a1cron.getExecutionLogs(jobId, {
    limit: 10,
    status: 'failure' // Only failures
  });
  
  if (logs.data.length > 0) {
    console.log(`Found ${logs.data.length} failed executions:`);
    
    logs.data.forEach(log => {
      console.log(`- ${log.executed_at}: ${log.error_message}`);
    });
    
    // If too many failures, pause the job
    if (logs.data.length >= 5) {
      console.log('Too many failures, pausing job...');
      await a1cron.toggleCronJob(jobId, false);
    }
  }
} 