import { NextResponse } from "next/server";
import { getSystemPrompt } from "../../../lib/agent/system-prompt";
import { triageMessage } from "../../../lib/ai-triage/triage-logic";
// Define route configuration directly in this file
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
import { streamText, type CoreMessage } from 'ai';
import { openai } from "@ai-sdk/openai";
import { formatMessagesForOpenAI } from "../../../lib/services/openai";

import { getInitializedAdapter } from "@/lib/supabase/config";
import { syncWebUiMessage } from "@/lib/a1base-chat-context/web-ui-sync";
import { v4 as uuidv4 } from 'uuid';
import { SupabaseAdapter } from "@/lib/supabase/adapter";
import { Readable } from "stream";

// Check if we're in a build context
const isBuildTime = () => {
  return process.env.NODE_ENV === 'production' && 
         (process.env.NEXT_PHASE === 'phase-production-build' || 
          !process.env.OPENAI_API_KEY);
};

async function saveAndSyncAiResponseMessage(
    adapter: SupabaseAdapter,
    internalChatId: string,
    externalThreadId: string,
    content: string
) {
    if (!content) return;

    const aiMessageId = uuidv4();
    const aiMessageTimestamp = new Date().toISOString();
    const agentNumber = process.env.A1BASE_AGENT_NUMBER;

    if (!agentNumber) {
        console.error('[CHAT-API] A1BASE_AGENT_NUMBER not set, cannot save/sync AI message.');
        return;
    }

    try {
        const { data: agentUser } = await adapter.supabase
            .from('conversation_users')
            .select('id')
            .eq('phone_number', agentNumber)
            .single();

        console.log(`[CHAT-API] Saving AI message to DB: ${aiMessageId}`);
        await adapter.storeMessage(
            internalChatId,
            agentUser ? agentUser.id : null,
            aiMessageId,
            { text: content }, 'text', 'web-ui', { text: content }
        );
        console.log(`[CHAT-API] AI message saved.`);

        await syncWebUiMessage({
            threadId: externalThreadId,
            messageId: aiMessageId,
            content: content,
            senderIdentifier: agentNumber,
            timestamp: Math.floor(new Date(aiMessageTimestamp).getTime() / 1000),
        });
    } catch (error) {
        console.error('[CHAT-API] Error in saveAndSyncAiResponseMessage:', error);
    }
}

