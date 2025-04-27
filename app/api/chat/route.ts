import { NextResponse } from "next/server";
import { getSystemPrompt } from "../../../lib/agent/system-prompt";
import { triageMessage } from "../../../lib/ai-triage/triage-logic";
import { dynamic, runtime, maxDuration } from "../route-config";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { handleAgenticOnboarding } from "../../../lib/workflows/agentic-onboarding-workflows";

// Export the route configuration to prevent Next.js from trying
// to access file system during build time
export { dynamic, runtime, maxDuration };

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
      
      // Check if this is an agentic onboarding message (contains "Collect the following information:")
      const isAgenticOnboarding = responseMessage.includes('Collect the following information:');
      
      if (isAgenticOnboarding) {
        console.log('[CHAT-API] Detected agentic onboarding message, delegating to dedicated module');
        
        // Use our dedicated agentic onboarding handler
        return await handleAgenticOnboarding(responseMessage);
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
      model: openai('gpt-4'),
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