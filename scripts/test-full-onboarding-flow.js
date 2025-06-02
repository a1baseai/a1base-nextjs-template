#!/usr/bin/env node

/**
 * Test script for full onboarding flow - simulates complete conversation
 * Usage: node scripts/test-full-onboarding-flow.js [webhook-url]
 */

const webhookUrl = process.argv[2] || 'http://localhost:3005/api/a1base/messaging';

// Generate unique IDs
const timestamp = Date.now();
const random = Math.floor(Math.random() * 10000);
const threadId = `full-onboarding-thread-${timestamp}-${random}`;
const senderNumber = `+1999${timestamp.toString().slice(-7)}`;

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
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log(`✅ Message ${messageIndex} processed successfully`);
    } else {
      console.error(`❌ Error sending message ${messageIndex}:`, data);
    }
  } catch (error) {
    console.error(`❌ Failed to send message ${messageIndex}:`, error.message);
  }
  
  // Wait a bit between messages
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function runOnboardingTest() {
  console.log('🚀 Testing full onboarding flow');
  console.log('📞 Phone:', senderNumber);
  console.log('🆔 Thread:', threadId);
  console.log('\n📝 Starting onboarding conversation...\n');

  // Message 1: Initial greeting
  await sendMessage("Hi! I'm interested in getting started", 1);
  
  console.log('⏳ Waiting for bot to ask for name...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Message 2: Provide name
  await sendMessage("My name is John Doe", 2);
  
  console.log('⏳ Waiting for bot to ask for email...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Message 3: Provide email
  await sendMessage("john.doe@example.com", 3);
  
  console.log('⏳ Waiting for bot to ask for big dream...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Message 4: Provide big dream
  await sendMessage("My biggest dream is to build an app that helps people manage their daily tasks efficiently and reach their goals", 4);
  
  console.log('\n✨ Onboarding conversation complete!');
  console.log('💡 Check your server logs to verify:');
  console.log('   - Bot asked for name first');
  console.log('   - Bot asked for email second');
  console.log('   - Bot asked for big dream third');
  console.log('   - Bot gave final onboarding complete message');
  console.log('   - All fields were properly stored');
}

// Run the test
runOnboardingTest().catch(console.error); 