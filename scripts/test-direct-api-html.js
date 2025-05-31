#!/usr/bin/env node

/**
 * Test script to demonstrate a1base-node SDK bug and direct API fix
 */

require('dotenv').config({ path: '.env.local' });

const A1BASE_ACCOUNT_ID = process.env.A1BASE_ACCOUNT_ID;
const A1BASE_API_KEY = process.env.A1BASE_API_KEY;
const A1BASE_API_SECRET = process.env.A1BASE_API_SECRET;
const A1BASE_AGENT_EMAIL = process.env.A1BASE_AGENT_EMAIL?.trim() || "";

console.log("🔍 Testing HTML Email - SDK Bug vs Direct API\n");

const htmlEmail = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>HTML Email Test</title>
</head>
<body>
<h1>This is a test</h1>
<p>If you can see this as <strong>formatted HTML</strong>, it works!</p>
<ul>
<li>Item 1</li>
<li>Item 2</li>
</ul>
</body>
</html>`;

async function testDirectAPI() {
  const recipientEmail = process.argv[2] || "test@example.com";
  console.log("📧 Sending HTML email via Direct API to:", recipientEmail);
  
  const emailData = {
    sender_address: A1BASE_AGENT_EMAIL,
    recipient_address: recipientEmail,
    subject: "Direct API Test - HTML Email",
    body: htmlEmail,
    headers: {}
  };

  console.log("\n📄 HTML being sent:");
  console.log(htmlEmail);
  
  try {
    const apiUrl = `https://api.a1base.com/v1/emails/${A1BASE_ACCOUNT_ID}/send`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': A1BASE_API_KEY,
        'X-API-Secret': A1BASE_API_SECRET
      },
      body: JSON.stringify(emailData)
    });

    const responseData = await response.json();
    console.log("\n✅ API Response:", JSON.stringify(responseData, null, 2));
    
    if (response.ok && responseData.status !== 'error') {
      console.log("\n🎉 Success! Check your email for proper HTML formatting.");
    } else {
      console.error("\n❌ Failed:", responseData.message || response.statusText);
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

// Demonstrate the SDK bug
console.log("⚠️  The a1base-node SDK has a bug in utils/sanitizer.js:");
console.log("   It strips all < and > characters with: .replace(/[<>]/g, '')");
console.log("   This makes it impossible to send HTML emails through the SDK.\n");

// Test direct API
testDirectAPI(); 