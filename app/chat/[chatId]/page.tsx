"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Share2, Users, Check, ArrowLeft, Send, X, Loader2, ChevronLeft, ChevronRight, MessageCircle, AlertCircle, WifiOff, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { v4 as uuidv4 } from "uuid";
import { useSocketGroupChat } from '@/hooks/useSocketGroupChat';
import { Textarea } from '@/components/ui/textarea';
import Image from "next/image";
import { AgentProfileSettings } from "@/lib/agent-profile/types";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { loadProfileSettings } from "@/lib/storage/file-storage";

// Import Message interface
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  senderName?: string;
  senderId?: string;
  isSystemMessage?: boolean;
}

// Agent Profile Card Component
const AgentProfileCard: React.FC = () => {
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null);

  useEffect(() => {
    async function fetchProfileSettings() {
      try {
        const settings = await loadProfileSettings();
        if (settings) {
          setProfileSettings(settings);
        } else {
          setProfileSettings(defaultAgentProfileSettings);
        }
      } catch (error) {
        console.error("Error loading profile settings:", error);
        setProfileSettings(defaultAgentProfileSettings);
      }
    }

    fetchProfileSettings();
  }, []);

  const settings = profileSettings || defaultAgentProfileSettings;

  return (
    <div className="m-2 sm:m-4 bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center">
          {profileSettings && (
            <div className="flex items-center">
              <div className="mr-4 h-14 w-14 overflow-hidden rounded-full">
                <Image
                  src={settings?.agentSettings?.profileGifUrl || settings?.profileImageUrl || '/a1base-favicon.png'}
                  alt={profileSettings.name}
                  width={56}
                  height={56}
                  unoptimized={true}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold">{profileSettings.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profileSettings.role} • {profileSettings.companyName}
                </p>
                {profileSettings.groupChatPreferences?.respond_only_when_mentioned && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    📢 Responds only when mentioned
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function GroupChatContent() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null);
  
  const { messages, participants, isLoading, error, sendMessage, setTyping, typingUsers, connectionStatus, reconnect } = useSocketGroupChat(chatId);

  // Load profile settings for agent info
  useEffect(() => {
    async function fetchProfileSettings() {
      try {
        const settings = await loadProfileSettings();
        if (settings) {
          setProfileSettings(settings);
        } else {
          setProfileSettings(defaultAgentProfileSettings);
        }
      } catch (error) {
        console.error("Error loading profile settings:", error);
        setProfileSettings(defaultAgentProfileSettings);
      }
    }

    fetchProfileSettings();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleShareChat = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Chat link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    setTyping(e.target.value.length > 0);
  };

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Connecting...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Wifi className="w-4 h-4" />
            <span className="text-sm">Connected</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">Disconnected</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Connection Error</span>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error && connectionStatus === 'error' && messages.length === 0) {
    return (
      <div className="absolute inset-0 bg-white dark:bg-gray-900 z-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-4">{error}</p>
          <div className="space-y-2">
            <Button variant="outline" onClick={reconnect}>
              Try Again
            </Button>
            <Button variant="ghost" onClick={() => router.push('/chat')}>
              Return to Chat List
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Format typing users display
  const typingDisplay = Array.from(typingUsers.values()).join(', ');

  // Enhanced participants list with agent profile
  const renderParticipant = (participant: any) => {
    const isCurrentUser = participant.userId === localStorage.getItem('group-chat-user-id');
    const isAgent = participant.userId === 'ai-agent';
    const settings = profileSettings || defaultAgentProfileSettings;

    if (isAgent && profileSettings) {
      return (
        <div
          key={participant.userId}
          className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            <Image
              src={settings?.agentSettings?.profileGifUrl || settings?.profileImageUrl || '/a1base-favicon.png'}
              alt={settings.name}
              width={40}
              height={40}
              unoptimized={true}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {settings.name} (AI)
            </p>
            <p className="text-xs text-gray-500 truncate">
              {settings.role}
            </p>
            {settings.groupChatPreferences?.respond_only_when_mentioned && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Mention to activate
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={participant.userId}
        className={`flex items-center gap-2 p-2 rounded-lg ${
          isCurrentUser
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
          {participant.userName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {participant.userName}
            {isCurrentUser && ' (You)'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <h1 className="text-xl font-semibold">Group Chat</h1>
            </div>
            {getConnectionStatusDisplay()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareChat}
              className="flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowParticipants(!showParticipants)}
              className="md:hidden"
            >
              <Users className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  {connectionStatus === 'error' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={reconnect}
                      className="mt-2"
                    >
                      Try Reconnecting
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agent Profile Card */}
        <AgentProfileCard />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Participants Sidebar - Desktop */}
          {showParticipants && (
            <div className="hidden lg:block border-r border-gray-200 dark:border-gray-700 w-64 p-4 overflow-y-auto">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants ({participants.length})
              </h3>
              <div className="space-y-2">
                {participants.map(renderParticipant)}
              </div>
            </div>
          )}

          {/* Mobile Participants Drawer */}
          {showParticipants && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowParticipants(false)}>
              <div 
                className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 p-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Participants ({participants.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowParticipants(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {participants.map(renderParticipant)}
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages and Input */}
          <div className="flex-1 flex flex-col">
            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  <p className="text-lg mb-2">Welcome to the group chat!</p>
                  <p className="text-sm">Be the first to send a message.</p>
                </div>
              )}
              {(() => {
                // Deduplicate messages before rendering to prevent React key errors
                const uniqueMessages = messages.reduce((acc: Message[], message) => {
                  if (!acc.some(m => m.id === message.id)) {
                    acc.push(message);
                  } else {
                    console.warn('[GROUP-CHAT] Duplicate message filtered during render:', message.id);
                  }
                  return acc;
                }, []);
                
                return uniqueMessages.map((message) => {
                  const isSystemMessage = message.isSystemMessage;
                  const isCurrentUser = message.senderId === localStorage.getItem('group-chat-user-id');
                  const isAIMessage = message.senderId === 'ai-agent' || message.role === 'assistant';

                  if (isSystemMessage) {
                    return (
                      <div key={message.id} className="text-center py-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400">
                          <span>{message.content}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isCurrentUser ? 'order-2' : ''}`}>
                        {message.senderName && !isCurrentUser && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-1">
                            {message.senderName}
                            {isAIMessage && ' 🤖'}
                          </p>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isCurrentUser
                              ? 'bg-blue-500 text-white'
                              : isAIMessage
                              ? 'bg-orange-100 dark:bg-orange-900/20 text-gray-900 dark:text-gray-100 border border-orange-200 dark:border-orange-800'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 px-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                {typingDisplay} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Message Input */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-end gap-2">
                <Textarea
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1"
                  disabled={connectionStatus !== 'connected'}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || connectionStatus !== 'connected'}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GroupChatView() {
  return <GroupChatContent />;
} 