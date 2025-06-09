import axios from 'axios';

interface EmailHeaders {
  cc?: string;
  bcc?: string;
  [key: string]: string | undefined;
}

interface SendEmailParams {
  recipient_address: string;
  subject: string;
  body: string;
  headers?: EmailHeaders;
}

interface A1BaseEmailResponse {
  status: 'success' | 'error';
  message?: string;
  email_id?: string;
}

export class EmailService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly accountId: string;
  private readonly senderAddress: string;

  constructor() {
    // These should be in your environment variables
    this.apiKey = process.env.A1BASE_API_KEY || '';
    this.apiSecret = process.env.A1BASE_API_SECRET || '';
    this.accountId = process.env.A1BASE_ACCOUNT_ID || '';
    this.senderAddress = process.env.A1BASE_AGENT_EMAIL || '';
    this.apiUrl = `https://api.a1base.com/v1/emails/${this.accountId}/send`;

    if (!this.apiKey || !this.apiSecret || !this.accountId || !this.senderAddress) {
      throw new Error('Missing required A1Base configuration');
    }
  }

  async sendEmail({
    recipient_address,
    subject,
    body,
    headers = {}
  }: SendEmailParams): Promise<A1BaseEmailResponse> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          sender_address: this.senderAddress,
          recipient_address,
          subject,
          body,
          headers
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'X-API-Secret': this.apiSecret,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to send email: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async sendChatInvite(recipientEmail: string, chatId: string, userName: string): Promise<A1BaseEmailResponse> {
    const subject = `${userName} invited you to continue the conversation`;
    
    // Get the base URL from environment or default to localhost in development
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
    
    const chatUrl = `${baseUrl}/chat/${chatId}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Continue the Conversation</title>
      </head>
      <body>
        <p>Hi there!</p>
        <p>${userName} has invited you to continue your conversation in the group chat.</p>
        <p>You can access the chat anytime by clicking this link:</p>
        <p><a href="${chatUrl}">${chatUrl}</a></p>
        <p>Looking forward to continuing our conversation!</p>
        <br>
        <p>Best regards,<br>Felicie</p>
      </body>
      </html>
    `;

    return this.sendEmail({
      recipient_address: recipientEmail,
      subject,
      body: htmlBody
    });
  }

  async sendWelcomeEmail(recipientEmail: string, userName: string, summary_content?: string): Promise<A1BaseEmailResponse> {
    const subject = `Hello from Felicie! 🎉`;
    
    // Build the email body with optional summary
    let summarySection = '';
    if (summary_content) {
      summarySection = `
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">Here's what's been happening in the conversation:</h2>
          <div style="white-space: pre-wrap;">${summary_content}</div>
        </div>
      `;
    }
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Hello World</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1>Welcome to the conversation, ${userName}! 🎉</h1>
        <p>Hi ${userName},</p>
        <p>This is ${process.env.AGENT_NAME}, your A1 Zap. Thank you for sharing your email address!</p>
        <p>I'm excited to help you build your own A1 agent! Want to learn more? Join our group chat with founders Pasha, Pennie and their A1 Zap agent to get started.</p>
        ${summarySection}
        <br>
        <p>Best regards,<br>${process.env.AGENT_NAME} 🤖</p>
      </body>
      </html>
    `;

    return this.sendEmail({
      recipient_address: recipientEmail,
      subject,
      body: htmlBody
    });
  }
}

// Export a singleton instance
export const emailService = new EmailService(); 