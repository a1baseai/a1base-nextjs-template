#!/usr/bin/env node

/**
 * Test script for email webhook
 * Usage: node scripts/test-email-webhook.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3006/api/webhook/a1mail';

// Sample email webhook payload based on A1Mail documentation
const testPayload = {
  email_id: `test-email-${Date.now()}`,
  subject: "Test Email for Webhook",
  sender_address: "test@example.com",
  recipient_address: "agent@a1send.com",
  timestamp: new Date().toISOString(),
  service: "email",
  raw_email_data: `From: test@example.com\r
To: agent@a1send.com\r
Subject: Test Email for Webhook\r
Content-Type: text/plain; charset="UTF-8"\r
\r
Hello,

This is a test email to verify the webhook is working correctly.

Please respond if you receive this message.

Best regards,
Test User`
};

console.log('🚀 Sending test email webhook to:', webhookUrl);
console.log('📧 Test email details:');
console.log('   From:', testPayload.sender_address);
console.log('   To:', testPayload.recipient_address);
console.log('   Subject:', testPayload.subject);

fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload),
})
  .then(async (response) => {
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook response:', response.status, response.statusText);
      console.log('📦 Response data:', data);
      console.log('\n🎉 Test successful! Check your logs to see if the email was processed.');
      console.log('💡 Note: The actual email reply will be sent via A1Base API.');
    } else {
      console.error('❌ Webhook error:', response.status, response.statusText);
      console.error('📦 Error data:', data);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to send test webhook:', error.message);
    console.error('💡 Make sure your server is running at:', webhookUrl);
  }); 