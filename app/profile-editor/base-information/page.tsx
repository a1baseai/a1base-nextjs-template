"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, Trash2, Plus } from "lucide-react";
import { InformationSection } from "@/lib/agent-profile/types";
import { defaultBaseInformation } from "@/lib/agent-profile/agent-base-information";
import { saveToLocalStorage, loadFromLocalStorage, LOCAL_STORAGE_KEYS } from "@/lib/storage/local-storage";
import { saveBaseInformation as apiSaveBaseInformation, loadBaseInformation } from "@/lib/storage/file-storage";
import { toast } from "sonner";

export default function BaseInformationEditor() {
  const router = useRouter();
  
  // State for base information
  const [baseInformation, setBaseInformation] = useState<InformationSection[]>([]);
  
  // State to track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);
  
  // State to track if data loading is complete (even if empty)
  const [isLoaded, setIsLoaded] = useState(false);

  // Set up event listener for save action from the floating bar
  useEffect(() => {
    const handleSaveEvent = () => {
      if (hasChanges) {
        saveBaseInfo();
      }
    };

    // Add event listener for the custom save event
    document.addEventListener('save-profile-settings', handleSaveEvent);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('save-profile-settings', handleSaveEvent);
    };
  }, [hasChanges]);

  // Load data on component mount
  useEffect(() => {
    // Load base information from the server
    const loadServerData = async () => {
      try {
        // Try to load base information from API first
        const infoData = await loadBaseInformation();
        if (infoData) {
          setBaseInformation(infoData);
        } else {
          // Check localStorage as fallback
          const storedInfo = loadFromLocalStorage<InformationSection[]>(LOCAL_STORAGE_KEYS.AGENT_INFORMATION);
          setBaseInformation(storedInfo || []);
        }
      } catch (error) {
        console.error("Error loading base information:", error);
        toast.error("Failed to load base information");
        
        // Leave as empty array if there's an error
        setBaseInformation([]);
      } finally {
        // Mark loading as complete regardless of result
        setIsLoaded(true);
      }
    };
    
    loadServerData();
  }, []);

  // Save base information
  const saveBaseInfo = async () => {
    try {
      // Save to API
      await apiSaveBaseInformation(baseInformation);
      
      // Save to localStorage as backup
      saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_INFORMATION, baseInformation);
      
      setHasChanges(false);
      toast.success("Base information saved successfully!");
    } catch (error) {
      console.error("Error saving base information:", error);
      
      // Try to save to localStorage even if API fails
      saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_INFORMATION, baseInformation);
      
      toast.error("Failed to save to server, but saved locally");
    }
  };

  

  // Add a new information section
  const addInformationSection = () => {
    setBaseInformation(prev => [
      ...prev,
      { title: "New Section", content: "", priority: 5 }
    ]);
    
    setHasChanges(true);
  };

  // Remove an information section
  const removeInformationSection = (index: number) => {
    setBaseInformation(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  // Update an information section
  const updateInformationSection = (index: number, field: keyof InformationSection, value: string | number) => {
    setBaseInformation(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    
    setHasChanges(true);
  };

  // Only show loading spinner while data is being loaded
  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Empty State UI */}
      {baseInformation.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-blue-100 p-3">
              <Plus className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">No Information Sections Yet</h3>
            <p className="mb-6 text-gray-500 max-w-md">
              Add your first information section to provide context to your AI assistant. 
              This helps your assistant understand your business, products, or services.
            </p>
            <Button onClick={addInformationSection} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Section
            </Button>
          </CardContent>
        </Card>
      )}
      
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
          variant="outline" 
          onClick={saveBaseInfo}
          disabled={!hasChanges}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}
