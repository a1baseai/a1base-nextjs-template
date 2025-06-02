#!/usr/bin/env node

/**
 * Test script for group chat onboarding
 * Usage: node scripts/test-group-onboarding.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Test payload for group message
const testPayload = {
  message_id: `test-group-msg-${Date.now()}`,
  thread_id: `test-group-${Date.now()}`,
  thread_type: "group",
  sender_number: "+1555666777",
  sender_name: "Group Member",
  message_content: {
    text: "Hey everyone, let's organize our team project here!"
  },
  message_type: "text",
  timestamp: new Date().toISOString(),
  service: "whatsapp"
};

console.log('🚀 Testing group chat onboarding at:', webhookUrl);
console.log('👥 Test group message details:');
console.log('   From:', testPayload.sender_number);
console.log('   Name:', testPayload.sender_name);
console.log('   Message:', testPayload.message_content.text);
console.log('   Group ID:', testPayload.thread_id);

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
      console.log('\n🎉 Test successful! Group onboarding should have been triggered.');
      console.log('💡 The bot should respond with a contextual welcome message that acknowledges the user\'s message.');
    } else {
      console.error('❌ Webhook error:', response.status, response.statusText);
      console.error('📦 Error data:', data);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to send test webhook:', error.message);
    console.error('💡 Make sure your server is running at:', webhookUrl);
  }); 