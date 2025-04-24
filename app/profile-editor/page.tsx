"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Trash2, Plus, X, RefreshCw } from "lucide-react";
import { AgentProfileSettings, InformationSection } from "@/lib/agent-profile/types";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import agentBaseInformation, { defaultBaseInformation } from "@/lib/agent-profile/agent-base-information";
import { saveToLocalStorage, loadFromLocalStorage, LOCAL_STORAGE_KEYS } from "@/lib/storage/local-storage";
import { saveProfileSettings as apiSaveProfileSettings, loadProfileSettings, saveBaseInformation as apiSaveBaseInformation, loadBaseInformation } from "@/lib/storage/file-storage";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ProfileEditor() {
  const router = useRouter();
  
  // State for profile settings
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null);
  
  // State for base information
  const [baseInformation, setBaseInformation] = useState<InformationSection[]>([]);
  
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

  // Load data on component mount
  useEffect(() => {
    // Load profile settings and base information from the server
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
        
        // Try to load base information from API first
        const infoData = await loadBaseInformation();
        if (infoData) {
          setBaseInformation(infoData);
        } else {
          // Check localStorage as fallback
          const storedInfo = loadFromLocalStorage<InformationSection[]>(LOCAL_STORAGE_KEYS.AGENT_INFORMATION);
          setBaseInformation(storedInfo || [...defaultBaseInformation]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to localStorage
        const storedSettings = loadFromLocalStorage<AgentProfileSettings>(LOCAL_STORAGE_KEYS.AGENT_PROFILE);
        setProfileSettings(storedSettings || { ...defaultAgentProfileSettings });
        
        const storedInfo = loadFromLocalStorage<InformationSection[]>(LOCAL_STORAGE_KEYS.AGENT_INFORMATION);
        setBaseInformation(storedInfo || [...defaultBaseInformation]);
      }
    };
    
    loadServerData();
  }, []);

  // Save profile settings
  const saveProfileSettings = async () => {
    if (profileSettings) {
      try {
        // Try to save to server API first
        const success = await apiSaveProfileSettings(profileSettings);
        
        // Always save to localStorage as fallback
        saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, profileSettings);
        
        if (success) {
          toast.success("Profile settings saved successfully!");
        } else {
          toast.warning("Saved to browser only. Server storage unavailable.");
        }
        
        setHasChanges(false);
      } catch (error) {
        console.error('Error saving profile settings:', error);
        // Fallback to localStorage only
        saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, profileSettings);
        toast.warning("Saved to browser only. Server storage unavailable.");
        setHasChanges(false);
      }
    }
  };

  // Save base information
  const saveBaseInfo = async () => {
    try {
      // Try to save to server API first
      const success = await apiSaveBaseInformation(baseInformation);
      
      // Always save to localStorage as fallback
      saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_INFORMATION, baseInformation);
      
      if (success) {
        toast.success("Base information saved successfully!");
      } else {
        toast.warning("Saved to browser only. Server storage unavailable.");
      }
      
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving base information:', error);
      // Fallback to localStorage only
      saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_INFORMATION, baseInformation);
      toast.warning("Saved to browser only. Server storage unavailable.");
      setHasChanges(false);
    }
  };

  // Reset profile settings to defaults
  const resetProfileSettings = async () => {
    if (confirm("Are you sure you want to reset to default profile settings? This action cannot be undone.")) {
      setProfileSettings({ ...defaultAgentProfileSettings });
      
      try {
        // Save defaults to server
        const response = await fetch('/api/profile-settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ settings: defaultAgentProfileSettings }),
        });
        
        // Also update localStorage
        saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, { ...defaultAgentProfileSettings });
        
        toast.info("Profile settings reset to defaults");
        setHasChanges(false);
      } catch (error) {
        console.error('Error resetting profile settings:', error);
        // Fallback to localStorage only
        saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, { ...defaultAgentProfileSettings });
        toast.warning("Reset in browser only. Server storage unavailable.");
        setHasChanges(false);
      }
    }
  };

  // Reset base information to defaults
  const resetBaseInformation = async () => {
    if (confirm("Are you sure you want to reset to default base information? This action cannot be undone.")) {
      setBaseInformation([...defaultBaseInformation]);
      
      try {
        // Save defaults to server
        const response = await fetch('/api/base-information', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ information: defaultBaseInformation }),
        });
        
        // Also update localStorage
        saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_INFORMATION, [...defaultBaseInformation]);
        
        toast.info("Base information reset to defaults");
        setHasChanges(false);
      } catch (error) {
        console.error('Error resetting base information:', error);
        // Fallback to localStorage only
        saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_INFORMATION, [...defaultBaseInformation]);
        toast.warning("Reset in browser only. Server storage unavailable.");
        setHasChanges(false);
      }
    }
  };

  // Add a new tone item
  const addToneItem = () => {
    if (profileSettings) {
      const newTone = [...profileSettings.languageStyle.tone, ""];
      setProfileSettings({
        ...profileSettings,
        languageStyle: {
          ...profileSettings.languageStyle,
          tone: newTone
        }
      });
      setHasChanges(true);
    }
  };

  // Remove a tone item
  const removeToneItem = (index: number) => {
    if (profileSettings) {
      const newTone = [...profileSettings.languageStyle.tone];
      newTone.splice(index, 1);
      setProfileSettings({
        ...profileSettings,
        languageStyle: {
          ...profileSettings.languageStyle,
          tone: newTone
        }
      });
      setHasChanges(true);
    }
  };

  // Update a tone item
  const updateToneItem = (index: number, value: string) => {
    if (profileSettings) {
      const newTone = [...profileSettings.languageStyle.tone];
      newTone[index] = value;
      setProfileSettings({
        ...profileSettings,
        languageStyle: {
          ...profileSettings.languageStyle,
          tone: newTone
        }
      });
      setHasChanges(true);
    }
  };

  // Add a new purpose item
  const addPurposeItem = () => {
    if (profileSettings) {
      const newPurpose = [...profileSettings.botPurpose, ""];
      setProfileSettings({
        ...profileSettings,
        botPurpose: newPurpose
      });
      setHasChanges(true);
    }
  };

  // Remove a purpose item
  const removePurposeItem = (index: number) => {
    if (profileSettings) {
      const newPurpose = [...profileSettings.botPurpose];
      newPurpose.splice(index, 1);
      setProfileSettings({
        ...profileSettings,
        botPurpose: newPurpose
      });
      setHasChanges(true);
    }
  };

  // Update a purpose item
  const updatePurposeItem = (index: number, value: string) => {
    if (profileSettings) {
      const newPurpose = [...profileSettings.botPurpose];
      newPurpose[index] = value;
      setProfileSettings({
        ...profileSettings,
        botPurpose: newPurpose
      });
      setHasChanges(true);
    }
  };

  // Add a new information section
  const addInformationSection = () => {
    const newSection: InformationSection = {
      title: "New Section",
      content: "",
      priority: 5
    };
    setBaseInformation([...baseInformation, newSection]);
    setHasChanges(true);
  };

  // Remove an information section
  const removeInformationSection = (index: number) => {
    const newInformation = [...baseInformation];
    newInformation.splice(index, 1);
    setBaseInformation(newInformation);
    setHasChanges(true);
  };

  // Update an information section
  const updateInformationSection = (index: number, field: keyof InformationSection, value: string | number) => {
    const newInformation = [...baseInformation];
    newInformation[index] = {
      ...newInformation[index],
      [field]: value
    };
    setBaseInformation(newInformation);
    setHasChanges(true);
  };

  if (!profileSettings) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p>Loading profile editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Agent Profile Editor</h1>
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
              Unsaved Changes
            </Badge>
          )}
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => router.refresh()}
            title="Refresh the page"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="default" 
            onClick={() => {
              saveProfileSettings();
              saveBaseInfo();
            }}
            disabled={!hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            Save All Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Profile Settings</TabsTrigger>
          <TabsTrigger value="information">Base Information</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Configure the basic identity of your AI agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Image Selection */}
                <div className="space-y-2">
                  <Label>Profile Image</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4 mt-2">
                    {gifUrls.map((url, index) => (
                      <div 
                        key={index} 
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 ${profileSettings.profileImageUrl === url ? 'border-blue-500' : 'border-transparent'} transition-all hover:border-blue-300`}
                        onClick={() => {
                          setProfileSettings({ ...profileSettings, profileImageUrl: url });
                          setHasChanges(true);
                        }}
                      >
                        <Image 
                          src={url} 
                          alt={`Profile option ${index + 1}`}
                          width={80} 
                          height={80} 
                          className="object-cover"
                          unoptimized // Required for GIFs to animate
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
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Select a profile image for your AI agent. This will be displayed in the chat interface.
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input 
                    id="name" 
                    value={profileSettings.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setProfileSettings({ ...profileSettings, name: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Agent Role</Label>
                  <Input 
                    id="role" 
                    value={profileSettings.role}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setProfileSettings({...profileSettings, role: e.target.value});
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input 
                    id="companyName" 
                    value={profileSettings.companyName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setProfileSettings({...profileSettings, companyName: e.target.value});
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyDescription">Company Description</Label>
                  <Textarea 
                    id="companyDescription" 
                    value={profileSettings.companyDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      setProfileSettings({...profileSettings, companyDescription: e.target.value});
                      setHasChanges(true);
                    }}
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="isPersonified" 
                    checked={profileSettings.isPersonified}
                    onCheckedChange={(checked: boolean) => {
                      setProfileSettings({...profileSettings, isPersonified: checked});
                      setHasChanges(true);
                    }}
                  />
                  <Label htmlFor="isPersonified">Personified Agent</Label>
                </div>
              </CardContent>
            </Card>

            {/* Bot Purpose */}
            <Card>
              <CardHeader>
                <CardTitle>Bot Purpose</CardTitle>
                <CardDescription>
                  Define the primary objectives of your AI agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profileSettings.botPurpose.map((purpose, index) => (
                    <div key={index} className="flex space-x-2">
                      <Textarea 
                        value={purpose}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePurposeItem(index, e.target.value)}
                        rows={2}
                        className="flex-1"
                      />
                      <Button 
                        variant="destructive" 
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
                    onClick={addPurposeItem}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Purpose
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Language Style */}
            <Card>
              <CardHeader>
                <CardTitle>Language Style</CardTitle>
                <CardDescription>
                  Configure how your AI agent communicates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Primary Language</Label>
                  <Input 
                    id="language" 
                    value={profileSettings.languageStyle.language}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setProfileSettings({
                        ...profileSettings, 
                        languageStyle: {
                          ...profileSettings.languageStyle,
                          language: e.target.value
                        }
                      });
                      setHasChanges(true);
                    }}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone & Communication Style</Label>
                  <div className="space-y-3">
                    {profileSettings.languageStyle.tone.map((toneItem, index) => (
                      <div key={index} className="flex space-x-2">
                        <Textarea 
                          value={toneItem}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateToneItem(index, e.target.value)}
                          rows={2}
                          className="flex-1"
                        />
                        <Button 
                          variant="destructive" 
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
                      onClick={addToneItem}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tone
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workflow & Agent Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Configure workflow and agent-specific behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workflow">Workflow Type</Label>
                  <Input 
                    id="workflow" 
                    value={profileSettings.workflowSettings.workflow}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setProfileSettings({
                        ...profileSettings, 
                        workflowSettings: {
                          ...profileSettings.workflowSettings,
                          workflow: e.target.value
                        }
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent">Agent Type</Label>
                  <Input 
                    id="agent" 
                    value={profileSettings.agentSettings.agent}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setProfileSettings({
                        ...profileSettings, 
                        agentSettings: {
                          ...profileSettings.agentSettings,
                          agent: e.target.value
                        }
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="destructive" 
                  onClick={resetProfileSettings}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset to Default Profile
                </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="mt-6 flex justify-end">
            <Button 
              variant="default" 
              onClick={saveProfileSettings}
              disabled={!hasChanges}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Profile Settings
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="information">
          <div className="space-y-6">
            {/* Base Information Sections */}
            {baseInformation.map((section, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <CardTitle>Information Section</CardTitle>
                      <CardDescription>
                        Knowledge provided to the AI agent as context
                      </CardDescription>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => removeInformationSection(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`section-title-${index}`}>Section Title</Label>
                    <Input 
                      id={`section-title-${index}`} 
                      value={section.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInformationSection(index, 'title', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`section-content-${index}`}>Content</Label>
                    <Textarea 
                      id={`section-content-${index}`} 
                      value={section.content}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateInformationSection(index, 'content', e.target.value)}
                      rows={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`section-priority-${index}`}>Priority (higher = more important)</Label>
                    <Input 
                      id={`section-priority-${index}`}
                      type="number"
                      min="1"
                      max="10" 
                      value={section.priority}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateInformationSection(index, 'priority', parseInt(e.target.value, 10))}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Add Section Button */}
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={addInformationSection}
                className="w-full md:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Information Section
              </Button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button 
                variant="destructive" 
                onClick={resetBaseInformation}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Reset to Default Information
              </Button>
              <Button 
                variant="default" 
                onClick={saveBaseInfo}
                disabled={!hasChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Information
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Button */}
      <div className="mt-8 flex justify-center">
        <Link href="/chat">
          <Button variant="default" className="bg-gradient-to-r from-blue-600 to-blue-800">
            Preview Agent with Current Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
