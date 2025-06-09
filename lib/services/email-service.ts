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

  async sendWelcomeEmail(recipientEmail: string, userName: string): Promise<A1BaseEmailResponse> {
    const subject = `Hello from Felicie! 🎉`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Hello World</title>
      </head>
      <body>
        <h1>Hello World!</h1>
        <p>Hi ${userName},</p>
        <p>This is Felicie, your AI assistant. Thank you for sharing your email address!</p>
        <p>I'm excited to be part of your journey. Feel free to reach out anytime you need assistance.</p>
        <br>
        <p>Best regards,<br>Felicie 🤖</p>
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