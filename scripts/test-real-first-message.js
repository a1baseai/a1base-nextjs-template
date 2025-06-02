#!/usr/bin/env node

/**
 * Test script for real first message - simulates what happens when a new user sends their first message
 * This tests the complete first message flow including:
 * - User creation
 * - Chat creation with proper UUID
 * - Message storage
 * - Onboarding trigger
 * - Memory processing
 * 
 * Usage: node scripts/test-real-first-message.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Generate unique IDs
const timestamp = Date.now();
const random = Math.floor(Math.random() * 10000);

// Sample WhatsApp webhook payload for a real first message
const testPayload = {
  message_id: `first-msg-${timestamp}-${random}`,
  thread_id: `first-thread-${timestamp}-${random}`,
  thread_type: "individual",
  sender_number: `+1888${timestamp.toString().slice(-7)}`,
  sender_name: `New User ${random}`,
  message_content: {
    text: "i want a1base to win!"
  },
  message_type: "text",
  timestamp: new Date().toISOString(),
  service: "whatsapp"
};

console.log('🚀 Testing first message flow at:', webhookUrl);
console.log('📱 Test details:');
console.log('   External Thread ID:', testPayload.thread_id);
console.log('   Sender:', testPayload.sender_number);
console.log('   Message:', testPayload.message_content.text);
console.log('   Timestamp:', testPayload.timestamp);
console.log('\n🔍 Expected behavior:');
console.log('   1. Create new user in database');
console.log('   2. Create new chat with internal UUID');
console.log('   3. Store incoming message');
console.log('   4. Trigger onboarding flow');
console.log('   5. Store AI onboarding response');
console.log('   6. Process memory updates with correct chat UUID');
console.log('\n📊 Watch for these success indicators in server logs:');
console.log('   - "Message stored successfully with ID: [UUID]"');
console.log('   - "[StartOnboarding] Storage ID: [UUID] (internal chat UUID)"');
console.log('   - "[MemoryProcessor] Starting parallel memory processing"');
console.log('   - No "invalid input syntax for type uuid" errors');
console.log('\n');

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
      console.log('\n🎉 Test sent successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Check server logs for the expected success indicators');
      console.log('   2. Verify in database:');
      console.log('      - New user created in conversation_users table');
      console.log('      - New chat created in chats table with UUID');
      console.log('      - Messages stored with correct chat_id reference');
      console.log('      - Agent user exists with UUID');
      console.log('   3. Send a follow-up message to continue onboarding');
    } else {
      console.error('❌ Webhook error:', response.status, response.statusText);
      console.error('📦 Error data:', data);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to send test webhook:', error.message);
    console.error('💡 Make sure your server is running at:', webhookUrl);
  }); 