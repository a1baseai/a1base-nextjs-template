import { NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json({ participants: [] });
    }

    // Get chat by external ID
    const { data: chat } = await adapter.supabase
      .from('chats')
      .select('id')
      .eq('external_id', chatId)
      .single();

    if (!chat) {
      return NextResponse.json({ participants: [] });
    }

    // Get all participants for this chat
    const { data: participants, error } = await adapter.supabase
      .from('chat_participants')
      .select(`
        user_id,
        conversation_users!inner (
          id,
          name,
          phone_number,
          service
        )
      `)
      .eq('chat_id', chat.id);

    if (error) {
      console.error('[PARTICIPANTS-API] Error fetching participants:', error);
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
    }

    // Check if agent is a participant
    const agentNumber = process.env.A1BASE_AGENT_NUMBER?.replace(/\+/g, '');
    
    // Format participants
    const formattedParticipants = participants?.map(p => {
      const user = p.conversation_users as any;
      return {
        user_id: p.user_id,
        name: user.name || 'Unknown User',
        phone_number: user.phone_number,
        service: user.service,
        is_agent: user.phone_number === agentNumber
      };
    }) || [];

    // Also check if agent exists but is not in participants (for messages sent by agent)
    const hasAgentInParticipants = formattedParticipants.some(p => p.is_agent);
    if (!hasAgentInParticipants && agentNumber) {
      // Check if agent has sent messages in this chat
      const { data: agentUser } = await adapter.supabase
        .from('conversation_users')
        .select('id, name, phone_number, service')
        .eq('phone_number', agentNumber)
        .single();

      if (agentUser) {
        // Check if agent has messages in this chat
        const { data: agentMessages } = await adapter.supabase
          .from('messages')
          .select('id')
          .eq('chat_id', chat.id)
          .eq('sender_id', agentUser.id)
          .limit(1);

        if (agentMessages && agentMessages.length > 0) {
          // Add agent to participants list
          formattedParticipants.push({
            user_id: agentUser.id,
            name: agentUser.name || 'AI Assistant',
            phone_number: agentUser.phone_number,
            service: agentUser.service,
            is_agent: true
          });
        }
      }
    }

    return NextResponse.json({ 
      participants: formattedParticipants,
      total: formattedParticipants.length 
    });
  } catch (error) {
    console.error('[PARTICIPANTS-API] Unhandled error:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
} 