import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  senderName?: string;
  senderId?: string;
  isSystemMessage?: boolean;
}

interface Participant {
  userId: string;
  userName: string;
  socketId?: string;
  isTyping?: boolean;
}

interface SocketGroupChatHook {
  messages: Message[];
  participants: Participant[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
  setTyping: (isTyping: boolean) => void;
  typingUsers: Map<string, string>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnect: () => void;
}

export function useSocketGroupChat(chatId: string): SocketGroupChatHook {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<SocketGroupChatHook['connectionStatus']>('connecting');
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [userInfo, setUserInfo] = useState<{ userId: string; userName: string } | null>(null);
  const lastHeartbeat = useRef<Date>(new Date());
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize user session if needed
  useEffect(() => {
    let userId = localStorage.getItem('group-chat-user-id');
    let userName = localStorage.getItem('group-chat-user-name');

    if (!userId || !userName) {
      // Generate a fun anonymous name
      const adjectives = ['Anonymous', 'Mystery', 'Secret', 'Hidden', 'Clever', 'Quick', 'Bright', 'Silent'];
      const animals = ['Panda', 'Fox', 'Wolf', 'Tiger', 'Eagle', 'Owl', 'Cat', 'Bear'];
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const animal = animals[Math.floor(Math.random() * animals.length)];
      userName = `${adjective} ${animal}`;
      userId = uuidv4();

      localStorage.setItem('group-chat-user-id', userId);
      localStorage.setItem('group-chat-user-name', userName);
      
      console.log('[SOCKET.IO] Created new user:', userName);
    }

    setUserInfo({ userId, userName });
  }, []);

  const connectSocket = useCallback(() => {
    if (!userInfo) return;

    const { userId, userName } = userInfo;

    // Dynamically determine the Socket.IO URL based on current location
    const socketUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000';

    console.log('[SOCKET.IO] Connecting to:', socketUrl);
    setConnectionStatus('connecting');
    setError(null);

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000), // Exponential backoff
      timeout: 20000, // 20 second connection timeout
      // Production optimizations
      path: '/socket.io/',
      forceNew: false,
      multiplex: true,
      upgrade: true,
      rememberUpgrade: true,
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      query: {
        userId,
        chatId
      }
    });

    socketRef.current = socket;

    // Add connection timeout with better error message
    const connectionTimeout = setTimeout(() => {
      if (!socket.connected) {
        console.error('[SOCKET.IO] Connection timeout');
        setError('Unable to connect to chat server. Please check your internet connection and try again.');
        setConnectionStatus('error');
        setIsLoading(false);
      }
    }, 15000); // 15 second timeout

    // Socket event handlers
    socket.on('connect', () => {
      console.log('[SOCKET.IO] Connected:', socket.id);
      clearTimeout(connectionTimeout);
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
      
      // Clear any previous errors
      setError(null);
      
      // Start heartbeat monitoring
      lastHeartbeat.current = new Date();
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      heartbeatInterval.current = setInterval(() => {
        const now = new Date();
        const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.current.getTime();
        if (timeSinceLastHeartbeat > 60000) { // 60 seconds without heartbeat
          console.warn('[SOCKET.IO] No heartbeat for 60 seconds, connection may be stale');
          setConnectionStatus('disconnected');
        }
      }, 30000); // Check every 30 seconds
      
      // Join the chat room
      socket.emit('join-chat', {
        chatId,
        userId,
        userName
      });
    });

    socket.on('connect_error', (error) => {
      console.error('[SOCKET.IO] Connection error:', error.message);
      clearTimeout(connectionTimeout);
      
      // Provide user-friendly error messages
      let errorMessage = 'Connection failed';
      if (error.message.includes('CORS')) {
        errorMessage = 'Access denied by server. Please contact support.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Connection timed out. Please check your internet connection.';
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        errorMessage = 'Unable to connect after multiple attempts. Please refresh the page.';
      }
      
      setError(errorMessage);
      setConnectionStatus('error');
      reconnectAttempts.current++;
    });

    socket.on('joined-chat', (data) => {
      console.log('[SOCKET.IO] Successfully joined chat:', data);
      setParticipants(data.participants || []);
      setIsLoading(false);
      
      // Show success notification
      if (reconnectAttempts.current > 0) {
        toast.success('Reconnected to chat');
      }
    });

    socket.on('participants-update', (data) => {
      console.log('[SOCKET.IO] Participants updated:', data);
      setParticipants(data.participants || []);
    });

