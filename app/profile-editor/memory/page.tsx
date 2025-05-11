"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Brain, Save } from "lucide-react";
import { AgentMemorySettingsData } from "@/lib/agent-memory/types";
import { loadAgentMemorySettings, saveAgentMemorySettings } from "@/lib/storage/file-storage";
import { toast } from "sonner";

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
          setMemorySettings(memoryData);
        }
      } catch (error) {
        console.error("Error loading memory settings:", error);
        toast.error("Failed to load memory settings");
      }
    };
    
    loadMemoryData();
  }, []);

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

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Agent Memory</CardTitle>
          <CardDescription>
            Configure how your agent remembers information from conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {memorySettings ? (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="memory-enabled">Enable Memory Collection</Label>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {memorySettings.fields.find(f => f.name === "memoryCollectionEnabled")?.description || 
                      "Allow the agent to remember information from conversations"}
                  </div>
                </div>
                <Switch
                  id="memory-enabled"
                  checked={memorySettings.memoryCollectionEnabled}
                  onCheckedChange={(checked) => {
                    setMemorySettings({
                      ...memorySettings,
                      memoryCollectionEnabled: checked
                    });
                    setHasChanges(true);
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="information-to-save">Information to Save</Label>
                <Input
                  id="information-to-save"
                  value={memorySettings.informationToSave}
                  onChange={(e) => {
                    setMemorySettings({
                      ...memorySettings,
                      informationToSave: e.target.value
                    });
                    setHasChanges(true);
                  }}
                  disabled={!memorySettings.memoryCollectionEnabled}
                  placeholder="e.g., key concepts, user preferences, etc."
                  className="w-full"
                />
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {memorySettings.fields.find(f => f.name === "informationToSave")?.description || 
                    "Specify what kind of information the agent should retain."}
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
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
