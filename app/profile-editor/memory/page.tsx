"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Brain, Save, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { AgentMemorySettingsData, CustomMemoryField } from "@/lib/agent-memory/types";
import { loadAgentMemorySettings, saveAgentMemorySettings } from "@/lib/storage/file-storage";
import { toast } from "sonner";

// Define a type for the memory scope
type MemoryScope = 'user' | 'chat';

export default function AgentMemoryPage() {
  // State for agent memory settings
  const [memorySettings, setMemorySettings] = useState<AgentMemorySettingsData | null>(null);
  
  // State to track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);

  // Set up event listener for save action from the floating bar
  useEffect(() => {
    const handleSaveEvent = () => {
      if (hasChanges && memorySettings) {
        saveMemorySettings();
      }
    };

    // Add event listener for the custom save event
    document.addEventListener('save-profile-settings', handleSaveEvent);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('save-profile-settings', handleSaveEvent);
    };
  }, [hasChanges, memorySettings]);

  // Load data on component mount
  useEffect(() => {
    const loadMemoryData = async () => {
      try {
        const memoryData = await loadAgentMemorySettings();
        if (memoryData) {
          setMemorySettings({
            // Spread existing data first, then ensure new fields exist
            ...memoryData,
            userMemoryEnabled: memoryData.userMemoryEnabled || false,
            userMemoryFields: memoryData.userMemoryFields || [],
            chatMemoryEnabled: memoryData.chatMemoryEnabled || false,
            chatThreadMemoryFields: memoryData.chatThreadMemoryFields || [],
            // Ensure other fields from the type are present if they could be missing
            memoryTypeNote: memoryData.memoryTypeNote || "Configure agent memory types. When a message is received, the memory function checks if anything needs to be updated.",
            fields: memoryData.fields || [], 
            title: memoryData.title || "Agent Memory Settings",
            description: memoryData.description || "Configure agent memory."
          });
        } else {
          // Initialize with default structure if no data is loaded
          setMemorySettings({
            userMemoryEnabled: true, // Enabled by default
            userMemoryFields: [
              { id: "default-user-role", title: "User's Role/Industry", description: "The professional role or industry the user works in (e.g., Software Engineer, Healthcare)." },
              { id: "default-user-interests", title: "Key Goals/Interests", description: "User's primary goals for interacting or their main topics of interest (e.g., Learning Python, Project Management Tips)." },
            ],
            chatMemoryEnabled: true, // Enabled by default
            chatThreadMemoryFields: [
              { id: "default-chat-topic", title: "Current Discussion Topic", description: "The main subject or problem being discussed in the current chat session (e.g., Debugging a specific function, Brainstorming ideas for X)." },
              { id: "default-chat-summary", title: "Brief Conversation Summary", description: "A short summary of the key points or decisions made so far in this thread." },
            ],
            memoryTypeNote: "User memory is persistent across chats. Chat thread memory is scoped to the current conversation.",
            fields: [], 
            title: "Agent Memory Settings",
            description: "Configure agent memory for user-level and chat-specific contexts."
          });
        }
      } catch (error) {
        console.error("Error loading memory settings:", error);
        toast.error("Failed to load memory settings");
      }
    };
    
    loadMemoryData();
  }, []);

  const handleEnabledChange = (scope: MemoryScope, checked: boolean) => {
    if (!memorySettings) return;
    if (scope === 'user') {
      setMemorySettings({ ...memorySettings, userMemoryEnabled: checked });
    } else {
      setMemorySettings({ ...memorySettings, chatMemoryEnabled: checked });
    }
    setHasChanges(true);
  };

  const handleFieldChange = (scope: MemoryScope, index: number, field: keyof CustomMemoryField, value: string) => {
    if (!memorySettings) return;
    const fieldsToUpdate = scope === 'user' ? memorySettings.userMemoryFields : memorySettings.chatThreadMemoryFields;
    const updatedFields = [...fieldsToUpdate];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    if (scope === 'user') {
      setMemorySettings({ ...memorySettings, userMemoryFields: updatedFields });
    } else {
      setMemorySettings({ ...memorySettings, chatThreadMemoryFields: updatedFields });
    }
    setHasChanges(true);
  };

  const addField = (scope: MemoryScope) => {
    if (!memorySettings) return;
    const newField: CustomMemoryField = { id: Date.now().toString(), title: "", description: "" };
    if (scope === 'user') {
      setMemorySettings({
        ...memorySettings,
        userMemoryFields: [...memorySettings.userMemoryFields, newField],
      });
    } else {
      setMemorySettings({
        ...memorySettings,
        chatThreadMemoryFields: [...memorySettings.chatThreadMemoryFields, newField],
      });
    }
    setHasChanges(true);
  };

  const removeField = (scope: MemoryScope, index: number) => {
    if (!memorySettings) return;
    if (scope === 'user') {
      const updatedFields = memorySettings.userMemoryFields.filter((_, i) => i !== index);
      setMemorySettings({ ...memorySettings, userMemoryFields: updatedFields });
    } else {
      const updatedFields = memorySettings.chatThreadMemoryFields.filter((_, i) => i !== index);
      setMemorySettings({ ...memorySettings, chatThreadMemoryFields: updatedFields });
    }
    setHasChanges(true);
  };

  // Save memory settings
  const saveMemorySettings = async () => {
    if (!memorySettings) return;
    
    try {
      // Save to server via API
      const success = await saveAgentMemorySettings(memorySettings);
      
      if (success) {
        toast.success("Memory settings saved successfully");
        setHasChanges(false);
      } else {
        toast.warning("Failed to save memory settings to server");
      }
    } catch (error) {
      console.error("Error saving memory settings:", error);
      toast.error("Failed to save memory settings");
    }
  };

  // Helper function to render a memory field section
  const renderMemorySection = (scope: MemoryScope) => {
    if (!memorySettings) return null;

    const isEnabled = scope === 'user' ? memorySettings.userMemoryEnabled : memorySettings.chatMemoryEnabled;
    const fields = scope === 'user' ? memorySettings.userMemoryFields : memorySettings.chatThreadMemoryFields;
    const title = scope === 'user' ? "User Memory Settings" : "Chat Thread Memory Settings";
    const description = scope === 'user' 
      ? "User memory is persistent across all chats with this user. Useful for remembering general preferences, key details about the user, etc."
      : "Chat thread memory is scoped to a specific individual or group chat. Good for recalling context from the current conversation flow.";

    return (
      <div className="space-y-6 pt-6 first:pt-0">
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
          <Switch
            id={`${scope}-memory-enabled`}
            checked={isEnabled}
            onCheckedChange={(checked) => handleEnabledChange(scope, checked)}
          />
        </div>

        {isEnabled && (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-md space-y-3 bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-between items-center">
                  <Label htmlFor={`${scope}-field-title-${index}`} className="text-base">
                    Field #{index + 1}
                  </Label>
                  <Button variant="ghost" size="icon" onClick={() => removeField(scope, index)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor={`${scope}-field-title-${index}`}>Title</Label>
                  <Input
                    id={`${scope}-field-title-${index}`}
                    value={field.title}
                    onChange={(e) => handleFieldChange(scope, index, "title", e.target.value)}
                    placeholder={`e.g., User's ${scope === 'user' ? 'Role' : 'Current Goal'}`}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor={`${scope}-field-description-${index}`}>Description / Instructions</Label>
                  <Textarea
                    id={`${scope}-field-description-${index}`}
                    value={field.description}
                    onChange={(e) => handleFieldChange(scope, index, "description", e.target.value)}
                    placeholder={`e.g., Instructions for the AI on how to use this memory field.`}
                    className="w-full"
                    rows={3}
                  />
                </div>
              </div>
            ))}
            <Button onClick={() => addField(scope)} variant="outline">
              Add New Field for {scope === 'user' ? 'User' : 'Chat Thread'} Memory
            </Button>
          </div>
        )}
        {!isEnabled && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {scope === 'user' ? "User" : "Chat Thread"} memory is currently disabled.
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>{memorySettings?.title || "Agent Memory"}</CardTitle>
          <CardDescription>
            {memorySettings?.description || "Configure how your agent remembers information from conversations."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 divide-y divide-gray-200 dark:divide-gray-700">
          {memorySettings ? (
            <>
              {renderMemorySection('user')}
              {renderMemorySection('chat')}
              
              {/* General Note Section - can be kept if still relevant */}
              {memorySettings.memoryTypeNote && (
                 <div className="mt-8 pt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start">
                    <Brain className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">About Memory Features</h3>
                      <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                        {memorySettings.memoryTypeNote}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-500">Loading memory settings...</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={saveMemorySettings} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
