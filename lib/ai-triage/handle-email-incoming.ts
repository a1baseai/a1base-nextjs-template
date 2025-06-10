/**
 * Email Incoming Message Handler
 * 
 * Processes incoming emails from A1Mail webhook and generates AI responses
 */
import { EmailWebhookPayload } from "@/app/api/a1base/email/route";
import { ThreadMessage } from "@/types/chat";
import { GenerateEmailResponse, SendEmailFromAgent } from "../workflows/email_workflow";
import { getInitializedAdapter } from "../supabase/config";

// Constants
const MAX_EMAIL_CONTEXT_MESSAGES = 5;

/**
 * Extract the actual email body from raw email data
 * This is a simple implementation that extracts text content
 */
function extractEmailBody(rawEmailData: string): string {
  try {
    // First, try to find where headers end and body begins
    // Email format typically has headers, then a blank line, then the body
    const doubleNewlineIndex = rawEmailData.search(/\r?\n\r?\n/);
    if (doubleNewlineIndex !== -1) {
      // Get everything after the first double newline
      const afterHeaders = rawEmailData.substring(doubleNewlineIndex).trim();
      
      // Check if this looks like multipart content
      if (afterHeaders.includes('Content-Type:') || afterHeaders.startsWith('--')) {
        // This is a multipart message, use the original parsing logic
        
        // Look for plain text part
        const plainTextMatch = rawEmailData.match(/Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(\r?\n--|\r?\n\r?\n--|\n--|\r\n\.\r\n|$)/);
        if (plainTextMatch && plainTextMatch[1]) {
          return plainTextMatch[1].trim();
        }

        // If no plain text, try to extract from HTML
        const htmlMatch = rawEmailData.match(/Content-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(\r?\n--|\r?\n\r?\n--|\n--|$)/);
        if (htmlMatch && htmlMatch[1]) {
          // Very basic HTML stripping
          return htmlMatch[1]
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .trim();
        }
      } else {
        // Simple email - the body is everything after the headers
        // Remove any trailing dots (SMTP end-of-message indicator)
        const cleanBody = afterHeaders.replace(/\r?\n\.\r?\n$/, '').trim();
        if (cleanBody && !cleanBody.startsWith('Received:') && !cleanBody.startsWith('From:')) {
          return cleanBody;
        }
      }
    }

    // Fallback: Try to find common email body patterns
    const lines = rawEmailData.split(/\r?\n/);
    let bodyStartIndex = -1;
    
    // Find the first empty line after headers
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '' && i > 0) {
        // Check if the next line doesn't look like a header
        if (i + 1 < lines.length && !lines[i + 1].includes(':')) {
          bodyStartIndex = i + 1;
          break;
        }
      }
    }
    
    if (bodyStartIndex !== -1) {
      const bodyLines = lines.slice(bodyStartIndex);
      // Remove SMTP terminator if present
      const body = bodyLines.join('\n').replace(/\r?\n\.\r?\n$/, '').trim();
      if (body) {
        return body;
      }
    }

    // Last resort: return everything after the last header-looking line
    let lastHeaderIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(':') && !lines[i].startsWith(' ') && !lines[i].startsWith('\t')) {
        lastHeaderIndex = i;
      }
    }
    
    if (lastHeaderIndex !== -1 && lastHeaderIndex < lines.length - 1) {
      const remainingLines = lines.slice(lastHeaderIndex + 1);
      const body = remainingLines.join('\n').trim();
      if (body) {
        return body;
      }
    }

    // If all else fails, return the original
    console.warn('[ExtractEmailBody] Could not extract body, returning original');
    return rawEmailData;
  } catch (error) {
    console.error('[ExtractEmailBody] Error extracting email body:', error);
    return rawEmailData;
  }
}

/**
 * Get or create an email thread using the new email_threads table
 */