    socket.on('new-message', (message) => {
      console.log('[SOCKET.IO] New message received:', message);
      
      const formattedMessage: Message = {
        id: message.id || uuidv4(),
        content: message.content,
        role: message.role || 'user',
        timestamp: message.timestamp,
        senderName: message.senderName,
        senderId: message.senderId
      };

      setMessages(prev => {
        // Debug: Log current messages to find duplicates
        if (prev.some(msg => msg.id === formattedMessage.id)) {
          console.log('[SOCKET.IO DEBUG] Duplicate found! Message ID:', formattedMessage.id);
          console.log('[SOCKET.IO DEBUG] Current messages:', prev.map(m => ({ id: m.id, content: m.content.substring(0, 20) })));
        }
        
        // Check if message already exists to prevent duplicates
        const exists = prev.some(msg => msg.id === formattedMessage.id);
        if (exists) {
          console.log('[SOCKET.IO] Duplicate message ignored:', formattedMessage.id);
          return prev;
        }
        
        // For messages from the current user, check if we already have the content
        // This handles cases where the message ID might be different but content is the same
        if (formattedMessage.senderId === userId) {
          const recentDuplicate = prev.find(msg => 
            msg.senderId === userId &&
            msg.content === formattedMessage.content &&
            // Check if message was sent within last 2 seconds
            new Date(msg.timestamp).getTime() > new Date().getTime() - 2000
          );
          
          if (recentDuplicate) {
            console.log('[SOCKET.IO] Recent duplicate from current user ignored');
            return prev;
          }
        }
        
        // Debug: Log when adding new message
        console.log('[SOCKET.IO DEBUG] Adding new message:', formattedMessage.id);
        
        return [...prev, formattedMessage];
      });

      // Show notification for messages from others (only when tab is not focused)
      if (message.senderId !== userId && document.hidden) {
        toast.info(`New message from ${message.senderName}`);
      }
    });

    socket.on('user-joined', (data) => {
      console.log('[SOCKET.IO] User joined:', data);
      
      // Add system message
      const joinMessage: Message = {
        id: uuidv4(),
        content: `${data.userName} joined the chat`,
        role: 'system',
        timestamp: data.timestamp,
        isSystemMessage: true
      };
      
      setMessages(prev => {
        // Check if a similar join message already exists (within last 5 seconds)
        const recentJoinMessage = prev.find(msg => 
          msg.isSystemMessage && 
          msg.content === joinMessage.content &&
          new Date(msg.timestamp).getTime() > new Date().getTime() - 5000
        );
        if (recentJoinMessage) {
          console.log('[SOCKET.IO] Duplicate join message ignored');
          return prev;
        }
        return [...prev, joinMessage];
      });
      toast.success(`${data.userName} joined the chat`);
    });

    socket.on('user-left', (data) => {
      console.log('[SOCKET.IO] User left:', data);
      
      // Add system message
      const leaveMessage: Message = {
        id: uuidv4(),
        content: `${data.userName} left the chat`,
        role: 'system',
        timestamp: data.timestamp,
        isSystemMessage: true
      };
      
      setMessages(prev => {
        // Check if a similar leave message already exists (within last 5 seconds)
        const recentLeaveMessage = prev.find(msg => 
          msg.isSystemMessage && 
          msg.content === leaveMessage.content &&
          new Date(msg.timestamp).getTime() > new Date().getTime() - 5000
        );
        if (recentLeaveMessage) {
          console.log('[SOCKET.IO] Duplicate leave message ignored');
          return prev;
        }
        return [...prev, leaveMessage];
      });
      
      // Remove from typing users
      setTypingUsers(prev => {
        const updated = new Map(prev);
        updated.delete(data.userId);
        return updated;
      });
    });

    socket.on('user-typing', (data) => {
      console.log('[SOCKET.IO] User typing:', data);
      
      setTypingUsers(prev => {
        const updated = new Map(prev);
        if (data.isTyping) {
          updated.set(data.userId, data.userName);
        } else {
          updated.delete(data.userId);
        }
        return updated;
      });
    });

    socket.on('pong', () => {
      lastHeartbeat.current = new Date();
    });

