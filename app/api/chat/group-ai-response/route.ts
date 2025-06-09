import { NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";
import { getAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { getSystemPrompt } from "@/lib/agent/system-prompt";
import { streamText, type CoreMessage } from 'ai';
import { openai } from "@ai-sdk/openai";
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { chatId, message, userId, userName } = await request.json();

    if (!chatId || !message || !userId || !userName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get agent profile settings
    const profileSettings = await getAgentProfileSettings();
    const agentName = profileSettings.name || 'AI Assistant';
    const respondOnlyWhenMentioned = profileSettings.groupChatPreferences?.respond_only_when_mentioned ?? false;

    // Check if agent should respond
    if (respondOnlyWhenMentioned) {
      // Check if the message mentions the agent
      const mentionPatterns = [
        `@${agentName}`,
        agentName.toLowerCase(),
        'ai',
        'assistant',
        'bot'
      ];
      
      const messageLower = message.content.toLowerCase();
      const isMentioned = mentionPatterns.some(pattern => messageLower.includes(pattern.toLowerCase()));
      
      if (!isMentioned) {
        console.log('[GROUP-AI] Agent not mentioned, skipping response');
        return NextResponse.json({ shouldRespond: false });
      }
    }

    // Check if message contains an email address - if so, skip AI response
    // This prevents duplicate responses when users provide their email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailRegex.test(message.content)) {
      console.log('[GROUP-AI] Message contains email address, skipping AI response to avoid duplicate');
      return NextResponse.json({ shouldRespond: false });
    }

    // Get system prompt
    const systemPromptContent = await getSystemPrompt();
    
    // Add group chat context to system prompt
    const groupChatContext = `
You are participating in a group chat. The current message is from ${userName}.
Remember to:
- Be conversational and natural
- Address the person by name when appropriate
- Keep responses concise for group chat flow
- Be helpful but not overwhelming
${respondOnlyWhenMentioned ? '- You are responding because you were mentioned or addressed' : ''}
`;

    const fullSystemPrompt = `${systemPromptContent}\n\n${groupChatContext}`;

    // Get adapter for database operations
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.log('[GROUP-AI] No database adapter, generating response without history');
    }

    // Get recent chat history if available
    let historicalMessages: CoreMessage[] = [];
    if (adapter) {
      try {
        // Get the internal chat ID
        const { data: chat } = await adapter.supabase
          .from('chats')
          .select('id')
          .eq('external_id', chatId)
          .single();

        if (chat) {
          // Get recent messages (last 20)
          const { data: recentMessages } = await adapter.supabase
            .from('messages')
            .select(`
              id,
              content,
              created_at,
              sender_id,
              conversation_users (
                name,
                is_agent
              )
            `)
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(20);

          if (recentMessages) {
            // Convert to CoreMessage format (reverse to get chronological order)
            historicalMessages = recentMessages.reverse().map(msg => {
              const user = msg.conversation_users as any;
              return {
                role: user?.is_agent ? 'assistant' as const : 'user' as const,
                content: user?.is_agent 
                  ? msg.content 
                  : `${user?.name || 'User'}: ${msg.content}`
              };
            });
          }
        }
      } catch (error) {
        console.error('[GROUP-AI] Error fetching chat history:', error);
      }
    }

    // Prepare messages for AI
    const aiMessages: CoreMessage[] = [
      { role: 'system', content: fullSystemPrompt },
      ...historicalMessages,
      { role: 'user', content: `${userName}: ${message.content}` }
    ];

    console.log('[GROUP-AI] Generating AI response with', aiMessages.length, 'messages');

    // Generate AI response
    const result = await streamText({
      model: openai('gpt-4o'),
      messages: aiMessages,
      temperature: 0.7,
      maxTokens: 500, // Keep responses concise for group chat
    });

    // Collect the full response
    let aiResponse = '';
    const reader = result.textStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      aiResponse += value;
    }

    console.log('[GROUP-AI] Generated response:', aiResponse);

    // Return the AI response
    return NextResponse.json({
      shouldRespond: true,
      response: aiResponse,
      agentName: agentName
    });

  } catch (error) {
    console.error('[GROUP-AI] Error generating AI response:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
} 