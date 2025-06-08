import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/config';
import { toast } from 'sonner';

interface GroupChatHook {
  messages: any[];
  participants: any[];
  isLoading: boolean;
  error: string | null;
}

export function useGroupChat(chatId: string): GroupChatHook {
  const [messages, setMessages] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let messagesSubscription: any;
    let participantsSubscription: any;

    async function initializeChat() {
      if (!supabase) {
        setError('Database connection not available');
        setIsLoading(false);
        return;
      }

      try {
        // First, get the internal chat ID
        const { data: chat } = await supabase
          .from('chats')
          .select('id')
          .eq('external_id', chatId)
          .single();

        if (!chat) {
          setError('Chat not found');
          setIsLoading(false);
          return;
        }

        // Load initial messages
        const { data: initialMessages, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            message_type,
            sender_id,
            conversation_users (
              id,
              name,
              phone_number,
              is_agent
            )
          `)
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error loading messages:', messagesError);
          setError('Failed to load messages');
        } else {
          setMessages(formatMessages(initialMessages));
        }

        // Load initial participants
        const { data: initialParticipants, error: participantsError } = await supabase
          .from('chat_participants')
          .select(`
            user_id,
            created_at,
            conversation_users!inner (
              id,
              name,
              phone_number,
              service,
              is_agent
            )
          `)
          .eq('chat_id', chat.id);

        if (participantsError) {
          console.error('Error loading participants:', participantsError);
          setError('Failed to load participants');
        } else {
          setParticipants(formatParticipants(initialParticipants));
        }

        // Subscribe to new messages
        messagesSubscription = supabase!
          .channel('messages')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `chat_id=eq.${chat.id}`
            },
            async (payload) => {
              // Fetch the complete message with user info
              const { data: newMessage } = await supabase!
                .from('messages')
                .select(`
                  id,
                  content,
                  created_at,
                  message_type,
                  sender_id,
                  conversation_users (
                    id,
                    name,
                    phone_number,
                    is_agent
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (newMessage) {
                const formattedMessage = formatMessages([newMessage])[0];
                setMessages(prev => [...prev, formattedMessage]);
                
                // Show notification for new messages
                if (!formattedMessage.isSystemMessage && 
                    formattedMessage.senderName && 
                    !formattedMessage.senderName.includes('(You)')) {
                  toast.info(`New message from ${formattedMessage.senderName}`);
                }
              }
            }
          )
          .subscribe();

        // Subscribe to participant changes
        participantsSubscription = supabase
          .channel('participants')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'chat_participants',
              filter: `chat_id=eq.${chat.id}`
            },
            async () => {
              // Reload all participants on any change
              const { data: updatedParticipants } = await supabase
                .from('chat_participants')
                .select(`
                  user_id,
                  created_at,
                  conversation_users!inner (
                    id,
                    name,
                    phone_number,
                    service,
                    is_agent
                  )
                `)
                .eq('chat_id', chat.id);

              if (updatedParticipants) {
                setParticipants(formatParticipants(updatedParticipants));
              }
            }
          )
          .subscribe();

        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing chat:', err);
        setError('Failed to initialize chat');
        setIsLoading(false);
      }
    }

    initializeChat();

    // Cleanup subscriptions
    return () => {
      if (messagesSubscription && supabase) {
        supabase.removeChannel(messagesSubscription);
      }
      if (participantsSubscription && supabase) {
        supabase.removeChannel(participantsSubscription);
      }
    };
  }, [chatId]);

  function formatMessages(messages: any[]) {
    return messages.map(msg => {
      const isFromAgent = msg.conversation_users?.is_agent;
      const isSystemMessage = msg.message_type === 'system';
      
      if (isSystemMessage) {
        return {
          role: 'system',
          content: msg.content,
          id: msg.id,
          timestamp: msg.created_at,
          isSystemMessage: true
        };
      }

      const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('group-chat-user-id') : null;
      const isCurrentUser = msg.sender_id === currentUserId;
      const senderName = isFromAgent 
        ? 'AI Assistant'
        : isCurrentUser
          ? `${msg.conversation_users?.name || 'You'} (You)`
          : msg.conversation_users?.name || 'Unknown User';

      return {
        role: isFromAgent ? 'assistant' : 'user',
        content: msg.content,
        id: msg.id,
        timestamp: msg.created_at,
        senderName,
        isFromAgent
      };
    });
  }

  function formatParticipants(participants: any[]) {
    const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('group-chat-user-id') : null;
    
    return participants
      .map(p => {
        const user = p.conversation_users;
        return {
          user_id: user.id,
          name: user.name || 'Unknown User',
          phone_number: user.phone_number,
          service: user.service,
          is_agent: user.is_agent,
          joined_at: p.created_at
        };
      })
      .sort((a, b) => {
        if (a.user_id === currentUserId) return -1;
        if (b.user_id === currentUserId) return 1;
        if (a.is_agent) return -1;
        if (b.is_agent) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }

  return {
    messages,
    participants,
    isLoading,
    error
  };
} 