    socket.on('error', (error) => {
      console.error('[SOCKET.IO] Socket error:', error);
      setError(error.message || 'An error occurred in the chat connection');
      
      // Log detailed error in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[SOCKET.IO] Full error details:', error);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET.IO] Disconnected:', reason);
      setConnectionStatus('disconnected');
      
      // Show appropriate message based on disconnect reason
      if (reason === 'io server disconnect') {
        setError('Disconnected by server. Please refresh the page.');
      } else if (reason === 'transport close' || reason === 'transport error') {
        setError('Connection lost. Attempting to reconnect...');
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[SOCKET.IO] Reconnected after', attemptNumber, 'attempts');
      setConnectionStatus('connected');
      setError(null);
      
      // Rejoin the chat room
      socket.emit('join-chat', {
        chatId,
        userId,
        userName
      });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[SOCKET.IO] Reconnection attempt', attemptNumber);
      setConnectionStatus('connecting');
    });

    socket.on('reconnect_failed', () => {
      console.error('[SOCKET.IO] Reconnection failed');
      setConnectionStatus('error');
      setError('Failed to reconnect to chat. Please refresh the page.');
    });

    return () => {
      clearTimeout(connectionTimeout);
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [chatId, userInfo]);

  useEffect(() => {
    if (!userInfo) return;

    connectSocket();

    // Load existing messages from API
    loadHistoricalMessages();

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [userInfo, connectSocket]);

  const loadHistoricalMessages = async () => {
    try {
      const response = await fetch(`/api/chat?threadId=${chatId}&isGroupChat=true`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          // Debug log
          console.log('[SOCKET.IO DEBUG] Loading historical messages, count:', data.messages.length);
          
          const formattedMessages = data.messages.map((msg: any) => ({
            id: msg.id || uuidv4(),
            content: msg.content,
            role: msg.role,
            timestamp: msg.timestamp || new Date().toISOString(),
            senderName: msg.senderName,
            senderId: msg.senderId,
            isSystemMessage: msg.isSystemMessage
          }));
          
          // Check for duplicates in historical messages
          const messageIds = formattedMessages.map((m: Message) => m.id);
          const duplicateIds = messageIds.filter((id: string, index: number) => messageIds.indexOf(id) !== index);
          if (duplicateIds.length > 0) {
            console.error('[SOCKET.IO DEBUG] Duplicate IDs in historical messages:', duplicateIds);
          }
          
          setMessages(prev => {
            // If we already have messages, merge them intelligently
            if (prev.length > 0) {
              const existingIds = new Set(prev.map(m => m.id));
              const newMessages = formattedMessages.filter((m: Message) => !existingIds.has(m.id));
              
              // Sort all messages by timestamp
              const allMessages = [...prev, ...newMessages].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              
              return allMessages;
            }
            
            // If no existing messages, just set the historical messages
            return formattedMessages;
          });
        }
      } else {
        console.error('[SOCKET.IO] Failed to load messages:', response.status);
      }
    } catch (error) {
      console.error('[SOCKET.IO] Error loading historical messages:', error);
      // Don't set error state here as this is not critical for real-time functionality
    }
  };

  const sendMessage = useCallback((content: string) => {
    if (!socketRef.current || !content.trim() || !userInfo) return;

    if (connectionStatus !== 'connected') {
      toast.error('Not connected to chat. Please wait for reconnection.');
      return;
    }

    const { userId, userName } = userInfo;

    const message = {
      id: uuidv4(),
      content: content.trim(),
      role: 'user' as const,
      timestamp: new Date().toISOString()
    };

    // Optimistically add the message to the UI
    const optimisticMessage: Message = {
      ...message,
      senderName: userName,
      senderId: userId
    };
    
    setMessages(prev => [...prev, optimisticMessage]);

    // Emit message to server for real-time delivery
    socketRef.current.emit('send-message', {
      chatId,
      message,
      userId,
      userName
    });

    // Persist message to database with retry logic
    const persistMessage = async (retries = 3) => {
      try {
        const response = await fetch('/api/chat/socket-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            message,
            userId,
            userName
          })
        });

        if (!response.ok && retries > 0) {
          console.error('[SOCKET.IO] Failed to persist message, retrying...');
          setTimeout(() => persistMessage(retries - 1), 1000);
        }
      } catch (error) {
        console.error('[SOCKET.IO] Failed to persist message:', error);
        if (retries > 0) {
          setTimeout(() => persistMessage(retries - 1), 1000);
        }
      }
    };

    persistMessage();

    // Trigger AI response generation
    fetch('/api/chat/group-ai-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId,
        message,
        userId,
        userName
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.shouldRespond && data.response && socketRef.current) {
        // Generate a unique ID for the AI message
        const aiMessageId = uuidv4();
        const aiMessage = {
          id: aiMessageId,
          content: data.response,
          role: 'assistant' as const,
          timestamp: new Date().toISOString()
        };

        // Emit AI message to all users
        socketRef.current.emit('send-message', {
          chatId,
          message: aiMessage,
          userId: 'ai-agent',
          userName: data.agentName || 'AI Assistant'
        });

        // Persist AI message to database
        fetch('/api/chat/socket-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId,
            message: aiMessage,
            userId: 'ai-agent',
            userName: data.agentName || 'AI Assistant'
          })
        }).catch(error => {
          console.error('[SOCKET.IO] Failed to persist AI message:', error);
        });
      }
    })
    .catch(error => {
      console.error('[SOCKET.IO] Failed to generate AI response:', error);
      // Don't show error to user as AI response is not critical
    });

    // Clear typing indicator
    setTyping(false);
  }, [chatId, userInfo, connectionStatus]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current || !userInfo || connectionStatus !== 'connected') return;

    const { userId, userName } = userInfo;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Emit typing status
    socketRef.current.emit('typing', {
      chatId,
      userId,
      userName,
      isTyping
    });

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
      }, 3000);
    }
  }, [chatId, userInfo, connectionStatus]);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    reconnectAttempts.current = 0;
    connectSocket();
  }, [connectSocket]);

  return {
    messages,
    participants,
    isLoading,
    error,
    sendMessage,
    setTyping,
    typingUsers,
    connectionStatus,
    reconnect
  };
} 