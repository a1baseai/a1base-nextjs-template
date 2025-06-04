/**
 * Test script for SMS sending functionality
 * Run with: npx ts-node tests/sms/test-sms-send.ts
 */

import { ExtendedA1BaseAPI } from '../../lib/a1base/extended-client';
import { SMSHandler } from '../../lib/services/sms-handler';

// Initialize the extended client
const client = new ExtendedA1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Test messages
const testMessages = [
  {
    name: "Short message",
    content: "Hello! This is a test SMS from A1Base.",
    shouldPass: true
  },
  {
    name: "Message with emojis",
    content: "Hello 👋 This message has emojis 😊",
    shouldPass: false // Should fail GSM-7 validation
  },
  {
    name: "Long message (over 1200 chars)",
    content: "A".repeat(1201),
    shouldPass: false // Should fail length validation
  },
  {
    name: "Message with Unicode quotes",
    content: `She said "Hello" and I replied 'Hi!'`,
    shouldPass: true // Should be sanitized
  },
  {
    name: "SMS-friendly message",
    content: "Your appointment is confirmed for tomorrow at 3PM. Reply YES to confirm or NO to cancel.",
    shouldPass: true
  }
];

async function testSMSSending() {
  console.log("🧪 SMS Sending Test Suite\n");
  
  const TEST_RECIPIENT = process.env.TEST_PHONE_NUMBER || "+1234567890";
  const AGENT_NUMBER = process.env.A1BASE_AGENT_NUMBER!;
  const ACCOUNT_ID = process.env.A1BASE_ACCOUNT_ID!;
  
  console.log(`📱 Test Configuration:`);
  console.log(`   Agent Number: ${AGENT_NUMBER}`);
  console.log(`   Test Recipient: ${TEST_RECIPIENT}`);
  console.log(`   Account ID: ${ACCOUNT_ID}\n`);
  
  for (const test of testMessages) {
    console.log(`📝 Test: ${test.name}`);
    console.log(`   Content: ${test.content.substring(0, 50)}${test.content.length > 50 ? '...' : ''}`);
    console.log(`   Length: ${test.content.length} chars`);
    
    // First, validate the message
    const validation = SMSHandler.validateSMSContent(test.content);
    console.log(`   Validation: ${validation.valid ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (!validation.valid) {
      console.log(`   Error: ${validation.error}`);
    }
    
    // Get SMS preview
    const preview = SMSHandler.getSMSPreview(test.content);
    if (preview.warnings.length > 0) {
      console.log(`   ⚠️  Warnings:`);
      preview.warnings.forEach(w => console.log(`      - ${w}`));
    }
    
    // If message needs sanitization, show the sanitized version
    if (preview.sanitized !== test.content) {
      console.log(`   📝 Sanitized: ${preview.sanitized.substring(0, 50)}${preview.sanitized.length > 50 ? '...' : ''}`);
    }
    
    // Try to send if we expect it to pass
    if (test.shouldPass && validation.valid) {
      try {
        console.log(`   📤 Attempting to send SMS...`);
        
        const result = await client.sendSMS(ACCOUNT_ID, {
          content: { message: test.content },
          from: AGENT_NUMBER,
          to: TEST_RECIPIENT,
          service: 'sms',
          type: 'individual'
        });
        
        console.log(`   ✅ SMS sent successfully!`);
        console.log(`   Response:`, result);
      } catch (error) {
        console.log(`   ❌ Failed to send:`, error);
      }
    } else if (test.shouldPass && !validation.valid) {
      console.log(`   ❌ Test failed: Expected to pass but validation failed`);
    } else if (!test.shouldPass && validation.valid) {
      console.log(`   ❌ Test failed: Expected to fail but validation passed`);
    } else {
      console.log(`   ✅ Test passed: Correctly identified as invalid`);
    }
    
    console.log(''); // Empty line between tests
  }
}

// Run the tests
testSMSSending().catch(console.error); 