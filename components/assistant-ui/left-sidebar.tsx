"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PhoneIcon, MessageSquareIcon, Mail, Plus, Users, Sparkles, Share2, MessageCircle } from "lucide-react";
import { useRouter, usePathname } from 'next/navigation';
import { AgentProfileSettings } from "@/lib/agent-profile/types";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { loadProfileSettings } from "@/lib/storage/file-storage";
import { loadFromLocalStorage, LOCAL_STORAGE_KEYS } from "@/lib/storage/local-storage";
import { v4 as uuidv4 } from "uuid";

interface Chat {
  id: string;
  external_id: string;
  name: string;
  type: string;
  created_at: string;
  service: string;
}

// Multi-user chat section component
const MultiUserChatSection: React.FC = () => {
  const router = useRouter();

  const handleNewGroupChat = () => {
    // Generate a new chat ID and navigate to it
    const newChatId = uuidv4();
    router.push(`/chat/${newChatId}`);
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-900/20 via-black to-indigo-900/20 dark:from-purple-900/40 dark:via-black dark:to-indigo-900/40 p-5 border border-purple-500/20 dark:border-purple-500/30">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-indigo-600/10 animate-pulse" />
      
      {/* Glow effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 dark:bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header with icon */}
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 dark:from-purple-500/30 dark:to-indigo-500/30 rounded-lg backdrop-blur-sm">
            <Users className="h-5 w-5 text-purple-300 dark:text-purple-200" />
          </div>
          <h3 className="text-lg font-bold bg-gradient-to-r from-purple-200 to-indigo-200 dark:from-purple-100 dark:to-indigo-100 bg-clip-text text-transparent">
            Group Chats
          </h3>
          <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
        </div>
        
        {/* Enhanced description */}
        <p className="text-sm text-gray-300 dark:text-gray-200 mb-4 leading-relaxed">
          Start live conversations with friends, collaborate in real-time, and share your AI assistant
        </p>
        
        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="px-2 py-1 bg-purple-500/20 dark:bg-purple-500/30 rounded-full text-xs text-purple-200 dark:text-purple-100 flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            Real-time chat
          </div>
          <div className="px-2 py-1 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full text-xs text-indigo-200 dark:text-indigo-100 flex items-center gap-1">
            <Share2 className="h-3 w-3" />
            Share instantly
          </div>
        </div>
        
        {/* CTA Button */}
        <Button
          onClick={handleNewGroupChat}
          size="default"
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-purple-500/25 dark:hover:shadow-purple-500/40 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400/0 via-white/20 to-purple-400/0 -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
          <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
          <span className="relative z-10">Start Group Chat</span>
        </Button>
        
        {/* Subtle hint */}
        <div className="mt-3 flex items-center justify-center gap-1 text-xs text-gray-400 dark:text-gray-300">
          <span className="opacity-70">Opens in new tab</span>
          <span className="text-purple-400 dark:text-purple-300">•</span>
          <span className="opacity-70">Invite unlimited friends</span>
        </div>
      </div>
    </div>
  );
};

// The client-side LeftSidebar component which loads profile data on the client
export const LeftSidebar: React.FC = () => {
  // Initialize with null and update after client-side data fetch
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null);

  // Load the profile settings client-side
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try API first
        const apiSettings = await loadProfileSettings();
        if (apiSettings) {
          setProfileSettings(apiSettings);
          return;
        }
        
        // Next try localStorage
        const localSettings = loadFromLocalStorage<AgentProfileSettings>(
          LOCAL_STORAGE_KEYS.AGENT_PROFILE
        );
        if (localSettings) {
          setProfileSettings(localSettings);
          return;
        }
        
      } catch (error) {
        console.error('Error loading profile settings:', error);
      }
      
      // Fall back to defaults if nothing else works
      setProfileSettings(defaultAgentProfileSettings);
    };
    
    loadSettings();
  }, []);

  // Show a placeholder or loading state until settings are loaded
  if (!profileSettings) {
    return <div className="h-full w-full p-4 space-y-6">Loading...</div>;
  }
  
  return (
    <div className="h-full w-full p-4 space-y-6 flex flex-col overflow-y-auto">
      {/* Agent Profile Section */}
      <div className="flex-shrink-0">
        <div className="w-full relative">
          <Image
            src={profileSettings.profileImageUrl || "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250215_1417_Confident+Startup+Smile_simple_compose_01jm5v0x50f2kaarp5nd556cbw.gif"}
            alt={`${profileSettings.name} Profile`}
            width={3840}
            height={2160}
            quality={75}
            className="w-full rounded-lg object-cover"
            style={{ width: "100%", height: "auto" }}
            unoptimized
          />
          <div className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-white shadow-lg overflow-hidden">
            <Image
              src="/a1base-favicon.png"
              alt="Logo"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="mt-4 text-sm">
          <h2 className="text-2xl font-medium">
            <span className="text-black font-bold">
              {profileSettings.name}
            </span>
            <span className="text-gray-500 text-base">
              {" "}
              - {profileSettings.role}
            </span>
          </h2>
          <div className="my-2 flex items-center">
            <div className="h-px flex-grow bg-border" />
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {profileSettings.botPurpose[0]}
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="bg-blue-50 hover:bg-blue-100"
            >
              <PhoneIcon className="h-4 w-4 text-blue-600" />
              <span className="sr-only">Phone Call</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-green-50 hover:bg-green-100"
            >
              <MessageSquareIcon className="h-4 w-4 text-green-600" />
              <span className="sr-only">SMS</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-purple-50 hover:bg-purple-100"
            >
              <Mail className="h-4 w-4 text-purple-600" />
              <span className="sr-only">Email</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Multi-User Chat Section */}
      <div className="flex-1 min-h-0 pb-6">
        <MultiUserChatSection />
      </div>
    </div>
  );
};
