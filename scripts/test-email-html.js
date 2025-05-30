#!/usr/bin/env node

/**
 * Test HTML email formatting
 */

console.log("📧 Testing HTML Email Formatting\n");

// Sample email body
const sampleBody = `Hi Pasha,

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
console.log(sampleBody);
console.log("\n");

// Apply HTML formatting
function formatAsHTML(body) {
  let formattedBody = body;
  
  // Normalize line endings
  formattedBody = formattedBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Escape HTML special characters
  formattedBody = formattedBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Split into paragraphs
  const paragraphs = formattedBody.split('\n\n');
  
  // Process each paragraph
  const htmlParagraphs = paragraphs.map((paragraph) => {
    const lines = paragraph.split('\n');
    
    // Check if this paragraph contains list items
    if (lines.some(line => line.trim().match(/^[-*•]|\d+\./))) {
      // This is a list
      const listItems = lines
        .filter(line => line.trim())
        .map(line => {
          if (line.trim().match(/^[-*•]|\d+\./)) {
            const content = line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
            return `<li>${content}</li>`;
          } else {
            return `<p>${line}</p>`;
          }
        });
      
      const firstListItemIndex = listItems.findIndex(item => item.startsWith('<li>'));
      if (firstListItemIndex > 0) {
        const introText = listItems.slice(0, firstListItemIndex).join('');
        const listHtml = '<ul>' + listItems.slice(firstListItemIndex).join('') + '</ul>';
        return introText + listHtml;
      } else {
        return '<ul>' + listItems.join('') + '</ul>';
      }
    } else {
      const processedParagraph = paragraph.replace(/\n/g, ' ');
      return `<p>${processedParagraph}</p>`;
    }
  }).filter(p => p && p !== '<p></p>');
  
  // Combine into final HTML
  formattedBody = `<html>
<head>
<style>
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
p { margin: 0 0 1em 0; }
ul { margin: 0 0 1em 0; padding-left: 20px; }
li { margin: 0 0 0.5em 0; }
</style>
</head>
<body>
${htmlParagraphs.join('\n')}
</body>
</html>`;
  
  return formattedBody;
}

const htmlBody = formatAsHTML(sampleBody);

console.log("🌐 HTML Email Body:");
console.log("==================");
console.log(htmlBody);
console.log("\n");

// Show preview of how it renders
console.log("👁️ Text Preview (how it will appear):");
console.log("=====================================");
console.log("Hi Pasha,");
console.log("");
console.log("Thank you for your email and for your request.");
console.log("");
console.log("Here's a summary of your recent emails:");
console.log("");
console.log("• \"Pasha From A1Base\": No message body—only the full email header and metadata were included.");
console.log("• \"Hey felicie\": Again, just the header details; message content was missing.");
console.log("• \"Pasha here!\": You provided your contact details and shared a positive comment about my capabilities as an AI agent.");
console.log("• \"Hey Felicie!\": You requested a list of your recent emails with summaries and asked how I can help you overall.");
console.log("");
console.log("As an AI agent, I can support you by organizing and tracking your projects, summarizing key communications, providing regular progress updates, and helping set up systems for efficient project management. My hands-on approach is focused on delivering tangible results and ensuring your work stays on track.");
console.log("");
console.log("Please let me know if there's a particular project you'd like to prioritize, or if you want to set up recurring check-ins or progress reviews. I'm here to help you achieve your goals effectively.");
console.log("");
console.log("Best regards,");
console.log("Felicie");
console.log("\n");

console.log("✅ Benefits of HTML formatting:");
console.log("==============================");
console.log("• Consistent display across all email clients");
console.log("• Proper paragraph spacing");
console.log("• Well-formatted lists with bullets");
console.log("• Professional appearance");
console.log("• No formatting issues or collapsed text");

console.log("\n✨ HTML email formatting test complete!"); 