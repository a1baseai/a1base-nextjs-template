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
    chatRecordId: string,
    messageContent: string
) {
    if (!messageContent) return;

    const messageRecordId = uuidv4();
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

        console.log(`[CHAT-API] Saving AI message to DB: ${messageRecordId}`);
        await adapter.storeMessage(
            chatRecordId,
            agentUser ? agentUser.id : null,
            messageRecordId, // This is now the Supabase message record ID
            { text: messageContent }, 'text', 'web-ui', { text: messageContent }
        );
        console.log(`[CHAT-API] AI message saved.`);

        await syncWebUiMessage({
            chatRecordId: chatRecordId,
            messageRecordId: messageRecordId,
            content: messageContent,
            senderIdentifier: agentNumber,
            timestamp: Math.floor(new Date(aiMessageTimestamp).getTime() / 1000),
        });
    } catch (error) {
        console.error('[CHAT-API] Error in saveAndSyncAiResponseMessage:', error);
    }
}

/**
 * GET endpoint to retrieve historical messages for a thread
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    const isGroupChat = searchParams.get('isGroupChat') === 'true';
    
    if (!threadId) {
      return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json({ messages: [] });
    }

    const thread = await adapter.getThread(threadId);
    if (!thread) {
      return NextResponse.json({ messages: [] });
    }

    // Convert database messages to the format expected by the UI
    const messages = await Promise.all(thread.messages.map(async (msg) => {
      const isFromAgent = msg.sender_number === process.env.A1BASE_AGENT_NUMBER;
      const isSystemMessage = msg.message_type === 'system';
      
      // For group chats, get the sender's name
      let senderName = 'User';
      if (isGroupChat && msg.sender_id && !isSystemMessage && !isFromAgent) {
        // Check if it's a web group user
        if (msg.sender_number?.startsWith('web-group-')) {
          // For web group users, parse the name from metadata or conversation_users
          const { data: sender } = await adapter.supabase
            .from('conversation_users')
            .select('name')
            .eq('id', msg.sender_id)
            .single();
          
          if (sender?.name) {
            senderName = sender.name;
          }
        } else {
          const { data: sender } = await adapter.supabase
            .from('conversation_users')
            .select('name')
            .eq('id', msg.sender_id)
            .single();
          
          if (sender?.name) {
            senderName = sender.name;
          }
        }
      }
      
      // Handle different message types
      if (isSystemMessage) {
        return {
          role: 'system' as const,
          content: msg.content,
          id: msg.message_id,
          timestamp: msg.timestamp,
          isSystemMessage: true
        };
      }
      
      // For group chats, don't prefix the message content with sender name
      // Instead, include it as a separate field
      return {
        role: isFromAgent ? 'assistant' : 'user',
        content: msg.content,
        id: msg.message_id,
        timestamp: msg.timestamp,
        senderName: isFromAgent ? 'AI Assistant' : senderName,
        isFromAgent
      };
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[CHAT-API-GET] Error retrieving historical messages:', error);
    return NextResponse.json({ error: 'Failed to retrieve messages' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  console.log('\n\n[CHAT-API] Received chat request');
  try {
    const { 
      messages, 
      threadId: clientThreadId, 
      isGroupChat, 
      userInfo 
    }: { 
      messages: CoreMessage[]; 
      threadId?: string; 
      isGroupChat?: boolean;
      userInfo?: { id: string; name: string; };
    } = await req.json();
    
    console.log(`[CHAT-API] Request contains ${messages.length} messages. Received client threadId: ${clientThreadId}`);
    console.log(`[CHAT-API] Group chat: ${isGroupChat}, User: ${userInfo?.name} (${userInfo?.id})`);

    if (isBuildTime()) {
      console.log('[CHAT-API] Build-time context detected, returning static response');
      return NextResponse.json({ 
        response: "This is a build-time placeholder response."
      });
    }

    const isNewSession = !clientThreadId;
    const externalThreadId = clientThreadId || uuidv4();
    
    const adapter = await getInitializedAdapter();
    let chatRecordId: string | null = null;
    let currentUserId: string | null = null;

    if (adapter) {
        // Handle user creation/lookup for group chats
        if (isGroupChat && userInfo) {
            // Try to find existing user by the group chat user ID stored in phone_number
            const userPhoneNumber = `web-group-${userInfo.id}`;
            let { data: existingUser } = await adapter.supabase
                .from('conversation_users')
                .select('id')
                .eq('phone_number', userPhoneNumber)
                .single();

            if (!existingUser) {
                console.log(`[CHAT-API] Creating new group chat user: ${userInfo.name}`);
                // Create new user for group chat
                const { data: newUser, error: userError } = await adapter.supabase
                    .from('conversation_users')
                    .insert({
                        name: userInfo.name,
                        phone_number: userPhoneNumber, // Store the group chat user ID here
                        service: 'web-ui',
                        created_at: new Date().toISOString(),
                    })
                    .select('id')
                    .single();

                if (userError) {
                    console.error('[CHAT-API] Error creating group chat user:', userError);
                } else {
                    currentUserId = newUser.id;
                    console.log(`[CHAT-API] Created group chat user with ID: ${currentUserId}`);
                }
            } else {
                currentUserId = existingUser.id;
                console.log(`[CHAT-API] Found existing group chat user with ID: ${currentUserId}`);
            }
        }

        // Handle chat creation/lookup
        const existingChat = await adapter.getThread(externalThreadId);
        if (existingChat) {
            chatRecordId = existingChat.id;
            console.log(`[CHAT-API] Found existing chat: ${chatRecordId}`);
            
            // For group chats, ensure the user is added as a participant
            if (isGroupChat && currentUserId) {
                // Check if user is already a participant
                const { data: existingParticipant } = await adapter.supabase
                    .from('chat_participants')
                    .select('user_id')
                    .eq('chat_id', chatRecordId)
                    .eq('user_id', currentUserId)
                    .single();

                if (!existingParticipant) {
                    console.log(`[CHAT-API] Adding user ${currentUserId} to existing group chat`);
                    await adapter.supabase
                        .from('chat_participants')
                        .insert({
                            chat_id: chatRecordId,
                            user_id: currentUserId,
                            joined_at: new Date().toISOString()
                        });
                    
                    // Add a system message that the user joined
                    if (userInfo) {
                        const joinMessageId = uuidv4();
                        await adapter.supabase
                            .from('messages')
                            .insert({
                                id: joinMessageId,
                                chat_id: chatRecordId,
                                sender_id: null, // System message
                                content: `${userInfo.name} joined the chat`,
                                message_type: 'system',
                                service: 'web-ui',
                                external_id: joinMessageId,
                                created_at: new Date().toISOString(),
                            });
                        console.log(`[CHAT-API] Added join message for ${userInfo.name}`);
                    }
                }
            }
        } else {
            const chatType = isGroupChat ? "group" : "individual";
            const { data: newChat, error: createError } = await adapter.supabase
                .from("chats")
                .insert({
                    external_id: externalThreadId,
                    service: "web-ui",
                    type: chatType,
                })
                .select("id")
                .single();

            if (createError) {
                console.error('[CHAT-API] Error creating chat:', createError);
                return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 });
            }
            chatRecordId = newChat.id;
            console.log(`[CHAT-API] Created new ${chatType} chat: ${chatRecordId}`);

            // Add user to group chat participants if this is a group chat
            if (isGroupChat && currentUserId) {
                await adapter.supabase
                    .from('chat_participants')
                    .insert({
                        chat_id: chatRecordId,
                        user_id: currentUserId,
                        joined_at: new Date().toISOString()
                    });
                console.log(`[CHAT-API] Added user ${currentUserId} to group chat participants`);
            }
        }
    }
    
    const userMessage = messages[messages.length - 1];
    const userMessageContent = typeof userMessage?.content === 'string' 
      ? userMessage.content 
      : Array.isArray(userMessage.content) && userMessage.content[0]?.type === 'text' 
        ? userMessage.content[0].text 
        : '';
    
    console.log(`[CHAT-API] Pre-save check. Adapter exists: ${!!adapter}. User message content: "${userMessageContent}". Internal chat ID: ${chatRecordId}. User ID: ${currentUserId}`);

    if (adapter && userMessageContent && chatRecordId) {
        const messageRecordId = uuidv4();
        const userMessageTimestamp = new Date().toISOString();
        
        try {
            console.log(`[CHAT-API] Saving user message to DB: ${messageRecordId}`);
            await adapter.storeMessage(
                chatRecordId,
                currentUserId, // Use the group chat user ID instead of null
                messageRecordId,
                { text: userMessageContent },
                'text',
                'web-ui',
                { text: userMessageContent }
            );
            console.log(`[CHAT-API] User message saved.`);

            // For group chats, sync with user name; for individual chats use default
            const senderIdentifier = isGroupChat && userInfo 
                ? `web-group-${userInfo.id}` 
                : 'web-ui-user';

            await syncWebUiMessage({
                chatRecordId: chatRecordId,
                messageRecordId: messageRecordId,
                content: userMessageContent,
                senderIdentifier: senderIdentifier,
                timestamp: Math.floor(new Date(userMessageTimestamp).getTime() / 1000),
            });
        } catch (error) {
            console.error('[CHAT-API] Error saving/syncing user message:', error);
        }
    }
    
    const systemPromptContent = await getSystemPrompt();
    console.log(`[CHAT-API] System prompt loaded (${systemPromptContent.length} chars)`);
    
    const profileMatch = systemPromptContent.match(/Name: ([^\n]+)/);
    const companyMatch = systemPromptContent.match(/Company: ([^\n]+)/);
    if (profileMatch && profileMatch[1]) {
      console.log(`[CHAT-API] Using agent: ${profileMatch[1]}, ${companyMatch?.[1] || 'Unknown'}`);
    }
    
    const latestUserMessageContent = userMessageContent;
    
    // Use appropriate thread type for triage
    const threadType = isGroupChat ? 'group' : 'individual';
    const senderName = isGroupChat && userInfo ? userInfo.name : 'WebUser';
    const senderNumber = isGroupChat && userInfo ? `web-group-${userInfo.id}` : 'web';

    const triageResponse = await triageMessage({
      thread_id: externalThreadId,
      message_id: Date.now().toString(),
      content: latestUserMessageContent,
      message_type: 'text',
      message_content: { text: latestUserMessageContent },
      sender_name: senderName,
      sender_number: senderNumber,
      thread_type: threadType,
      timestamp: new Date().toISOString(),
      messagesByThread: new Map([[externalThreadId, [{ 
        message_id: Date.now().toString(),
        content: latestUserMessageContent,
        message_type: 'text',
        message_content: { text: latestUserMessageContent },
        sender_number: senderNumber,
        sender_name: senderName,
        timestamp: new Date().toISOString(),
      }]]]),
      service: 'web-ui',
    });
    
    console.log(`[CHAT-API] Triage result: ${triageResponse.type}`);
    
    let result;

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
        // Get historical messages for context
        let historicalMessages: CoreMessage[] = [];
        
        if (adapter && chatRecordId) {
            try {
                const thread = await adapter.getThread(externalThreadId);
                if (thread && thread.messages.length > 0) {
                    // Convert database messages to AI format, excluding the current user message
                    const dbMessages = thread.messages.slice(0, -1);
                    
                    historicalMessages = dbMessages.map(msg => {
                        const isFromAgent = msg.sender_number === process.env.A1BASE_AGENT_NUMBER;
                        return {
                            role: isFromAgent ? 'assistant' as const : 'user' as const,
                            content: msg.content
                        };
                    });
                    
                    console.log(`[CHAT-API] Including ${historicalMessages.length} historical messages in AI context`);
                }
            } catch (error) {
                console.error('[CHAT-API] Error loading historical messages:', error);
            }
        }
        
        const aiMessages: CoreMessage[] = [
          { role: 'system', content: systemPromptContent },
          ...historicalMessages,
          ...messages
        ];
        
        if (triageResponse.message) {
          console.log(`[CHAT-API] Using triage message: ${triageResponse.message.substring(0, 50)}...`);
        }
        
        result = streamText({
          model: openai('gpt-4o'),
          messages: aiMessages,
          temperature: 0.7,
        });
    }

    // Save the AI response in the background
    (async () => {
        let fullResponse = "";
        const reader = result.textStream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += value;
        }
        if (adapter && chatRecordId) {
            await saveAndSyncAiResponseMessage(adapter, chatRecordId, fullResponse);
        }
    })();
    
    const responseHeaders: HeadersInit = {};
    if (isNewSession) {
        responseHeaders['X-Thread-Id'] = externalThreadId;
    }
    
    console.log(`[CHAT-API] Returning AI SDK streaming response with headers:`, responseHeaders);
    
    // Return the AI SDK result directly with proper streaming format
    return result.toDataStreamResponse({ headers: responseHeaders });
  } catch (error) {
    console.error('[CHAT-API] Unhandled error in chat route:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to handle chat request", details: errorMessage }, { status: 500 });
  }
}