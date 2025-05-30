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

// Test HTML content
const htmlContent = `<html>
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
  
  // Approach 1: Using 'body' field with Content-Type header
  await testEmailApproach("Body field with Content-Type header", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 1: Body with Content-Type header",
    body: htmlContent,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
  
  // Approach 2: Using 'html' field
  await testEmailApproach("HTML field only", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 2: HTML field",
    html: htmlContent
  });
  
  // Approach 3: Using both 'html' and 'body' fields
  await testEmailApproach("Both HTML and Body fields", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 3: Both HTML and Body",
    html: htmlContent,
    body: plainTextContent
  });
  
  // Approach 4: Using 'html_body' field
  await testEmailApproach("HTML_Body field", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 4: HTML_Body field",
    html_body: htmlContent
  });
  
  // Approach 5: Using content_type as separate field
  await testEmailApproach("Content_Type as field", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 5: Content_Type field",
    body: htmlContent,
    content_type: 'text/html'
  });
  
  // Approach 6: Plain text for comparison
  await testEmailApproach("Plain text (for comparison)", {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Test 6: Plain text",
    body: plainTextContent
  });
  
  console.log("\n✨ Test complete! Check the recipient's inbox to see which approach worked.");
  console.log("💡 Look for emails with proper HTML formatting (styled heading, bold text, bullets).");
}

// Run the tests
runTests().catch(console.error); 