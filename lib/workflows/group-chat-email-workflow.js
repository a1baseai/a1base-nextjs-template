const { openai } = require('@ai-sdk/openai');
const { generateText } = require('ai');
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

/**
 * Extracts an email address from a user message using OpenAI
 * @param {string} message - The user's message that might contain an email
 * @returns {Promise<string|null>} The extracted email or null if no valid email found
 */
async function extractEmailFromMessage(message) {
  try {
    console.log('[EmailExtraction] Attempting to extract email from message:', message);
    
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: `You are an email extraction assistant. Extract the email address from the user's message.
If there is a valid email address, return ONLY the email address (e.g., "user@example.com").
If there is no valid email address, return "NO_EMAIL".
Do not include any other text or explanation.`,
      prompt: message,
    });

    const extractedEmail = text.trim();
    
    if (extractedEmail === 'NO_EMAIL' || !extractedEmail.includes('@')) {
      console.log('[EmailExtraction] No valid email found in message');
      return null;
    }

    console.log('[EmailExtraction] Extracted email:', extractedEmail);
    return extractedEmail;
  } catch (error) {
    console.error('[EmailExtraction] Error extracting email:', error);
    return null;
  }
}

/**
 * Sends a group chat link email to the user
 * @param {string} recipientEmail - The recipient's email address
 * @param {string} chatId - The chat ID
 * @param {string} userName - The user's name
 * @returns {Promise<boolean>} True if email was sent successfully
 */
async function sendGroupChatLinkEmail(recipientEmail, chatId, userName) {
  try {
    console.log(`[GroupChatEmail] Sending chat link to ${recipientEmail}`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const chatUrl = `${baseUrl}/chat/${chatId}`;

    const emailDetails = {
      subject: `Your Group Chat Link - Continue the Conversation!`,
      body: `Hello ${userName || 'there'},

Here is your group chat link: ${chatUrl}

You can use this link to return to the conversation at any time. Feel free to share it with others you'd like to invite to the discussion.

Looking forward to continuing our conversation!

Best regards,
Your AI Assistant`,
      recipient_address: recipientEmail
    };

    // Call the SendEmailFromAgent function through an API
    const response = await fetch(`${baseUrl}/api/send-group-chat-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailDetails),
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    console.log('[GroupChatEmail] Email sent successfully');
    return true;
  } catch (error) {
    console.error('[GroupChatEmail] Error sending email:', error);
    return false;
  }
}

/**
 * Handles the email collection flow after a chat summary
 * @param {Object} io - Socket.IO instance
 * @param {string} chatId - The chat ID
 * @param {string} userId - The user's ID
 * @param {string} userName - The user's name
 * @param {string} agentName - The agent's name
 */
async function requestEmailAfterSummary(io, chatId, userId, userName, agentName) {
  try {
    // Wait a moment before asking for email
    await new Promise(resolve => setTimeout(resolve, 2000));

    const emailRequestMessage = {
      id: `email-request-${Date.now()}`,
      content: `By the way, if you'd like me to send you a summary of this chat and a link you can use to return anytime, just share your email address with me! 📧`,
      role: 'assistant',
      timestamp: new Date().toISOString()
    };

    // Send the email request message
    io.to(chatId).emit('new-message', {
      id: emailRequestMessage.id,
      content: emailRequestMessage.content,
      role: emailRequestMessage.role,
      timestamp: emailRequestMessage.timestamp,
      senderName: agentName,
      senderId: 'ai-agent'
    });

    console.log(`[GroupChatEmail] Requested email from ${userName} in chat ${chatId}`);
  } catch (error) {
    console.error('[GroupChatEmail] Error requesting email:', error);
  }
}

module.exports = {
  extractEmailFromMessage,
  sendGroupChatLinkEmail,
  requestEmailAfterSummary
}; 