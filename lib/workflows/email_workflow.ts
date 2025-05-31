/**
 * Email Workflow Functions
 * 
 * Handles all email-related operations including:
 * - Constructing email drafts from conversations
 * - Sending emails via A1Base API
 * - Creating email addresses
 * - Professional email formatting and responses
 */

import { A1BaseAPI } from "a1base-node";
import { ThreadMessage } from "@/types/chat";
import { generateAgentResponse } from "../services/openai";
import { emailWorkflowPrompt } from "./email_workflow_prompt";

// Initialize A1Base client
const a1BaseClient = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

const A1BASE_ACCOUNT_ID = process.env.A1BASE_ACCOUNT_ID!;
const A1BASE_AGENT_EMAIL = process.env.A1BASE_AGENT_EMAIL?.trim() || "";
const DEFAULT_EMAIL_DOMAIN = "a1send.com";

/**
 * Generates a professional email response to an incoming email
 * @param threadMessages - Array of messages in the email thread
 * @param senderEmail - Email address of the sender
 * @param subject - Subject of the incoming email
 * @returns A promise that resolves to a professional email response
 */
export async function GenerateEmailResponse(
  threadMessages: ThreadMessage[],
  senderEmail: string,
  subject: string
): Promise<{ subject: string; body: string }> {
  console.log("[GenerateEmailResponse] Generating professional email response");
  
  try {
    // Use the email-specific prompt for professional responses
    const aiResponse = await generateAgentResponse(
      threadMessages,
      emailWorkflowPrompt.professional_email_response.user,
      'individual', // Email is always individual
      [], // No participants needed for email
      [], // No projects
      'email'
    );

    // Parse the response to extract subject and body
    const lines = aiResponse.split('\n');
    let responseSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    let responseBody = aiResponse;

    // Check if the AI provided a specific subject line
    if (lines[0].toLowerCase().startsWith('subject:')) {
      responseSubject = lines[0].substring(8).trim();
      responseBody = lines.slice(1).join('\n').trim();
    }

    // Format the email body for proper display
    // Handle lists and paragraphs differently
    responseBody = responseBody
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
    responseBody = responseBody
      .replace(/:\n(-|\*|\d\.)/g, ':\n\n$1')  // Add blank line before lists after colons
      .replace(/\n\n\n+/g, '\n\n');  // Remove excessive blank lines

    // Log the formatted response for debugging
    console.log("[GenerateEmailResponse] Formatted email body:");
    console.log(responseBody);

    return { 
      subject: responseSubject, 
      body: responseBody 
    };
  } catch (error) {
    console.error("[GenerateEmailResponse] Error generating email response:", error);
    throw error;
  }
}

/**
 * Constructs an email draft from the conversation thread using an AI model.
 * The AI is expected to return a string with "subject---body".
 * @param threadMessages - Array of messages in the thread.
 * @returns A promise that resolves to an object with email subject and body.
 * @throws Throws an error if email generation fails.
 */
