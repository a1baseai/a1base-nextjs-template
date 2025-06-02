#!/usr/bin/env node

/**
 * Test script for fresh onboarding flow
 * Usage: node scripts/test-fresh-onboarding.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Generate unique IDs
const timestamp = Date.now();
const random = Math.floor(Math.random() * 10000);
const threadId = `fresh-onboarding-${timestamp}-${random}`;
const senderNumber = `+1555${timestamp.toString().slice(-7)}`;

async function sendMessage(text, messageIndex) {
  const payload = {
    message_id: `msg-${timestamp}-${messageIndex}`,
    thread_id: threadId,
    thread_type: "individual",
    sender_number: senderNumber,
    sender_name: `Test User ${random}`,
    message_content: { text },
    message_type: "text",
    timestamp: new Date().toISOString(),
    service: "whatsapp"
  };

  console.log(`\n📤 Sending message ${messageIndex}: "${text}"`);
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log(`✅ Response ${messageIndex} received:`, response.status);
    return true;
  } else {
    console.error(`❌ Error sending message ${messageIndex}:`, response.status, data);
    return false;
  }
}

async function runTest() {
  console.log('🚀 Testing fresh onboarding flow');
  console.log('📱 Test details:');
  console.log('   Thread ID:', threadId);
  console.log('   Sender:', senderNumber);
  console.log('\n🔍 This test sends just one initial message to trigger onboarding');
  console.log('   Expected: Bot should ask for full name');
  
  try {
    // Send just the initial message
    console.log('\n--- Sending Initial Message ---');
    if (!await sendMessage("Hello, I'm interested in getting started!", 1)) return;
    
    console.log('\n✅ Test message sent! Check server logs for:');
    console.log('   - [Onboarding] System prompt should ask for "name" field');
    console.log('   - Bot response should end with "What is your full name?"');
    console.log('   - NO generic "let\'s get started" responses');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTest(); 