#!/usr/bin/env node

/**
 * Debug script for HTML email sending via A1Base API
 * Tests different approaches to ensure HTML rendering works
 */

require('dotenv').config();
const { A1BaseAPI } = require('a1base-node');

const a1BaseClient = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY,
    apiSecret: process.env.A1BASE_API_SECRET,
  },
});

const A1BASE_ACCOUNT_ID = process.env.A1BASE_ACCOUNT_ID;
const A1BASE_AGENT_EMAIL = process.env.A1BASE_AGENT_EMAIL?.trim() || "";

console.log("🔍 HTML Email Debug Test\n");
console.log("Account ID:", A1BASE_ACCOUNT_ID);
console.log("Agent Email:", A1BASE_AGENT_EMAIL);

// Test HTML content with DOCTYPE as shown in A1Mail docs
const htmlContentWithDoctype = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>HTML Email Test</title>
<style>
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
p { margin: 0 0 1em 0; }
ul { margin: 0 0 1em 0; padding-left: 20px; }
li { margin: 0 0 0.5em 0; }
h1 { color: #5586FF; }
</style>
</head>
<body>
<h1>HTML Email Test</h1>
<p>This is a <strong>test email</strong> to verify HTML rendering.</p>
<p>If you can see this with proper formatting, HTML is working!</p>
<ul>
<li>Bullet point 1</li>
<li>Bullet point 2</li>
<li>Bullet point 3</li>
</ul>
<p>Best regards,<br>A1Base Test</p>
</body>
</html>`;

// Test HTML content without DOCTYPE
const htmlContentNoDoctype = `<html>
<head>
<style>
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
p { margin: 0 0 1em 0; }
ul { margin: 0 0 1em 0; padding-left: 20px; }
li { margin: 0 0 0.5em 0; }
h1 { color: #5586FF; }
</style>
</head>
<body>
<h1>HTML Email Test</h1>
<p>This is a <strong>test email</strong> to verify HTML rendering.</p>
<p>If you can see this with proper formatting, HTML is working!</p>
<ul>
<li>Bullet point 1</li>
<li>Bullet point 2</li>
<li>Bullet point 3</li>
</ul>
<p>Best regards,<br>A1Base Test</p>
</body>
</html>`;

// Plain text version
const plainTextContent = `HTML Email Test

This is a test email to verify HTML rendering.

If you can see this with proper formatting, HTML is working!

- Bullet point 1
- Bullet point 2
- Bullet point 3

Best regards,
A1Base Test`;

async function testEmailApproach(approach, emailData) {
  console.log(`\n📧 Testing Approach: ${approach}`);
  console.log("Email Data:", JSON.stringify(emailData, null, 2));
  
  try {
    const response = await a1BaseClient.sendEmailMessage(A1BASE_ACCOUNT_ID, emailData);
    console.log("✅ Response:", JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    return null;
  }
}

async function runTests() {
  const recipientEmail = process.argv[2] || "test@example.com";
  console.log("\n📬 Sending test emails to:", recipientEmail);
  
  // Approach 1: HTML with DOCTYPE (as per A1Mail docs)
  await testEmailApproach("HTML with DOCTYPE (A1Mail docs pattern)", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 1: HTML with DOCTYPE",
    body: htmlContentWithDoctype,
    headers: {}
  });
  
  // Approach 2: HTML without DOCTYPE
  await testEmailApproach("HTML without DOCTYPE", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 2: HTML without DOCTYPE",
    body: htmlContentNoDoctype,
    headers: {}
  });
  
  // Approach 3: With CC/BCC in headers (as shown in docs)
  await testEmailApproach("HTML with CC/BCC headers", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 3: HTML with CC/BCC",
    body: htmlContentWithDoctype,
    headers: {
      "cc": "test-cc@example.com",
      "bcc": "test-bcc@example.com"
    }
  });
  
  // Approach 4: Simple HTML without full document structure
  await testEmailApproach("Simple HTML tags", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 4: Simple HTML",
    body: "<p>This is a <strong>simple HTML</strong> test with <em>basic tags</em>.</p><p>Second paragraph here.</p>",
    headers: {}
  });
  
  // Approach 5: Plain text for comparison
  await testEmailApproach("Plain text (for comparison)", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 5: Plain text",
    body: plainTextContent,
    headers: {}
  });
  
  console.log("\n✨ Test complete! Check the recipient's inbox to see which emails render as HTML.");
  console.log("💡 Based on A1Mail docs, Test 1 (HTML with DOCTYPE) should work correctly.");
}

// Run the tests
runTests().catch(console.error); 