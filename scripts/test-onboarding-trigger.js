#!/usr/bin/env node

/**
 * Test script for "Start onboarding" trigger
 * Usage: node scripts/test-onboarding-trigger.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Test payload with "Start onboarding" message
const testPayload = {
  message_id: `test-onboarding-${Date.now()}`,
  thread_id: `test-thread-onboarding-${Date.now()}`,
  thread_type: "individual",
  sender_number: "+1987654321",
  sender_name: "Onboarding Test User",
  message_content: {
    text: "Start onboarding"
  },
  message_type: "text",
  timestamp: new Date().toISOString(),
  service: "whatsapp"
};

console.log('🚀 Testing "Start onboarding" trigger at:', webhookUrl);
console.log('📱 Test message details:');
console.log('   From:', testPayload.sender_number);
console.log('   Name:', testPayload.sender_name);
console.log('   Message:', testPayload.message_content.text);
console.log('   Thread ID:', testPayload.thread_id);

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
      console.log('📦 Response data:', JSON.stringify(data, null, 2));
      console.log('\n🎉 Test successful! Onboarding should have been triggered.');
      console.log('💡 The bot should respond with an onboarding message.');
    } else {
      console.error('❌ Webhook error:', response.status, response.statusText);
      console.error('📦 Error data:', data);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to send test webhook:', error.message);
    console.error('💡 Make sure your server is running at:', webhookUrl);
  }); 