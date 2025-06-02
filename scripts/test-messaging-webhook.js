#!/usr/bin/env node

/**
 * Test script for messaging webhook - simulates WhatsApp messages
 * Usage: node scripts/test-messaging-webhook.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Sample WhatsApp webhook payload based on A1Base documentation
const testPayload = {
  message_id: `test-msg-${Date.now()}`,
  thread_id: `test-thread-${Date.now()}`,
  thread_type: "individual",
  sender_number: "+1234567890",
  sender_name: "Test User",
  message_content: {
    text: "Hello, I need help setting up my new project for a mobile app"
  },
  message_type: "text",
  timestamp: new Date().toISOString(),
  service: "whatsapp"
};

console.log('🚀 Sending test WhatsApp message webhook to:', webhookUrl);
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
      console.log('\n🎉 Test successful! The message was processed.');
      console.log('💡 Check your server logs to see the onboarding flow in action.');
    } else {
      console.error('❌ Webhook error:', response.status, response.statusText);
      console.error('📦 Error data:', data);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to send test webhook:', error.message);
    console.error('💡 Make sure your server is running at:', webhookUrl);
  }); 