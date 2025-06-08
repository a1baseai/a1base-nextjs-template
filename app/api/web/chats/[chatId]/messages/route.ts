import { NextRequest, NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";
import { triageMessage } from "@/lib/ai-triage/triage-logic";
import { getSystemPrompt } from "@/lib/agent/system-prompt";
import { streamText, type CoreMessage } from 'ai';
import { openai } from "@ai-sdk/openai";

function getUserIdFromHeaders(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

async function saveAiResponseMessage(
  adapter: any,
  chatId: string,
  messageContent: string
) {
  if (!messageContent) {
    console.log('[AI-RESPONSE] No message content to save');
    return;
  }

  const agentNumber = process.env.A1BASE_AGENT_NUMBER;
  console.log('[AI-RESPONSE] Agent number from env:', agentNumber);
  
  if (!agentNumber) {
    console.error('[AI-RESPONSE] A1BASE_AGENT_NUMBER not set, cannot save AI message.');
    return;
  }

  try {
    const normalizedAgentNumber = agentNumber.replace(/\+/g, '');
    console.log('[AI-RESPONSE] Looking for agent user with phone:', normalizedAgentNumber);
    
    const { data: agentUser, error } = await adapter.supabase
      .from('conversation_users')
      .select('id')
      .eq('phone_number', normalizedAgentNumber)
      .single();

    console.log('[AI-RESPONSE] Agent user query result:', { agentUser, error });

    if (agentUser) {
      console.log('[AI-RESPONSE] Saving message for agent user:', agentUser.id);
      const result = await adapter.addMessageToChat(chatId, agentUser.id, messageContent);
      console.log('[AI-RESPONSE] Message saved successfully:', !!result);
    } else {
      console.error('[AI-RESPONSE] Agent user not found in database');
      // Let's try to create the agent user
      console.log('[AI-RESPONSE] Attempting to create agent user...');
      const { data: newAgentUser, error: createError } = await adapter.supabase
        .from('conversation_users')
        .insert({
          phone_number: normalizedAgentNumber,
          name: 'AI Assistant',
          is_agent: true
        })
        .select('id')
        .single();
      
      if (newAgentUser) {
        console.log('[AI-RESPONSE] Created new agent user:', newAgentUser.id);
        await adapter.addMessageToChat(chatId, newAgentUser.id, messageContent);
      } else {
        console.error('[AI-RESPONSE] Failed to create agent user:', createError);
      }
    }
  } catch (error) {
    console.error('[AI-RESPONSE] Error saving AI response:', error);
  }
}

async function generateAiResponseAsync(chatId: string, userId: string, content: string, userMessage: any) {
  console.log('[AI-ASYNC] Starting AI response generation for chat:', chatId);
  
  try {
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error('[AI-ASYNC] No adapter available');
      return;
    }

    console.log('[AI-ASYNC] Getting system prompt...');
    const systemPromptContent = await getSystemPrompt();
    console.log('[AI-ASYNC] System prompt length:', systemPromptContent.length);

    console.log('[AI-ASYNC] Running triage...');
    const triageResponse = await triageMessage({
      thread_id: chatId,
      message_id: userMessage.id,
      content: content,
      message_type: 'text',
      message_content: { text: content },
      sender_name: userMessage.senderName,
      sender_number: 'web-ui-user',
      thread_type: 'group',
      timestamp: new Date().toISOString(),
      messagesByThread: new Map([[chatId, [{ 
        message_id: userMessage.id,
        content: content,
        message_type: 'text',
        message_content: { text: content },
        sender_number: 'web-ui-user',
        sender_name: userMessage.senderName,
        timestamp: new Date().toISOString(),
      }]]]),
      service: 'web-ui',
    });

    console.log('[AI-ASYNC] Triage response:', triageResponse);

    let aiResponse = '';
    if (triageResponse.type !== 'default') {
      aiResponse = triageResponse.message || 'No response available';
      console.log('[AI-ASYNC] Using triage response:', aiResponse);
    } else {
      console.log('[AI-ASYNC] Getting chat history for OpenAI...');
      const chatMessages = await adapter.getChatMessages(chatId, userId);
      console.log('[AI-ASYNC] Chat history length:', chatMessages.length);
      
      const historicalMessages: CoreMessage[] = chatMessages.slice(0, -1).map(msg => ({
        role: msg.isFromAgent ? 'assistant' as const : 'user' as const,
        content: msg.content
      }));

      const aiMessages: CoreMessage[] = [
        { role: 'system', content: systemPromptContent },
        ...historicalMessages,
        { role: 'user', content: content }
      ];

      console.log('[AI-ASYNC] Calling OpenAI with', aiMessages.length, 'messages');

      const result = await streamText({
        model: openai('gpt-4o'),
        messages: aiMessages,
        temperature: 0.7,
      });

      console.log('[AI-ASYNC] Collecting OpenAI response...');
      const reader = result.textStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiResponse += value;
      }
      console.log('[AI-ASYNC] OpenAI response length:', aiResponse.length);
    }

    if (aiResponse) {
      console.log('[AI-ASYNC] Saving AI response...');
      await saveAiResponseMessage(adapter, chatId, aiResponse);
      console.log('[AI-ASYNC] AI response saved successfully');
    } else {
      console.log('[AI-ASYNC] No AI response to save');
    }
  } catch (error) {
    console.error('[AI-ASYNC] Error generating AI response:', error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 401 }
      );
    }

    const { chatId } = await params;
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content } = body;
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message content required' },
        { status: 400 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    console.log('[MESSAGE-API] Adding user message to chat:', chatId);
    const userMessage = await adapter.addMessageToChat(chatId, userId, content);
    if (!userMessage) {
      return NextResponse.json(
        { success: false, error: 'Failed to add message' },
        { status: 500 }
      );
    }

    console.log('[MESSAGE-API] User message saved, starting async AI response');
    generateAiResponseAsync(chatId, userId, content, userMessage).catch(error => {
      console.error('[MESSAGE-API] Async AI response generation failed:', error);
    });

    return NextResponse.json({
      success: true,
      message: userMessage
    });
  } catch (error) {
    console.error('[MESSAGE-API] Error adding message:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 