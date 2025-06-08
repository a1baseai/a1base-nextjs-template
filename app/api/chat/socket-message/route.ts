import { NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";
import { v4 as uuidv4 } from 'uuid';
import { syncWebUiMessage } from "@/lib/a1base-chat-context/web-ui-sync";

export async function POST(request: Request) {
  try {
    const { chatId, message, userId, userName } = await request.json();

    if (!chatId || !message || !userId || !userName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      // If no database, just return success (messages will only be in-memory)
      console.log('[SOCKET-MESSAGE-API] No database adapter, skipping persistence');
      return NextResponse.json({ success: true });
    }

    // Get or create the chat
    let { data: chat } = await adapter.supabase
      .from('chats')
      .select('id')
      .eq('external_id', chatId)
      .single();

    if (!chat) {
      // Create the chat if it doesn't exist
      const { data: newChat, error: chatError } = await adapter.supabase
        .from('chats')
        .insert({
          external_id: chatId,
          created_at: new Date().toISOString(),
          type: 'group',
          service: 'web-ui'
        })
        .select('id')
        .single();

      if (chatError || !newChat) {
        console.error('[SOCKET-MESSAGE-API] Error creating chat:', chatError);
        return NextResponse.json(
          { error: 'Failed to create chat' },
          { status: 500 }
        );
      }

      chat = newChat;
    }

    // Get or create the user
    const userPhoneNumber = userId === 'ai-agent' 
      ? process.env.A1BASE_AGENT_NUMBER?.replace(/\+/g, '') || 'ai-agent'
      : `web-group-${userId}`;
    
    let { data: existingUser } = await adapter.supabase
      .from('conversation_users')
      .select('id')
      .eq('phone_number', userPhoneNumber)
      .single();

    let userId_db: string;

    if (!existingUser) {
      const isAgent = userId === 'ai-agent';
      const { data: newUser, error: createError } = await adapter.supabase
        .from('conversation_users')
        .insert({
          name: userName,
          phone_number: userPhoneNumber,
          service: 'web-ui',
          is_agent: isAgent,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createError || !newUser) {
        console.error('[SOCKET-MESSAGE-API] Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      userId_db = newUser.id;
    } else {
      userId_db = existingUser.id;
    }

    // Check if user is in chat participants
    const { data: existingParticipant } = await adapter.supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chat.id)
      .eq('user_id', userId_db)
      .single();

    if (!existingParticipant) {
      // Add user to participants
      await adapter.supabase
        .from('chat_participants')
        .insert({
          chat_id: chat.id,
          user_id: userId_db,
          created_at: new Date().toISOString()
        });
    }

    // Save the message
    const messageId = message.id || uuidv4();
    const { error: messageError } = await adapter.supabase
      .from('messages')
      .insert({
        id: messageId,
        chat_id: chat.id,
        sender_id: userId_db,
        content: message.content,
        message_type: message.role === 'system' ? 'system' : 'text',
        service: 'web-ui',
        external_id: messageId,
        created_at: message.timestamp || new Date().toISOString(),
      });

    if (messageError) {
      console.error('[SOCKET-MESSAGE-API] Error saving message:', messageError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // Sync message to A1-Base (for both user and AI messages)
    // Skip system messages as they're internal to the web UI
    if (message.role !== 'system') {
      try {
        console.log('[SOCKET-MESSAGE-API] Syncing message to A1-Base...');
        
        // Determine sender identifier for A1-Base
        let senderIdentifier: string;
        if (userId === 'ai-agent') {
          // For AI agent, use the agent number
          senderIdentifier = process.env.A1BASE_AGENT_NUMBER?.replace(/\+/g, '') || 'ai-agent';
        } else {
          // For group chat users, use the web-group-{userId} format
          senderIdentifier = `web-group-${userId}`;
        }

        await syncWebUiMessage({
          chatRecordId: chatId, // Use the external_id as the thread ID for A1-Base
          messageRecordId: messageId,
          content: message.content,
          senderIdentifier: senderIdentifier,
          timestamp: Math.floor(new Date(message.timestamp || new Date().toISOString()).getTime() / 1000),
        });
        
        console.log('[SOCKET-MESSAGE-API] Message synced to A1-Base successfully');
      } catch (syncError) {
        // Log but don't fail the request if sync fails
        console.error('[SOCKET-MESSAGE-API] Error syncing to A1-Base:', syncError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SOCKET-MESSAGE-API] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
} 