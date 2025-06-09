import { NextResponse } from 'next/server';
import { EmailService } from '@/lib/services/email-service';
import { generateChatSummary } from '@/lib/workflows/chat_workflow.js';

// Initialize email service
const emailService = new EmailService();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chatId, userMessage, userName, userId } = body;

    // Check if the message contains an email
    if (userMessage.includes('@') && userMessage.includes('.')) {
      const email = userMessage.trim();
      
      // Send acknowledgment message through the existing chat API
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/chat/socket-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          message: {
            id: `ack-${Date.now()}`,
            content: `Thank you for sharing your email! I'm sending you a welcome message to ${email} right now... 📧`,
            role: 'assistant',
            timestamp: new Date().toISOString()
          },
          userId: 'ai-agent',
          userName: 'Felicie'
        })
      });

      // Send the welcome email
      try {
        // Generate a summary of the chat history
        const summary = await generateChatSummary(chatId);
        
        // Send the welcome email with the summary
        await emailService.sendWelcomeEmail(email, userName, summary);
        
        // Send success message
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/chat/socket-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            message: {
              id: `confirm-${Date.now()}`,
              content: "✅ I've sent you a welcome email with a summary of our conversation! Check your inbox for the details.",
              role: 'assistant',
              timestamp: new Date().toISOString()
            },
            userId: 'ai-agent',
            userName: 'Felicie'
          })
        });
        
        return NextResponse.json({ success: true, emailSent: true });
      } catch (error) {
        // Send error message
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/chat/socket-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            message: {
              id: `error-${Date.now()}`,
              content: "I'm sorry, I couldn't send the email. Please make sure the email address is correct and try again.",
              role: 'assistant',
              timestamp: new Date().toISOString()
            },
            userId: 'ai-agent',
            userName: 'Felicie'
          })
        });
        
        throw error;
      }
    }

    return NextResponse.json({ success: true, emailSent: false });
  } catch (error) {
    console.error('[API] Email triage error:', error);
    return NextResponse.json(
      { error: 'Failed to process email triage' },
      { status: 500 }
    );
  }
} 