"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, Trash2, Plus, X, RefreshCw } from "lucide-react";
import { AgentProfileSettings } from "@/lib/agent-profile/types";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { saveToLocalStorage, loadFromLocalStorage, LOCAL_STORAGE_KEYS } from "@/lib/storage/local-storage";
import { saveProfileSettings as apiSaveProfileSettings, loadProfileSettings } from "@/lib/storage/file-storage";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ProfileSettingsEditor() {
  const router = useRouter();
  
  // State for profile settings
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null);
  
  // State to track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);
  
  // Available GIF URLs for profile selection
  const gifUrls = [
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250215_1417_Confident+Startup+Smile_simple_compose_01jm5v0x50f2kaarp5nd556cbw.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250210_1742_Corporate+Serene+Smile_simple_compose_01jkq9gs6rea3v4n7w461rwye2.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1254_Confident+Startup+Professional_simple_compose_01jm0heqkvez2a2xbpsdh003z8.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1255_Startup+Workplace+Smile_simple_compose_01jm0hgd5afymrz6ewd1c0nbra.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1256_Confident+Startup+Glance_simple_compose_01jm0hj6cfedn8m2gr8ynrwbgs.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1300_Confident+Leader%27s+Smile_simple_compose_01jm0hsnkeftbs5cqkbg77h4sh.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1301_Friendly+Startup+Vibes_simple_compose_01jm0hw1vde4cbcts0rzdtz0h0.gif",
  ];

  // Set up event listener for save action from the floating bar
  useEffect(() => {
    const handleSaveEvent = () => {
      if (hasChanges && profileSettings) {
        saveProfileSettings();
      }
    };

    // Add event listener for the custom save event
    document.addEventListener('save-profile-settings', handleSaveEvent);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('save-profile-settings', handleSaveEvent);
    };
  }, [hasChanges, profileSettings]);

  // Load data on component mount
  useEffect(() => {
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
    
    loadServerData();
  }, []);

  // Save profile settings
  const saveProfileSettings = async () => {
    if (!profileSettings) return;
    
    try {
      // Save to server via API
      const success = await apiSaveProfileSettings(profileSettings);
      
      if (success) {
        toast.success("Profile settings saved successfully");
        setHasChanges(false);
      } else {
        // If server save fails, try local storage
        saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, profileSettings);
        toast.warning("Saved to browser only. Server save failed.");
      }
    } catch (error) {
      console.error("Error saving profile settings:", error);
      toast.error("Failed to save profile settings");
      
      // Fall back to local storage on error
      saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, profileSettings);
    }
  };

  // Reset profile settings to defaults
  

  // Add a new tone item
  const addToneItem = () => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      
      const updatedTones = [...prev.languageStyle.tone, ""];
      return { ...prev, languageStyle: { ...prev.languageStyle, tone: updatedTones } };
    });
    
    setHasChanges(true);
  };

  // Remove a tone item
  const removeToneItem = (index: number) => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      
      const updatedTones = prev.languageStyle.tone.filter((_, i: number) => i !== index);
      return { ...prev, languageStyle: { ...prev.languageStyle, tone: updatedTones } };
    });
    
    setHasChanges(true);
  };

  // Update a tone item
  const updateToneItem = (index: number, value: string) => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      
      const updatedTones = [...prev.languageStyle.tone];
      updatedTones[index] = value;
      return { ...prev, languageStyle: { ...prev.languageStyle, tone: updatedTones } };
    });
    
    setHasChanges(true);
  };

  // Add a new purpose item
  const addPurposeItem = () => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      
      const updatedPurposes = [...prev.botPurpose, ""];
      return { ...prev, botPurpose: updatedPurposes };
    });
    
    setHasChanges(true);
  };

  // Remove a purpose item
  const removePurposeItem = (index: number) => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      
      const updatedPurposes = prev.botPurpose.filter((_, i: number) => i !== index);
      return { ...prev, botPurpose: updatedPurposes };
    });
    
    setHasChanges(true);
  };

  // Update a purpose item
  const updatePurposeItem = (index: number, value: string) => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      
      const updatedPurposes = [...prev.botPurpose];
      updatedPurposes[index] = value;
      return { ...prev, botPurpose: updatedPurposes };
    });
    
    setHasChanges(true);
  };

  // Handle updating any profile setting field
  const handleProfileSettingChange = (field: keyof AgentProfileSettings, value: any) => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    
    setHasChanges(true);
  };

  // If settings haven't loaded yet, show a loading state
  if (!profileSettings) return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <Link href="/profile-editor/safety-editor" className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1">
          <span>Safety Settings</span>
          <span>&rarr;</span>
        </Link>
      </div>
      {/* Profile Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Configure the AI agent's identity and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent Name */}
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input
              id="agent-name"
              value={profileSettings.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleProfileSettingChange("name", e.target.value)
              }
              placeholder="e.g., Samantha"
            />
          </div>

          {/* Agent Role */}
          <div className="space-y-2">
            <Label htmlFor="agent-role">Agent Role</Label>
            <Input
              id="agent-role"
              value={profileSettings.role}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleProfileSettingChange("role", e.target.value)
              }
              placeholder="e.g., Product Manager"
            />
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={profileSettings.companyName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleProfileSettingChange("companyName", e.target.value)
              }
              placeholder="e.g., Acme Inc."
            />
          </div>

          {/* Company Description */}
          <div className="space-y-2">
            <Label htmlFor="company-description">Company Description</Label>
            <Textarea
              id="company-description"
              value={profileSettings.companyDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                handleProfileSettingChange("companyDescription", e.target.value)
              }
              placeholder="Brief description of the company"
              rows={3}
            />
          </div>

          {/* Agent Avatar */}
          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {gifUrls.map((url, index) => (
                <div
                  key={index}
                  className={`cursor-pointer border-2 rounded-lg overflow-hidden hover:opacity-80 transition-opacity ${
                    profileSettings.profileImageUrl === url
                      ? "border-blue-500 shadow-lg"
                      : "border-transparent"
                  }`}
                  onClick={() => handleProfileSettingChange("profileImageUrl", url)}
                >
                  <div className="relative">
                    <Image
                      src={url}
                      alt={`Avatar option ${index + 1}`}
                      width={200}
                      height={200}
                      unoptimized={true}
                      style={{
                        width: "100%",
                        height: "auto",
                        objectFit: "cover",
                      }}
                    />
                    {profileSettings.profileImageUrl === url && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <div className="bg-blue-500 text-white rounded-full p-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Tones */}
          <div className="space-y-2">
            <Label>Communication Tones</Label>
            <div className="space-y-3">
              {profileSettings.languageStyle.tone.map((tone: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={tone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateToneItem(index, e.target.value)
                    }
                    placeholder="e.g., Professional, Friendly, etc."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeToneItem(index)}
                    disabled={profileSettings.languageStyle.tone.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addToneItem}
                className="mt-2 w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tone
              </Button>
            </div>
          </div>

          {/* Agent Purposes */}
          <div className="space-y-2">
            <Label>Agent Purposes</Label>
            <div className="space-y-3">
              {profileSettings.botPurpose.map((purpose: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={purpose}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updatePurposeItem(index, e.target.value)
                    }
                    placeholder="e.g., Help with product strategy"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePurposeItem(index)}
                    disabled={profileSettings.botPurpose.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addPurposeItem}
                className="mt-2 w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Purpose
              </Button>
            </div>
          </div>

          {/* Language Settings */}
          <div className="space-y-2">
            <Label htmlFor="language">Primary Language</Label>
            <Input
              id="language"
              value={profileSettings.languageStyle.language}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProfileSettings({
                  ...profileSettings,
                  languageStyle: {
                    ...profileSettings.languageStyle,
                    language: e.target.value
                  }
                })
              }
              placeholder="e.g., English"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dialect">Dialect/Regional Variation</Label>
            <Input
              id="dialect"
              value={profileSettings.languageStyle.dialect}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setProfileSettings({
                  ...profileSettings,
                  languageStyle: {
                    ...profileSettings.languageStyle,
                    dialect: e.target.value
                  }
                });
                setHasChanges(true);
              }}
              placeholder="e.g., American English"
            />
          </div>

          {/* Other Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-personified">Personified Agent</Label>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Make the agent behave more like a real person
                </div>
              </div>
              <Switch
                id="is-personified"
                checked={profileSettings.isPersonified}
                onCheckedChange={(checked) =>
                  handleProfileSettingChange("isPersonified", checked)
                }
              />
            </div>
          </div>
          

        </CardContent>
        <CardFooter className="flex justify-between">

          {/* We can keep this button for direct saves, but the floating action bar is the primary save method */}
          <Button variant="outline" onClick={saveProfileSettings} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
