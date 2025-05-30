#!/usr/bin/env node

/**
 * Test script to preview professional email responses
 * This simulates how emails will be formatted
 */

// Import the workflow (this won't work in plain node, but shows the structure)
console.log("🎨 Professional Email Response Preview\n");

// Example 1: Casual inquiry
console.log("📧 Example 1: Casual Inquiry");
console.log("From: pasha@example.com");
console.log("Subject: Hey test");
console.log("Body: Love a1foundermode");
console.log("\n--- EXPECTED PROFESSIONAL RESPONSE ---");
console.log("Subject: Re: Hey test\n");
console.log("Dear Pasha,");
console.log("");
console.log("Thank you for your message and for your enthusiasm about A1 Founder Mode!");
console.log("");
console.log("I'm delighted to hear that you love the platform. Is there anything specific about A1 Founder Mode that you'd like to explore further, or any way I can assist you in getting the most out of it?");
console.log("");
console.log("Please feel free to reach out if you have any questions or need support with any features.");
console.log("");
console.log("Best regards,");
console.log("Felicie");
console.log("A1 Founder Mode Assistant");

console.log("\n" + "=".repeat(60) + "\n");

// Example 2: Business inquiry
console.log("📧 Example 2: Business Inquiry");
console.log("From: client@company.com");
console.log("Subject: Integration Question");
console.log("Body: Hi, we're interested in integrating your API. Can you provide documentation?");
console.log("\n--- EXPECTED PROFESSIONAL RESPONSE ---");
console.log("Subject: Re: Integration Question\n");
console.log("Dear Client,");
console.log("");
console.log("Thank you for your interest in integrating with our API.");
console.log("");
console.log("I'd be happy to help you get started with our integration. You can find our comprehensive API documentation at:");
console.log("");
console.log("• API Guide: https://github.com/a1baseai/a1framework");
console.log("• Email Integration: [Link to email webhook documentation]");
console.log("• Quick Start Guide: [Link to quickstart]");
console.log("");
console.log("The documentation covers authentication, available endpoints, and includes code examples in multiple languages. If you need any specific guidance or have questions about particular use cases, please don't hesitate to ask.");
console.log("");
console.log("Would you like me to schedule a technical call to walk through the integration process?");
console.log("");
console.log("Best regards,");
console.log("Felicie");
console.log("A1 Founder Mode Assistant");

console.log("\n" + "=".repeat(60) + "\n");

// Example 3: Support request
console.log("📧 Example 3: Support Request");
console.log("From: user@email.com");
console.log("Subject: Email not sending");
console.log("Body: I'm trying to send emails but getting errors. Help!");
console.log("\n--- EXPECTED PROFESSIONAL RESPONSE ---");
console.log("Subject: Re: Email not sending\n");
console.log("Dear User,");
console.log("");
console.log("I understand you're experiencing issues with sending emails. I'm here to help resolve this for you.");
console.log("");
console.log("To better assist you, could you please provide:");
console.log("");
console.log("1. The specific error message you're receiving");
console.log("2. Which email address you're trying to send from");
console.log("3. When you first noticed this issue");
console.log("");
console.log("In the meantime, here are some common solutions:");
console.log("");
console.log("• Verify your email configuration in the environment variables");
console.log("• Ensure your A1BASE_AGENT_EMAIL is correctly set and doesn't have trailing spaces");
console.log("• Check that your API credentials are valid and have the necessary permissions");
console.log("");
console.log("I'll prioritize resolving this issue as soon as I receive the additional information.");
console.log("");
console.log("Best regards,");
console.log("Felicie");
console.log("A1 Founder Mode Assistant");

console.log("\n" + "=".repeat(60) + "\n");

console.log("💡 Note: These are examples of how the AI will format professional email responses.");
console.log("The actual responses will be contextually generated based on the email content and conversation history."); 