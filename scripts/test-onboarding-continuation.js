#!/usr/bin/env node

/**
 * Test script for onboarding continuation - simulates providing name and expecting email question
 * Usage: node scripts/test-onboarding-continuation.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Generate unique IDs
const timestamp = Date.now();
const random = Math.floor(Math.random() * 10000);
const threadId = `onboarding-test-${timestamp}-${random}`;
const senderNumber = `+1777${timestamp.toString().slice(-7)}`;

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
  console.log('🚀 Testing onboarding continuation flow');
  console.log('📱 Test details:');
  console.log('   Thread ID:', threadId);
  console.log('   Sender:', senderNumber);
  console.log('\n🔍 Expected behavior:');
  console.log('   1. First message triggers onboarding - bot asks for name');
  console.log('   2. User provides name');
  console.log('   3. Bot should ask for email address (NOT generic statement)');
  console.log('   4. User provides email');
  console.log('   5. Bot should ask for big dream');
  console.log('\n📊 Watch server logs for:');
  console.log('   - [extractCollectedFields] logs showing name extraction');
  console.log('   - [Onboarding] logs showing next field is "email"');
  console.log('   - Response should be a question about email');
  
  try {
    // Message 1: Initial greeting
    console.log('\n--- Step 1: Initial Message ---');
    if (!await sendMessage("Hey July - let's go!", 1)) return;
    
    // Wait for bot response
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('⏱️  Bot should have asked for name...');
    
    // Message 2: Provide name
    console.log('\n--- Step 2: Providing Name ---');
    if (!await sendMessage("Pasha Rayan", 2)) return;
    
    // Wait for bot response
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('⏱️  Bot should now ask for email address...');
    console.log('\n⚠️  If bot gives generic response instead of asking for email, the bug is NOT fixed!');
    
    console.log('\n✅ Test messages sent! Check your WhatsApp/logs to verify:');
    console.log('   - Bot should have asked for email after receiving the name');
    console.log('   - NOT a generic "Let\'s dive in" message');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTest(); 