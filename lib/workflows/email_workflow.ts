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
    // Convert single line breaks to double line breaks for paragraph separation
    // But preserve existing double line breaks
    responseBody = responseBody
      .split('\n\n')  // Split by existing double line breaks
      .map(paragraph => paragraph.replace(/\n/g, ' '))  // Replace single line breaks with spaces within paragraphs
      .join('\n\n');  // Join paragraphs back with double line breaks

    // Ensure there are double line breaks before lists
    responseBody = responseBody.replace(/:\n(-|\*|\d\.)/g, ':\n\n$1');
    
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
    
    // According to A1Mail documentation, the email data structure should include headers
    const emailData = {
      sender_address: trimmedSenderEmail,
      recipient_address: trimmedRecipientEmail,
      subject: emailDetails.subject,
      body: emailDetails.body,
      headers: {} // Add empty headers object as the API seems to expect this
    };

    console.log(`[SendEmailFromAgent] Full email payload being sent to A1Base:`, JSON.stringify(emailData, null, 2));
    console.log(`[SendEmailFromAgent] Using A1Base Account ID: ${A1BASE_ACCOUNT_ID}`);

    const response = await a1BaseClient.sendEmailMessage(A1BASE_ACCOUNT_ID, emailData);
    
    console.log(`[SendEmailFromAgent] A1Base API Response:`, response);
    
    // Check if the response indicates an error (handle both nested and direct status)
    if (response && typeof response === 'object') {
      // Check for direct status field
      if ('status' in response && (response as any).status === 'error') {
        const errorMessage = (response as any).message || 'Unknown error from A1Base API';
        console.error(`[SendEmailFromAgent] A1Base API returned error: ${errorMessage}`);
        throw new Error(`Failed to send email: ${errorMessage}`);
      }
      
      // Check for nested data.status field (the actual response structure)
      if ('data' in response && typeof (response as any).data === 'object') {
        const data = (response as any).data;
        if (data.status === 'error') {
          const errorMessage = data.message || 'Unknown error from A1Base API';
          console.error(`[SendEmailFromAgent] A1Base API returned error: ${errorMessage}`);
          throw new Error(`Failed to send email: ${errorMessage}`);
        }
      }
      
      // Check for success: false pattern
      if ('success' in response && !(response as any).success) {
        const errorMessage = (response as any).message || (response as any).error || 'Email send failed';
        console.error(`[SendEmailFromAgent] A1Base API returned failure: ${errorMessage}`);
        throw new Error(`Failed to send email: ${errorMessage}`);
      }
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