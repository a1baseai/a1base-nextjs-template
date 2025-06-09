import { NextResponse } from 'next/server';
import { SendEmailFromAgent } from '@/lib/workflows/email_workflow';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subject, body: emailBody, recipient_address } = body;

    if (!subject || !emailBody || !recipient_address) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, body, or recipient_address' },
        { status: 400 }
      );
    }

    // Send the email using the existing SendEmailFromAgent function
    await SendEmailFromAgent({
      subject,
      body: emailBody,
      recipient_address
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Send group chat email error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to send email', details: errorMessage },
      { status: 500 }
    );
  }
} 