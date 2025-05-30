#!/usr/bin/env node

/**
 * Test email formatting to ensure line breaks display properly
 */

console.log("🧪 Testing Email Formatting\n");

// Sample AI response with single line breaks
const sampleAIResponse = `Hi Pasha,

Thanks for reaching out and for your kind words! Here's a quick update on progress so far:

- Projects are being tracked, with key milestones and deliverables outlined for each.
- Regular status reviews are in place to make sure nothing falls through the cracks.
- Communication channels have been streamlined for quick coordination.
- Any roadblocks are being flagged immediately so solutions can be actioned fast.

How I can help overall:

- Keep you informed with concise, actionable updates so you always know where things stand.
- Spot potential risks early and recommend next steps.
- Organize priorities to make sure execution stays sharp and deadlines are met.
- Act as your point of contact for rapid project support or troubleshooting.

If there's a specific area you want more detail on or anything you want me to focus on, just let me know!

Best regards,
Felicie`;

console.log("📝 Original AI Response:");
console.log("------------------------");
console.log(sampleAIResponse);
console.log("\n");

// Apply the NEW formatting logic from GenerateEmailResponse
let formattedBody = sampleAIResponse
  .split('\n\n')  // Split by double line breaks (paragraphs)
  .map(paragraph => {
    // Check if this paragraph contains a list
    if (paragraph.includes('\n-') || paragraph.includes('\n*') || paragraph.match(/\n\d+\./)) {
      // This is a paragraph with a list, preserve the list formatting
      // Split into intro and list items
      const lines = paragraph.split('\n');
      const processedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if this line is a list item
        if (line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().match(/^\d+\./)) {
          processedLines.push(line); // Keep list items as-is
        } else if (i === 0 || !lines[i-1].trim().match(/^[-*]|\d+\./)) {
          // This is regular text, not following a list item
          processedLines.push(line);
        } else {
          // This is continuation of a list item, append to previous line
          if (processedLines.length > 0) {
            processedLines[processedLines.length - 1] += ' ' + line.trim();
          }
        }
      }
      
      return processedLines.join('\n');
    } else {
      // Regular paragraph, replace single line breaks with spaces
      return paragraph.replace(/\n/g, ' ');
    }
  })
  .join('\n\n');  // Join paragraphs back with double line breaks

// Ensure proper spacing around lists
formattedBody = formattedBody
  .replace(/:\n(-|\*|\d\.)/g, ':\n\n$1')  // Add blank line before lists after colons
  .replace(/\n\n\n+/g, '\n\n');  // Remove excessive blank lines

console.log("✅ Formatted Email Body (with preserved list formatting):");
console.log("--------------------------------------------------------");
console.log(formattedBody);
console.log("\n");

// Show the difference
console.log("🔍 Key Differences:");
console.log("- List items are preserved on separate lines");
console.log("- Double line breaks between paragraphs are maintained");
console.log("- Single line breaks in regular paragraphs are converted to spaces");
console.log("\n");

// Test edge cases
console.log("🧪 Testing Edge Cases:");
console.log("---------------------");

const edgeCaseResponse = `Dear Client,
Thank you for your inquiry.
We have three options:
- Option 1
- Option 2
- Option 3
Please let me know which works best.
Best regards,
Assistant`;

console.log("Input:");
console.log(edgeCaseResponse);
console.log("\nFormatted:");
const formattedEdgeCase = edgeCaseResponse
  .split('\n\n')
  .map(paragraph => {
    if (paragraph.includes('\n-') || paragraph.includes('\n*') || paragraph.match(/\n\d+\./)) {
      const lines = paragraph.split('\n');
      const processedLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().match(/^\d+\./)) {
          processedLines.push(line);
        } else if (i === 0 || !lines[i-1].trim().match(/^[-*]|\d+\./)) {
          processedLines.push(line);
        } else {
          if (processedLines.length > 0) {
            processedLines[processedLines.length - 1] += ' ' + line.trim();
          }
        }
      }
      return processedLines.join('\n');
    } else {
      return paragraph.replace(/\n/g, ' ');
    }
  })
  .join('\n\n')
  .replace(/:\n(-|\*|\d\.)/g, ':\n\n$1')
  .replace(/\n\n\n+/g, '\n\n');

console.log(formattedEdgeCase);

console.log("\n✨ Email formatting test complete!"); 