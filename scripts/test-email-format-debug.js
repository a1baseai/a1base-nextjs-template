#!/usr/bin/env node

/**
 * Debug script for email formatting issues
 * Tests different formatting approaches and shows exactly what's being sent
 */

console.log("🔍 Email Formatting Debug Test\n");

// Sample email body that should have multiple paragraphs and lists
const originalBody = `Hi Pasha,

Thank you for your email and for your request.

Here's a summary of your recent emails:

- "Pasha From A1Base": No message body—only the full email header and metadata were included.
- "Hey felicie": Again, just the header details; message content was missing.
- "Pasha here!": You provided your contact details and shared a positive comment about my capabilities as an AI agent.
- "Hey Felicie!": You requested a list of your recent emails with summaries and asked how I can help you overall.

As an AI agent, I can support you by organizing and tracking your projects, summarizing key communications, providing regular progress updates, and helping set up systems for efficient project management. My hands-on approach is focused on delivering tangible results and ensuring your work stays on track.

Please let me know if there's a particular project you'd like to prioritize, or if you want to set up recurring check-ins or progress reviews. I'm here to help you achieve your goals effectively.

Best regards,
Felicie`;

console.log("📝 Original Body:");
console.log("================");
console.log(originalBody);
console.log("\n");

// Test the current formatting approach
function formatEmailBody(body) {
  let formattedBody = body;
  
  // First, normalize all line endings
  formattedBody = formattedBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  const paragraphs = formattedBody.split('\n\n');
  formattedBody = paragraphs.map(paragraph => {
    const lines = paragraph.split('\n');
    if (lines.some(line => line.trim().match(/^[-*•]|\d+\./))) {
      return lines.map(line => {
        if (line.trim().match(/^[-*•]|\d+\./)) {
          return '  ' + line; // Indent list items
        }
        return line;
      }).join('\n');
    } else {
      return paragraph.replace(/\n/g, ' ');
    }
  }).join('\n\n');
  
  // Convert to CRLF format
  formattedBody = formattedBody.replace(/\n/g, '\r\n');
  
  // Add extra line break between sections
  formattedBody = formattedBody.replace(/\r\n\r\n/g, '\r\n\r\n\r\n');
  
  return formattedBody;
}

const formattedBody = formatEmailBody(originalBody);

console.log("✉️ Formatted Body (with CRLF):");
console.log("==============================");
console.log(formattedBody);
console.log("\n");

console.log("🔢 Character Analysis:");
console.log("=====================");
console.log("Original length:", originalBody.length);
console.log("Formatted length:", formattedBody.length);
console.log("\n");

// Show the JSON representation (what gets sent to API)
console.log("📦 JSON Representation (what's sent to API):");
console.log("===========================================");
console.log(JSON.stringify(formattedBody));
console.log("\n");

// Alternative approach: Use visual separators
console.log("🎯 Alternative Approach - Visual Separators:");
console.log("==========================================");

function formatWithVisualSeparators(body) {
  let formatted = body;
  
  // Normalize line endings
  formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Add visual separators between paragraphs
  formatted = formatted.replace(/\n\n/g, '\n\n---\n\n');
  
  // Format lists with bullets
  formatted = formatted.replace(/^- /gm, '• ');
  
  // Convert to CRLF
  formatted = formatted.replace(/\n/g, '\r\n');
  
  return formatted;
}

const visualFormatted = formatWithVisualSeparators(originalBody);
console.log(visualFormatted);
console.log("\n");

console.log("💡 Debugging Tips:");
console.log("=================");
console.log("1. Check if the email client is stripping formatting");
console.log("2. Try sending to different email providers (Gmail, Outlook, etc.)");
console.log("3. Check raw email source in the email client");
console.log("4. Consider if A1Base API is modifying the content");
console.log("\n");

console.log("🧪 Test complete!"); 