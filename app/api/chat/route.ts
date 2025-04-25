import { NextResponse } from "next/server";
import { getSystemPrompt } from "../../../lib/agent/system-prompt";
import { triageMessage } from "../../../lib/ai-triage/triage-logic";
import { dynamic, runtime, maxDuration } from "../route-config";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

// Check if we're in a build context
const isBuildTime = () => {
  return process.env.NODE_ENV === 'production' && 
         (process.env.NEXT_PHASE === 'phase-production-build' || 
          !process.env.OPENAI_API_KEY);
};

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // Get the system prompt (with user-customized profile settings and base information)
  const systemPromptContent = await getSystemPrompt();
  
  // DEBUG: Log the system prompt to see what profile settings are being used
  console.log('\n\n====== SYSTEM PROMPT BEING USED IN CHAT ======');
  console.log(systemPromptContent);
  console.log('===============================================\n\n');
  
  const systemMessage = { role: "system", content: systemPromptContent };
  const modifiedMessages = [systemMessage, ...messages];

  // console.log(
  //   "Messages:",
  //   messages.map((msg: any) => ({
  //     role: msg.role,
  //     content: msg.content[0]?.text || msg.content,
  //     timestamp: new Date().toISOString(),
  //   }))
  // );

  // Set up dummy values for web chat where thread_id and other parameters are not available
  const dummyThreadId = "webchat";
  const dummySenderName = "WebUser";
  const dummySenderNumber = "web";
  const dummyThreadType = "individual";
  const dummyMessageId = Date.now().toString();
  const dummyTimestamp = new Date().toISOString();
  const dummyService = "web-ui";

  // Extract the content from the most recent message (assumes user message is last)
  const lastMessage = messages[messages.length - 1];
  const messageContent = lastMessage.content[0]?.text || lastMessage.content;

  // Create an in-memory message record and map for the triage function
  const dummyMessageRecord = {
    message_id: dummyMessageId,
    content: messageContent,
    message_type: 'text',
    message_content: {
      text: messageContent
    },
    sender_number: dummySenderNumber,
    sender_name: dummySenderName,
    timestamp: dummyTimestamp,
  };

  const messagesByThread = new Map();
  messagesByThread.set(dummyThreadId, [dummyMessageRecord]);

  try {
    // Run the triage logic using the dummy data suitable for web chat
    const triageResponse = await triageMessage({
      thread_id: dummyThreadId,
      message_id: dummyMessageId,
      content: messageContent,
      message_type: 'text',
      message_content: {
        text: messageContent
      },
      sender_name: dummySenderName,
      sender_number: dummySenderNumber,
      thread_type: dummyThreadType,
      timestamp: dummyTimestamp,
      messagesByThread,
      service: dummyService,
    });

    console.log("[POST] Triage Response:", triageResponse);

    // Base on triage results, either provide a simple response or generate with AI
    if (triageResponse.type !== 'default') {
      // For special responses from triage, just return the message without streaming
      return NextResponse.json({ 
        response: triageResponse.message || 'No response message available' 
      });
    }
    
    try {
      // For special triage responses (not requiring AI), return directly without streaming
      if (triageResponse.type !== 'default') {
        return NextResponse.json({ 
          response: triageResponse.message || 'No response message available' 
        });
      }
      
      // For triaged responses with a pre-determined message, format it as JSON
      if (triageResponse.type !== 'default') {
        return NextResponse.json({ 
          response: triageResponse.message || 'No response message available' 
        });
      }
      
      try {
        // Handle build-time context without API keys
        if (isBuildTime()) {
          console.log('Build-time context detected, returning static response');
          return NextResponse.json({ 
            response: "This is a build-time placeholder response."
          });
        }
        
        // Define the messages in the correct format
        const aiMessages = modifiedMessages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : 
                  Array.isArray(msg.content) && msg.content[0]?.type === 'text' ? 
                  msg.content[0].text : String(msg.content)
        }));
        
        // Use the streamText function with the OpenAI model
        // This is the pattern used in the Vercel AI SDK documentation
        const result = streamText({
          model: openai('gpt-4'),
          messages: aiMessages,
        });
        
        
        // Return the response using the AI SDK's Data Stream format
        // This is what the Assistant UI components expect
        return result.toDataStreamResponse();
      } catch (error) {
        console.error('Error generating chat response:', error);
        return NextResponse.json({ 
          error: 'Failed to generate response',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    } catch (error: any) {
      console.error('Error generating chat response:', error);
      return NextResponse.json({ 
        error: 'Failed to generate response', 
        details: error?.message || 'Unknown error' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("[POST] Triage Error:", error);
    throw error;
  }
}