export async function ConstructEmail(
  threadMessages: ThreadMessage[]
): Promise<{ subject: string; body: string }> {
  console.log("[ConstructEmail] Generating email draft from thread messages.");
  try {
    const aiResponse = await generateAgentResponse(
      threadMessages,
      emailWorkflowPrompt.email_draft.user
    );

    // Expected format: "Subject of the email---Body of the email"
    const emailParts = aiResponse.split("---");
    const subject = emailParts[0]?.trim() || "Email from A1Base Agent"; // Default subject
    const body = emailParts[1]?.trim() || aiResponse; // Default body if split fails

    console.log("[ConstructEmail] Email draft constructed successfully.");
    return { subject, body };
  } catch (error) {
    console.error("[ConstructEmail] Error generating email draft:", error);
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Sends an email from the agent using A1Base API.
 * @param emailDetails - Object containing subject, body, and recipient_address.
 * @returns A promise that resolves to a confirmation message.
 * @throws Throws an error if sending email fails.
 */
export async function SendEmailFromAgent(
  emailDetails: {
    subject: string;
    body: string;
    recipient_address: string;
  }
): Promise<string> {
  console.log(`[SendEmailFromAgent] Attempting to send email to: ${emailDetails.recipient_address}`);
  console.log(`[SendEmailFromAgent] Email subject: ${emailDetails.subject}`);
  console.log(`[SendEmailFromAgent] Email body preview: ${emailDetails.body.substring(0, 100)}...`);
  
  if (!A1BASE_ACCOUNT_ID || !A1BASE_AGENT_EMAIL) {
    console.error("[SendEmailFromAgent] Missing A1Base Account ID or Agent Email in environment variables.");
    console.error(`[SendEmailFromAgent] A1BASE_ACCOUNT_ID: ${A1BASE_ACCOUNT_ID ? 'SET' : 'MISSING'}`);
    console.error(`[SendEmailFromAgent] A1BASE_AGENT_EMAIL: ${A1BASE_AGENT_EMAIL ? A1BASE_AGENT_EMAIL : 'MISSING'}`);
    throw new Error("Email sending service is not properly configured.");
  }

  try {
    // Trim whitespace from email addresses to avoid issues
    const trimmedSenderEmail = A1BASE_AGENT_EMAIL.trim();
    const trimmedRecipientEmail = emailDetails.recipient_address.trim();
    
    let rawTextContent = emailDetails.body; 
    
    // Normalize line endings from AI response
    rawTextContent = rawTextContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // --- Minimal HTML Conversion (NO CONTENT ESCAPING) ---
    // Convert double newlines to paragraph breaks
    let htmlBodyContent = rawTextContent.replace(/\n\n/g, '</p><p>');
    // Convert single newlines to line breaks
    htmlBodyContent = htmlBodyContent.replace(/\n/g, '<br />');
    // Wrap the whole content in a starting and ending <p> tag if not already present
    // and ensure it's not just whitespace or <br /> tags.
    if (htmlBodyContent.trim() && !htmlBodyContent.trim().toLowerCase().startsWith('<p>')) {
      htmlBodyContent = '<p>' + htmlBodyContent;
    }
    if (htmlBodyContent.trim() && !htmlBodyContent.trim().toLowerCase().endsWith('</p>')) {
      htmlBodyContent = htmlBodyContent + '</p>';
    }
    // Cleanup: Remove empty paragraphs that might result from multiple newlines
    htmlBodyContent = htmlBodyContent.replace(/<p>\s*(<br\s*\/>\s*)*<\/p>/g, '');
    htmlBodyContent = htmlBodyContent.replace(/<p><\/p>/g, '');

    const finalHtmlBody = htmlBodyContent.trim() || '<p>&nbsp;</p>'; // Ensure body is not empty
    // --- End of Minimal HTML Conversion ---

    // Construct the full HTML document as per A1Mail documentation
    const emailHtmlDocument = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>${emailDetails.subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title> <!-- Escape title only -->
<style>
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
p { margin: 0 0 1em 0; }
</style>
</head>
<body>
${finalHtmlBody}
</body>
</html>`;
    
    console.log('[SendEmailFromAgent] Final HTML email body (minimal processing, no content escape):');
    console.log(emailHtmlDocument);
    console.log('[SendEmailFromAgent] Body length:', emailHtmlDocument.length);
    
    const emailData = {
      sender_address: trimmedSenderEmail,
      recipient_address: trimmedRecipientEmail,
      subject: emailDetails.subject,
      body: emailHtmlDocument, 
      headers: {} 
    };
    
    console.log(`[SendEmailFromAgent] Full email payload being sent to A1Base:`, JSON.stringify(emailData, null, 2));
    console.log(`[SendEmailFromAgent] Using A1Base Account ID: ${A1BASE_ACCOUNT_ID}`);

    // IMPORTANT: The a1base-node SDK has a bug where it strips < and > from the body
    // We need to call the API directly to send HTML emails
    try {
      const apiUrl = `https://api.a1base.com/v1/emails/${A1BASE_ACCOUNT_ID}/send`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.A1BASE_API_KEY!,
          'X-API-Secret': process.env.A1BASE_API_SECRET!
        },
        body: JSON.stringify(emailData)
      });

      const responseData = await response.json();
      console.log(`[SendEmailFromAgent] A1Base API Response:`, responseData);

      if (!response.ok || responseData.status === 'error') {
        const errorMessage = responseData.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error(`[SendEmailFromAgent] A1Base API returned error: ${errorMessage}`);
        throw new Error(`Failed to send email: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error(`[SendEmailFromAgent] Error calling A1Base API directly:`, error);
      throw error;
    }
    
    const successMessage = "Email sent successfully.";
    console.log(`[SendEmailFromAgent] ${successMessage}`);
    console.log(`[SendEmailFromAgent] Email details - From: ${trimmedSenderEmail}, To: ${trimmedRecipientEmail}`);
    
    return successMessage;
  } catch (error: any) {
    console.error("[SendEmailFromAgent] Error sending email:", error);
    console.error(`[SendEmailFromAgent] Error details:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      stack: error.stack
    });
    
    // Log the full error object
    console.error(`[SendEmailFromAgent] Full error object:`, JSON.stringify(error, null, 2));
    
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Creates a new email address for the agent via A1Base API.
 * @param emailAddress - The local part of the email address (e.g., "support").
 * @param domain - The domain for the email address (defaults to "a1send.com").
 * @returns A promise that resolves to a confirmation message.
 * @throws Throws an error if email address creation fails.
 */
export async function CreateEmailAddress(
  emailAddress: string,
  domain: string = DEFAULT_EMAIL_DOMAIN
): Promise<string> {
  const fullEmail = `${emailAddress}@${domain}`;
  console.log(`[CreateEmailAddress] Attempting to create email address: ${fullEmail}`);

  if (!A1BASE_ACCOUNT_ID) {
    console.error("[CreateEmailAddress] Missing A1Base Account ID in environment variables.");
    throw new Error("Email address creation service is not properly configured.");
  }

  try {
    const emailData = {
      address: emailAddress, // API might expect just the local part
      domain_name: domain,
    };

    await a1BaseClient.createEmailAddress(A1BASE_ACCOUNT_ID, emailData);
    const successMessage = `Email address ${fullEmail} created successfully.`;
    console.log(`[CreateEmailAddress] ${successMessage}`);
    return successMessage;
  } catch (error) {
    console.error(`[CreateEmailAddress] Error creating email address ${fullEmail}:`, error);
    throw error; // Re-throw to be handled by the caller
  }
}