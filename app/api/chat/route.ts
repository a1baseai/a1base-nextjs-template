import { NextResponse } from "next/server";
import { getSystemPrompt } from "../../../lib/agent/system-prompt";
import { triageMessage } from "../../../lib/ai-triage/triage-logic";
// Define route configuration directly in this file
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { formatMessagesForOpenAI } from "../../../lib/services/openai";

// Check if we're in a build context
const isBuildTime = () => {
  return process.env.NODE_ENV === 'production' && 
         (process.env.NEXT_PHASE === 'phase-production-build' || 
          !process.env.OPENAI_API_KEY);
};

export async function POST(req: Request) {
  console.log('\n\n[CHAT-API] Received chat request');
  try {
    // Parse the request to get messages
    const { messages } = await req.json();
    console.log(`[CHAT-API] Request contains ${messages.length} messages`);

    // Handle build-time context without API keys
    if (isBuildTime()) {
      console.log('[CHAT-API] Build-time context detected, returning static response');
      return NextResponse.json({ 
        response: "This is a build-time placeholder response."
      });
    }
    
    // Get the system prompt with agent profile
    const systemPromptContent = await getSystemPrompt();
    console.log(`[CHAT-API] System prompt loaded (${systemPromptContent.length} chars)`);
    
    // Extract info for logging
    const profileMatch = systemPromptContent.match(/Name: ([^\n]+)/);
    const companyMatch = systemPromptContent.match(/Company: ([^\n]+)/);
    if (profileMatch && profileMatch[1]) {
      console.log(`[CHAT-API] Using agent: ${profileMatch[1]}, ${companyMatch?.[1] || 'Unknown'}`);
    }
    
    // Extract the most recent user message for triage
    const userMessage = messages[messages.length - 1];
    const messageContent = typeof userMessage?.content === 'string' 
      ? userMessage.content 
      : Array.isArray(userMessage?.content) && userMessage.content[0]?.text 
        ? userMessage.content[0].text 
        : 'Hello';
    
    // Run message through triage
    const triageResponse = await triageMessage({
      thread_id: 'webchat',
      message_id: Date.now().toString(),
      content: messageContent,
      message_type: 'text',
      message_content: { text: messageContent },
      sender_name: 'WebUser',
      sender_number: 'web',
      thread_type: 'individual',
      timestamp: new Date().toISOString(),
      messagesByThread: new Map([['webchat', [{ 
        message_id: Date.now().toString(),
        content: messageContent,
        message_type: 'text',
        message_content: { text: messageContent },
        sender_number: 'web',
        sender_name: 'WebUser',
        timestamp: new Date().toISOString(),
      }]]]),
      service: 'web-ui',
    });
    
    console.log(`[CHAT-API] Triage result: ${triageResponse.type}`);
    
    // For non-default triage types, create a direct streaming response without using the AI model
    if (triageResponse.type !== 'default') {
      console.log('[CHAT-API] Creating direct stream for non-default triage response');
      const responseMessage = triageResponse.message || 'No response message available';
      
      // Check if this is an onboarding message (contains "Collect the following information:")
      const isOnboardingMessage = responseMessage.includes('Collect the following information:');
      
      if (isOnboardingMessage) {
        console.log('[CHAT-API] Detected onboarding message');
        
        // Use a standard approach for onboarding messages
        const result = streamText({
          model: openai('gpt-4.1'),
          system: "You are an assistant helping with onboarding. Guide the user through the onboarding process, asking one question at a time.",
          messages: [
            {
              role: "assistant",
              content: "Hello! I'm here to help you get set up. Let me ask you a few questions to personalize your experience."
            },
            {
              role: "user",
              content: "Start onboarding"
            }
          ],
          temperature: 0.7,
          maxTokens: 1000,
        });
        
        return result.toDataStreamResponse();
      }
      
      // For regular non-agentic responses, just stream the message directly
      console.log('[CHAT-API] Using OpenAI API for streaming a regular message');
      
      const result = streamText({
        model: openai('gpt-3.5-turbo'),
        system: "You are an assistant helping with onboarding. Return ONLY the message provided to you without any modifications.",
        messages: [
          {
            role: "user",
            content: `Return exactly this text, with no modifications or additional text: ${responseMessage}`
          }
        ],
        temperature: 0,
        maxTokens: 1000,
      });
      
      return result.toDataStreamResponse();
    }

    // Since we're using the Vercel AI SDK which expects a specific format,
    // we'll go back to the original approach but incorporate our normalization logic
    
    // Prepare messages array with system prompt
    const aiMessages = [
      { role: 'system', content: systemPromptContent },
      ...messages.map((msg: { role: string; content: any }) => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : 
                Array.isArray(msg.content) && msg.content[0]?.text ? 
                msg.content[0].text : String(msg.content)
      }))
    ];
    
    // Log the triage message if present
    if (triageResponse.message) {
      console.log(`[CHAT-API] Using triage message: ${triageResponse.message.substring(0, 50)}...`);
    }
    
    // Use Vercel AI SDK to stream the response
    const result = streamText({
      model: openai('gpt-4.1'),
      messages: aiMessages,
      temperature: 0.7,
    });
    
    console.log('[CHAT-API] Streaming response');
    return result.toDataStreamResponse();
    
  } catch (error) {
    console.error('[CHAT-API] Error in chat API:', error);
    return NextResponse.json({ 
      error: 'Failed to generate response', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}