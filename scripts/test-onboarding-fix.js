#!/usr/bin/env node

/**
 * Test script to verify onboarding fixes
 * Usage: node scripts/test-onboarding-fix.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Generate unique IDs  
const timestamp = Date.now();
const random = Math.floor(Math.random() * 10000);
const threadId = `onboarding-fix-test-${timestamp}-${random}`;
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
  console.log('🚀 Testing onboarding fixes');
  console.log('📱 Test details:');
  console.log('   Thread ID:', threadId);
  console.log('   Sender:', senderNumber);
  console.log('\n🔍 Testing onboarding conversation flow');
  
  try {
    // Message 1: Initial greeting
    console.log('\n--- Test 1: Initial Message ---');
    if (!await sendMessage("Hey there!", 1)) return;
    console.log('⏳ Waiting 3s for bot response...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Message 2: Provide name
    console.log('\n--- Test 2: Providing Name ---');
    if (!await sendMessage("Pasha Rayan", 2)) return;
    console.log('⏳ Waiting 3s for bot response...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Message 3: Provide email
    console.log('\n--- Test 3: Providing Email ---');
    if (!await sendMessage("pasha@example.com", 3)) return;
    console.log('⏳ Waiting 3s for bot response...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Message 4: Provide dream
    console.log('\n--- Test 4: Providing Big Dream ---');
    if (!await sendMessage("I want to build amazing AI products that help people", 4)) return;
    console.log('⏳ Waiting 3s for bot response...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n✅ Test completed! Check server logs for:');
    console.log('   1. Role assignments should show "assistant" for bot messages');
    console.log('   2. extractCollectedFields should find assistant->user pairs');
    console.log('   3. Bot should ask for email after name, not repeat name request');
    console.log('   4. No duplicate messages in database');
    console.log('   5. Final onboarding completion message after all fields collected');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTest(); 