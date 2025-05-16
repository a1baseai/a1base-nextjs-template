import { NextRequest, NextResponse } from 'next/server';
// Define route configuration directly in this file
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
import { loadOnboardingFlowFromFile } from '@/lib/storage/server-file-storage';
import { defaultOnboardingFlow, OnboardingMessage } from '@/lib/onboarding-flow/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET handler for streaming onboarding flow as chat messages
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get('threadId') || uuidv4();
  const service = searchParams.get('service') || 'web';

  try {
    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('🔄 [API] Streaming onboarding flow messages...');
          
          // Load onboarding flow from file or use default
          let flow = await loadOnboardingFlowFromFile();
          if (!flow || !flow.enabled) {
            flow = defaultOnboardingFlow;
          }

          // Filter and sort messages
          const messages = flow.messages
            .filter(msg => msg.text && msg.text.trim() !== '')
            .sort((a, b) => a.order - b.order);

          if (messages.length === 0) {
            throw new Error('No valid onboarding messages found');
          }

          // Stream each message with a delay
          for (const message of messages) {
            const chatMessage = formatAsChatMessage(message, threadId, service);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chatMessage)}\n\n`));
            
            // Only add delay between messages when not waiting for response
            if (!message.waitForResponse && messages.indexOf(message) < messages.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
            }
          }

          // Close the stream
          controller.close();
        } catch (error) {
          console.error('❌ [API] Error streaming onboarding flow:', error);
          controller.error(error);
        }
      }
    });

    // Return the stream as a response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('❌ [API] Error setting up onboarding chat stream:', error);
    return NextResponse.json(
      { error: 'Failed to stream onboarding flow' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for triggering onboarding flow for WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const { threadId, phoneNumber } = await request.json();
    
    if (!threadId || !phoneNumber) {
      return NextResponse.json(
        { error: 'Missing threadId or phoneNumber' },
        { status: 400 }
      );
    }

    // Load onboarding flow from file or use default
    let flow = await loadOnboardingFlowFromFile();
    if (!flow || !flow.enabled) {
      flow = defaultOnboardingFlow;
    }

    // We'll return the messages for the caller to use with WhatsApp API
    // The actual sending will be handled by the caller
    const messages = flow.messages
      .filter(msg => msg.text && msg.text.trim() !== '')
      .sort((a, b) => a.order - b.order)
      .map(msg => formatAsWhatsAppMessage(msg, threadId, phoneNumber));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('❌ [API] Error preparing onboarding messages for WhatsApp:', error);
    return NextResponse.json(
      { error: 'Failed to prepare onboarding messages' },
      { status: 500 }
    );
  }
}

/**
 * Format an onboarding message as a chat message
 */
function formatAsChatMessage(message: OnboardingMessage, threadId: string, service: string) {
  const timestamp = new Date().toISOString();
  
  return {
    id: message.id,
    threadId: threadId,
    message: message.text,
    waitForResponse: message.waitForResponse,
    timestamp: timestamp,
    role: 'assistant',
    order: message.order,
    service: service,
    messageType: 'onboarding'
  };
}

/**
 * Format an onboarding message for WhatsApp
 */
function formatAsWhatsAppMessage(message: OnboardingMessage, threadId: string, recipientNumber: string) {
  const timestamp = new Date().toISOString();
  
  return {
    message_id: `onboarding-${message.id}-${Date.now()}`,
    thread_id: threadId,
    content: message.text,
    message_type: 'text',
    message_content: {
      text: message.text
    },
    sender_name: process.env.A1BASE_AGENT_NAME || 'AI Assistant',
    sender_number: process.env.A1BASE_AGENT_NUMBER || '+12345678901',
    recipient_number: recipientNumber,
    thread_type: 'individual',
    timestamp: timestamp,
    wait_for_response: message.waitForResponse,
    order: message.order,
    service: 'whatsapp',
    is_onboarding: true
  };
}