async function getOrCreateEmailThread(
  senderAddress: string,
  recipientAddress: string,
  subject: string,
  adapter: any
): Promise<string | null> {
  if (!adapter || !adapter.supabase) return null;

  try {
    // Use the PostgreSQL function to get or create thread
    const { data, error } = await adapter.supabase
      .rpc('get_or_create_email_thread', {
        p_sender_email: senderAddress,
        p_recipient_email: recipientAddress,
        p_subject: subject
      });

    if (error) {
      console.error('[GetOrCreateEmailThread] Error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[GetOrCreateEmailThread] Error:', error);
    return null;
  }
}

/**
 * Store email message in the new email_messages table
 */
async function storeEmailMessage(
  adapter: any,
  threadId: string,
  emailPayload: EmailWebhookPayload,
  emailBody: string,
  direction: 'inbound' | 'outbound' = 'inbound'
): Promise<string | null> {
  if (!adapter || !adapter.supabase || !threadId) return null;

  try {
    // Use the PostgreSQL function to store the email
    const { data, error } = await adapter.supabase
      .rpc('store_email_message', {
        p_thread_id: threadId,
        p_email_id: emailPayload.email_id,
        p_direction: direction,
        p_from_address: emailPayload.sender_address,
        p_to_address: emailPayload.recipient_address,
        p_subject: emailPayload.subject,
        p_body_text: emailBody,
        p_raw_email: emailPayload.raw_email_data,
        p_metadata: {
          timestamp: emailPayload.timestamp,
          service: emailPayload.service
        }
      });

    if (error) {
      console.error('[StoreEmailMessage] Error:', error);
      return null;
    }

    console.log(`[StoreEmailMessage] Stored ${direction} email ${emailPayload.email_id} in thread ${threadId}`);
    return data;
  } catch (error) {
    console.error('[StoreEmailMessage] Error storing email:', error);
    return null;
  }
}

/**
 * Get recent email messages from thread for context
 */
async function getEmailThreadContext(
  adapter: any,
  threadId: string | null,
  currentEmailBody: string,
  currentSubject: string,
  currentSender: string
): Promise<ThreadMessage[]> {
  const messages: ThreadMessage[] = [];

  if (adapter && adapter.supabase && threadId) {
    try {
      // Get recent messages from the thread
      const { data: emailMessages, error } = await adapter.supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(MAX_EMAIL_CONTEXT_MESSAGES);

      if (error) {
        console.error('[GetEmailThreadContext] Error fetching messages:', error);
      } else if (emailMessages && emailMessages.length > 0) {
        // Convert email messages to ThreadMessage format
        for (const email of emailMessages) {
          // Skip the current email if it's already stored
          if (email.email_id === currentSender) continue;
          
          const isAgent = email.from_address === process.env.A1BASE_AGENT_EMAIL;
          
          messages.push({
            role: isAgent ? 'assistant' : 'user',
            content: `Subject: ${email.subject}\n\n${email.body_text || ''}`,
            timestamp: email.created_at,
            sender_number: email.from_address,
            sender_name: email.from_address.split('@')[0], // Simple name extraction
            message_id: email.id,
            message_type: 'text',
            message_content: { 
              text: email.body_text
            }
          });
        }
      }
    } catch (error) {
      console.error('[GetEmailThreadContext] Error fetching thread context:', error);
    }
  }

  // Add current email to context
  messages.push({
    role: 'user',
    content: `Subject: ${currentSubject}\n\n${currentEmailBody}`,
    timestamp: new Date().toISOString(),
    sender_number: currentSender,
    sender_name: currentSender.split('@')[0],
    message_id: Date.now().toString(),
    message_type: 'text',
    message_content: { text: currentEmailBody }
  });

  return messages;
}

/**
 * Store AI response email in the database
 */
async function storeAIResponseEmail(
  adapter: any,
  threadId: string,
  fromAddress: string,
  toAddress: string,
  subject: string,
  body: string
): Promise<void> {
  if (!adapter || !threadId) return;

  const responsePayload: EmailWebhookPayload = {
    email_id: `ai-response-${Date.now()}`,
    subject,
    sender_address: fromAddress,
    recipient_address: toAddress,
    timestamp: new Date().toISOString(),
    service: 'email',
    raw_email_data: `From: ${fromAddress}\nTo: ${toAddress}\nSubject: ${subject}\n\n${body}`
  };

  await storeEmailMessage(adapter, threadId, responsePayload, body, 'outbound');
}

/**
 * Main handler for incoming emails
 */
export async function handleEmailIncoming(
  emailPayload: EmailWebhookPayload
): Promise<void> {
  // Do not reply to mailer-daemon or no-reply addresses to avoid loops
  const senderAddress = emailPayload.sender_address.toLowerCase();
  if (
    senderAddress.startsWith('mailer-daemon@') ||
    senderAddress.includes('no-reply')
  ) {
    console.log(
      `[EmailHandler] Received automated email from ${emailPayload.sender_address}, skipping auto-reply.`
    );
    return;
  }

  console.log(
    `[EmailHandler] Processing email from ${emailPayload.sender_address} with subject: ${emailPayload.subject}`
  );

  try {
    // 1. Extract email body from raw email data
    const emailBody = extractEmailBody(emailPayload.raw_email_data);
    console.log(`[EmailHandler] Extracted email body: ${emailBody.substring(0, 100)}...`);

    // 2. Get database adapter
    const adapter = await getInitializedAdapter();

    // 3. Get or create email thread
    const threadId = await getOrCreateEmailThread(
      emailPayload.sender_address,
      emailPayload.recipient_address,
      emailPayload.subject,
      adapter
    );

    if (!threadId) {
      throw new Error('Failed to create or retrieve email thread');
    }

    // 4. Store incoming email
    await storeEmailMessage(adapter, threadId, emailPayload, emailBody, 'inbound');

    // 5. Get thread context for AI
    const threadMessages = await getEmailThreadContext(
      adapter,
      threadId,
      emailBody,
      emailPayload.subject,
      emailPayload.sender_address
    );

    // 6. Generate AI response using the existing system
    const aiResponse = await GenerateEmailResponse(
      threadMessages,
      emailPayload.sender_address,
      emailPayload.subject
    );

    console.log(`[EmailHandler] Generated AI response: ${aiResponse.body.substring(0, 100)}...`);

    // 7. Prepare email reply
    const replySubject = aiResponse.subject;

    // 8. Send email response
    const emailDetails = {
      subject: replySubject,
      body: aiResponse.body,
      recipient_address: emailPayload.sender_address
    };

    const sendResult = await SendEmailFromAgent(emailDetails);
    console.log(`[EmailHandler] Email send result: ${sendResult}`);

    // 9. Store AI response in database
    if (adapter && process.env.A1BASE_AGENT_EMAIL) {
      await storeAIResponseEmail(
        adapter,
        threadId,
        process.env.A1BASE_AGENT_EMAIL,
        emailPayload.sender_address,
        replySubject,
        aiResponse.body
      );
      
      console.log(`[EmailHandler] Stored AI response in thread ${threadId}`);
    }

    console.log(`[EmailHandler] Successfully processed and responded to email ${emailPayload.email_id}`);
  } catch (error) {
    console.error(`[EmailHandler] Error processing email ${emailPayload.email_id}:`, error);
    
    // Attempt to send an error notification email
    try {
      const errorEmailDetails = {
        subject: `Re: ${emailPayload.subject}`,
        body: "I apologize, but I encountered an error while processing your email. Please try again later or contact support if the issue persists.",
        recipient_address: emailPayload.sender_address
      };
      
      await SendEmailFromAgent(errorEmailDetails);
    } catch (sendError) {
      console.error('[EmailHandler] Failed to send error notification email:', sendError);
    }
  }
} 