export async function POST(req: Request) {
  console.log('\n\n[CHAT-API] Received chat request');
  try {
    // Parse the request to get messages
    const { messages, threadId: clientThreadId }: { messages: CoreMessage[]; threadId?: string } = await req.json();
    console.log(`[CHAT-API] Request contains ${messages.length} messages. Received client threadId: ${clientThreadId}`);

    // Handle build-time context without API keys
    if (isBuildTime()) {
      console.log('[CHAT-API] Build-time context detected, returning static response');
      return NextResponse.json({ 
        response: "This is a build-time placeholder response."
      });
    }

    const isNewSession = !clientThreadId;
    const externalThreadId = clientThreadId || uuidv4();
    
    const adapter = await getInitializedAdapter();
    let internalChatId: string | null = null;
    if (adapter) {
        const existingChat = await adapter.getThread(externalThreadId);
        if (existingChat) {
            internalChatId = existingChat.id;
        } else {
            const { data: newChat, error: createError } = await adapter.supabase
                .from("chats")
                .insert({
                    external_id: externalThreadId,
                    service: "web-ui",
                    type: "individual",
                })
                .select("id")
                .single();

            if (createError) {
                console.error('[CHAT-API] Error creating chat:', createError);
                return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 });
            }
            internalChatId = newChat.id;
        }
    }
    
    const userMessage = messages[messages.length - 1];
    const userMessageContent = typeof userMessage?.content === 'string' 
      ? userMessage.content 
      : Array.isArray(userMessage.content) && userMessage.content[0]?.type === 'text' 
        ? userMessage.content[0].text 
        : '';
    
    console.log(`[CHAT-API] Pre-save check. Adapter exists: ${!!adapter}. User message content: "${userMessageContent}". Internal chat ID: ${internalChatId}`);

    if (adapter && userMessageContent && internalChatId) {
        const userMessageId = uuidv4();
        const userMessageTimestamp = new Date().toISOString();
        
        try {
            console.log(`[CHAT-API] Saving user message to DB: ${userMessageId}`);
            await adapter.storeMessage(
                internalChatId,
                null, // sender_id for user is null
                userMessageId,
                { text: userMessageContent },
                'text',
                'web-ui',
                { text: userMessageContent }
            );
            console.log(`[CHAT-API] User message saved.`);

            // Sync after saving
            await syncWebUiMessage({
                threadId: externalThreadId,
                messageId: userMessageId,
                content: userMessageContent,
                senderIdentifier: '', // Identifier for a non-agent user
                timestamp: Math.floor(new Date(userMessageTimestamp).getTime() / 1000),
            });
        } catch (error) {
            console.error('[CHAT-API] Error saving/syncing user message:', error);
        }
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
    const latestUserMessageContent = userMessageContent;
    
    // Run message through triage
    const triageResponse = await triageMessage({
      thread_id: externalThreadId,
      message_id: Date.now().toString(),
      content: latestUserMessageContent,
      message_type: 'text',
      message_content: { text: latestUserMessageContent },
      sender_name: 'WebUser',
      sender_number: 'web',
      thread_type: 'individual',
      timestamp: new Date().toISOString(),
      messagesByThread: new Map([[externalThreadId, [{ 
        message_id: Date.now().toString(),
        content: latestUserMessageContent,
        message_type: 'text',
        message_content: { text: latestUserMessageContent },
        sender_number: 'web',
        sender_name: 'WebUser',
        timestamp: new Date().toISOString(),
      }]]]),
      service: 'web-ui',
    });
    
    console.log(`[CHAT-API] Triage result: ${triageResponse.type}`);
    
    let result;

    // For non-default triage types, create a direct streaming response without using the AI model
    if (triageResponse.type !== 'default') {
      console.log('[CHAT-API] Creating direct stream for non-default triage response');
      const responseMessage = triageResponse.message || 'No response message available';
      
      result = streamText({
        model: openai('gpt-3.5-turbo'),
        system: "You are an assistant. Return ONLY the message provided to you without any modifications.",
        messages: [
          {
            role: "user",
            content: `Return exactly this text, with no modifications or additional text: ${responseMessage}`
          }
        ],
        temperature: 0,
        maxTokens: 1000,
      });
    } else {
        const aiMessages: CoreMessage[] = [
          { role: 'system', content: systemPromptContent },
          ...messages
        ];
        
        if (triageResponse.message) {
          console.log(`[CHAT-API] Using triage message: ${triageResponse.message.substring(0, 50)}...`);
        }
        
        result = streamText({
          model: openai('gpt-4.1'),
          messages: aiMessages,
          temperature: 0.7,
        });
    }

    const [stream1, stream2] = result.textStream.tee();

    // In parallel, read the stream to completion for saving
    (async () => {
        let fullResponse = "";
        const reader = stream1.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += value;
        }
        if (adapter && internalChatId) {
            await saveAndSyncAiResponseMessage(adapter, internalChatId, externalThreadId, fullResponse);
        }
    })();
    
    const responseHeaders: HeadersInit = { "Content-Type": "text/plain; charset=utf-8" };
    if (isNewSession) {
        responseHeaders['X-Thread-Id'] = externalThreadId;
    }
    
    // Return the other stream to the client
    const responseStream = new ReadableStream({
      async start(controller) {
        const reader = stream2.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          controller.enqueue(value);
        }
      },
    });

    return new Response(responseStream, {
        headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('[CHAT-API] Error in chat API:', error);
    return NextResponse.json({ 
      error: 'Failed to generate response', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}