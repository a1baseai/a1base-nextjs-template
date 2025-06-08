import { NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const { userId, userName } = await request.json();

    if (!chatId || !userId || !userName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Get chat by external ID
    const { data: chat } = await adapter.supabase
      .from('chats')
      .select('id')
      .eq('external_id', chatId)
      .single();

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Create or get the user
    const userPhoneNumber = `web-group-${userId}`;
    let { data: existingUser } = await adapter.supabase
      .from('conversation_users')
      .select('id')
      .eq('phone_number', userPhoneNumber)
      .single();

    let userId_db: string;

    if (!existingUser) {
      // Create new user
      const { data: newUser, error: createError } = await adapter.supabase
        .from('conversation_users')
        .insert({
          name: userName,
          phone_number: userPhoneNumber,
          service: 'web-ui',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createError || !newUser) {
        console.error('[JOIN-API] Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      userId_db = newUser.id;
    } else {
      userId_db = existingUser.id;
    }

    // Add user to chat participants if not already there
    const { data: existingParticipant } = await adapter.supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chat.id)
      .eq('user_id', userId_db)
      .single();

    if (!existingParticipant) {
      // Add user to participants
      const { error: participantError } = await adapter.supabase
        .from('chat_participants')
        .insert({
          chat_id: chat.id,
          user_id: userId_db,
          created_at: new Date().toISOString()
        });

      if (participantError) {
        console.error('[JOIN-API] Error adding participant:', participantError);
        return NextResponse.json(
          { error: 'Failed to add participant' },
          { status: 500 }
        );
      }

      // Add a system message about the user joining
      const joinMessageId = uuidv4();
      const { error: messageError } = await adapter.supabase
        .from('messages')
        .insert({
          id: joinMessageId,
          chat_id: chat.id,
          sender_id: null, // System message
          content: `${userName} joined the chat`,
          message_type: 'system',
          service: 'web-ui',
          external_id: joinMessageId,
          created_at: new Date().toISOString(),
        });

      if (messageError) {
        console.error('[JOIN-API] Error adding join message:', messageError);
        // Don't return error here as the user is already added as a participant
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Joined chat successfully'
    });
  } catch (error) {
    console.error('[JOIN-API] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Failed to join chat' },
      { status: 500 }
    );
  }
} 