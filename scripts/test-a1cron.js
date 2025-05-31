#!/usr/bin/env node

/**
 * Test script for A1Cron
 * 
 * Demonstrates how to use A1Cron to create, list, and manage cron jobs
 * Usage: node scripts/test-a1cron.js [command]
 * 
 * Commands:
 *   list     - List all cron jobs
 *   create   - Create a test cron job
 *   trigger  - Manually trigger a cron job
 *   delete   - Delete a cron job
 */

// Load environment variables
require('dotenv').config();

const command = process.argv[2] || 'list';
const cronJobId = process.argv[3]; // For trigger/delete commands

// A1Cron configuration
const A1CRON_BASE_URL = 'https://api.a1base.com/v1/cron-jobs';
const headers = {
  'X-API-Key': process.env.A1BASE_API_KEY,
  'X-API-Secret': process.env.A1BASE_API_SECRET,
  'Content-Type': 'application/json',
};

async function makeRequest(endpoint, options = {}) {
  const url = `${A1CRON_BASE_URL}/${process.env.A1BASE_ACCOUNT_ID}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
    }
    
    return data;
  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}

async function listCronJobs() {
  console.log('📋 Listing all cron jobs...\n');
  
  const result = await makeRequest('/list');
  
  if (result.data && result.data.length > 0) {
    result.data.forEach((job, index) => {
      console.log(`${index + 1}. ${job.name} (ID: ${job.id})`);
      console.log(`   Status: ${job.is_active ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Endpoint: ${job.endpoint_url}`);
      console.log(`   Schedule: ${job.schedule}`);
      console.log(`   Next Run: ${job.next_run_at || 'N/A'}`);
      console.log(`   Total Executions: ${job.total_executions}`);
      console.log(`   Success Rate: ${job.total_executions > 0 ? 
        Math.round((job.successful_executions / job.total_executions) * 100) : 0}%`);
      console.log('');
    });
  } else {
    console.log('No cron jobs found.');
  }
}

async function createTestCronJob() {
  console.log('🚀 Creating a test cron job...\n');
  
  // Get the base URL from environment or use localhost
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';
  
  const testJob = {
    name: `Test Health Check - ${new Date().toISOString()}`,
    description: 'A test cron job that checks API health',
    endpoint_url: `${baseUrl}/api/health`, // You'll need to create this endpoint
    method: 'GET',
    timezone: 'America/New_York',
    schedule_config: {
      repeat_type: 'hourly',
      repeat_every: 1,
      time: '00:00', // Run at the top of every hour
      end_type: 'never'
    },
    retry_config: {
      max_retries: 3,
      retry_delay_seconds: 60,
      timeout_seconds: 30
    },
    callbacks: {
      success_url: `${baseUrl}/api/a1base/cron-webhook`,
      failure_url: `${baseUrl}/api/a1base/cron-webhook`
    },
    tags: ['test', 'health-check'],
    is_active: true
  };
  
  const result = await makeRequest('/create', {
    method: 'POST',
    body: JSON.stringify(testJob),
  });
  
  console.log('✅ Cron job created successfully!');
  console.log('Job ID:', result.data.id);
  console.log('Name:', result.data.name);
  console.log('Next Run:', result.data.next_run_at);
  console.log('\nTo manually trigger this job, run:');
  console.log(`node scripts/test-a1cron.js trigger ${result.data.id}`);
}

async function triggerCronJob(jobId) {
  if (!jobId) {
    console.error('❌ Please provide a cron job ID');
    console.log('Usage: node scripts/test-a1cron.js trigger <job-id>');
    return;
  }
  
  console.log(`⚡ Manually triggering cron job ${jobId}...\n`);
  
  const result = await makeRequest(`/trigger/${jobId}`, {
    method: 'POST',
  });
  
  console.log('✅ Job triggered successfully!');
  console.log('Execution ID:', result.data.execution_id);
  console.log('Status:', result.data.status);
  console.log('Response Code:', result.data.response_code);
  console.log('Executed At:', result.data.executed_at);
  
  if (result.data.response_body) {
    console.log('Response:', result.data.response_body);
  }
}

async function deleteCronJob(jobId) {
  if (!jobId) {
    console.error('❌ Please provide a cron job ID');
    console.log('Usage: node scripts/test-a1cron.js delete <job-id>');
    return;
  }
  
  console.log(`🗑️  Deleting cron job ${jobId}...\n`);
  
  const result = await makeRequest(`/delete/${jobId}`, {
    method: 'DELETE',
  });
  
  console.log('✅ Job deleted successfully!');
  console.log(result.data.message);
}

// Main execution
(async () => {
  try {
    // Check for required environment variables
    if (!process.env.A1BASE_API_KEY || !process.env.A1BASE_API_SECRET || !process.env.A1BASE_ACCOUNT_ID) {
      console.error('❌ Missing required environment variables:');
      console.error('   - A1BASE_API_KEY');
      console.error('   - A1BASE_API_SECRET');
      console.error('   - A1BASE_ACCOUNT_ID');
      process.exit(1);
    }
    
    switch (command) {
      case 'list':
        await listCronJobs();
        break;
      case 'create':
        await createTestCronJob();
        break;
      case 'trigger':
        await triggerCronJob(cronJobId);
        break;
      case 'delete':
        await deleteCronJob(cronJobId);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('\nAvailable commands:');
        console.log('  list     - List all cron jobs');
        console.log('  create   - Create a test cron job');
        console.log('  trigger  - Manually trigger a cron job');
        console.log('  delete   - Delete a cron job');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})(); 