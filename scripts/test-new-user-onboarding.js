#!/usr/bin/env node

/**
 * Test script for new user onboarding - ensures unique thread ID
 * Usage: node scripts/test-new-user-onboarding.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Generate unique IDs with timestamp and random number
const timestamp = Date.now();
const random = Math.floor(Math.random() * 10000);

// Sample WhatsApp webhook payload for a completely new user
const testPayload = {
  message_id: `new-user-msg-${timestamp}-${random}`,
  thread_id: `new-user-thread-${timestamp}-${random}`,
  thread_type: "individual",
  sender_number: `+1555${timestamp.toString().slice(-7)}`, // Unique phone number
  sender_name: `New User ${random}`,
  message_content: {
    text: "Hi! I'm a new user and I'd like to get started with my mobile app project"
  },
  message_type: "text",
  timestamp: new Date().toISOString(),
  service: "whatsapp"
};

console.log('🚀 Testing new user onboarding at:', webhookUrl);
console.log('🆕 New user details:');
console.log('   From:', testPayload.sender_number);
console.log('   Name:', testPayload.sender_name);
console.log('   Message:', testPayload.message_content.text);
console.log('   Thread ID:', testPayload.thread_id);
console.log('   (All IDs are unique to ensure fresh onboarding)');

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
      console.log('\n✅ Webhook response:', response.status, response.statusText);
      console.log('📦 Response data:', JSON.stringify(data, null, 2));
      console.log('\n🎉 Test successful! Check server logs for:');
      console.log('   - [OnboardingCheck] logs to see onboarding decision');
      console.log('   - [OnboardingFlow] logs to see onboarding execution');
      console.log('   - The bot should respond with a personalized onboarding message');
    } else {
      console.error('❌ Webhook error:', response.status, response.statusText);
      console.error('📦 Error data:', data);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to send test webhook:', error.message);
    console.error('💡 Make sure your server is running at:', webhookUrl);
  }); 