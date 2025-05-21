"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AgentProfileSettings } from "@/lib/agent-profile/types";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { loadProfileSettings } from "@/lib/storage/file-storage";
import { loadFromLocalStorage, saveToLocalStorage, LOCAL_STORAGE_KEYS } from "@/lib/storage/local-storage";
import { Users, AtSign } from "lucide-react";

export default function GroupChatSettingsPage() {
  const router = useRouter();
  
  // State for profile settings
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null);
  
  // State to track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);
  
  // Set up event listener for save action from the floating bar
  useEffect(() => {
    const handleSaveEvent = () => {
      if (hasChanges) {
        saveSettings();
      }
    };

    // Add event listener for the custom save event
    document.addEventListener('save-profile-settings', handleSaveEvent);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('save-profile-settings', handleSaveEvent);
    };
  }, [hasChanges]);

  // Load profile settings from the server
  const loadServerData = async () => {
    try {
      // Try to load profile settings from API first
      const profileData = await loadProfileSettings();
      if (profileData) {
        setProfileSettings(profileData);
      } else {
        // Check localStorage as fallback
        const storedSettings = loadFromLocalStorage<AgentProfileSettings>(LOCAL_STORAGE_KEYS.AGENT_PROFILE);
        setProfileSettings(storedSettings || { ...defaultAgentProfileSettings });
      }
    } catch (error) {
      console.error("Error loading profile settings:", error);
      toast.error("Failed to load profile settings");
      
      // Fallback to default settings
      setProfileSettings({ ...defaultAgentProfileSettings });
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadServerData();
  }, []);

  // Save settings to API and localStorage
  const saveSettings = async () => {
    if (!profileSettings) return;
    
    try {
      // Get the current requireMentionInGroupChats value
      const requireMention = profileSettings.agentSettings.requireMentionInGroupChats;
      
      // Update localStorage
      saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, profileSettings);
      
      // Send to group-chat-settings API specifically
      const response = await fetch('/api/group-chat-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requireMentionInGroupChats: requireMention }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setHasChanges(false);
        toast.success("Group chat settings saved successfully");
      } else {
        toast.error(data.error || "Failed to save to server");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error saving settings");
    }
  };

  // Toggle the require mention in group chats setting
  const toggleRequireMentionInGroupChats = () => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        agentSettings: {
          ...prev.agentSettings,
          requireMentionInGroupChats: !prev.agentSettings.requireMentionInGroupChats
        }
      };
    });
    
    setHasChanges(true);
  };

  if (!profileSettings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <Card className="shadow-md border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Group Chat Settings
        </CardTitle>
        <CardDescription>Configure how your agent behaves in group chats</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
              <AtSign className="h-6 w-6 text-blue-600 dark:text-blue-300" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-base">Only reply when tagged</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    When enabled, the agent will only respond in group chats when mentioned with @{process.env.A1BASE_AGENT_NUMBER || "your agent number"}.
                  </p>
                </div>
                <Switch 
                  checked={!!profileSettings?.agentSettings?.requireMentionInGroupChats} 
                  onCheckedChange={toggleRequireMentionInGroupChats}
                  id="require-mention-switch"
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm">
                <p className="text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> This setting helps reduce noise in busy group chats. When enabled, the agent will only
                  respond when someone specifically mentions it, making communications clearer and more intentional.
                </p>
              </div>
            </div>
          </div>
          
          {/* You can add more group chat settings here in the future */}
        </div>
      </CardContent>
    </Card>
  );
}
