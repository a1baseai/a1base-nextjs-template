"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PhoneIcon, MessageSquareIcon, Mail, Plus, Users } from "lucide-react";
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
    // Generate a new chat ID and open it in a new tab
    const newChatId = uuidv4();
    window.open(`/chat/${newChatId}`, '_blank');
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      {/* Chat Section Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Group Chats
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Create shareable conversations
        </p>
        
        <Button
          onClick={handleNewGroupChat}
          size="sm"
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
        >
          <Plus className="h-3 w-3" />
          <span>New Group Chat</span>
        </Button>
        
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
          Opens in new tab
        </p>
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
    <div className="h-full w-full p-4 space-y-6 flex flex-col">
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
      <div className="flex-1 min-h-0">
        <MultiUserChatSection />
      </div>
    </div>
  );
};
