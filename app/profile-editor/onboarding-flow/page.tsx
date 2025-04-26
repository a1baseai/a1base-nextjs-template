"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown, MessageSquare, Bot, Save } from "lucide-react";
import { OnboardingFlow, OnboardingMessage, defaultOnboardingFlow } from "@/lib/onboarding-flow/types";
import { loadOnboardingFlow, saveOnboardingFlow } from "@/lib/onboarding-flow/onboarding-storage";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function OnboardingFlowBuilder() {
  // State for onboarding flow
  const [onboardingFlow, setOnboardingFlow] = useState<OnboardingFlow | null>(null);
  
  // State to track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);

  // Set up event listener for save action from the floating bar
  useEffect(() => {
    const handleSaveEvent = () => {
      if (hasChanges && onboardingFlow) {
        saveOnboardingFlowSettings();
      }
    };

    // Add event listener for the custom save event
    document.addEventListener('save-profile-settings', handleSaveEvent);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('save-profile-settings', handleSaveEvent);
    };
  }, [hasChanges, onboardingFlow]);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const flowData = await loadOnboardingFlow();
        if (flowData) {
          setOnboardingFlow(flowData);
        } else {
          setOnboardingFlow({ ...defaultOnboardingFlow });
        }
      } catch (error) {
        console.error("Error loading onboarding flow settings:", error);
        toast.error("Failed to load onboarding flow settings");
        
        // Fallback to default settings
        setOnboardingFlow({ ...defaultOnboardingFlow });
      }
    };
    
    loadData();
  }, []);

  // Save onboarding flow settings
  const saveOnboardingFlowSettings = async () => {
    if (!onboardingFlow) return;
    
    try {
      const success = await saveOnboardingFlow(onboardingFlow);
      
      if (success) {
        setHasChanges(false);
        toast.success("Onboarding flow settings saved successfully");
      } else {
        toast.error("Failed to save onboarding flow settings");
      }
    } catch (error) {
      console.error("Error saving onboarding flow settings:", error);
      toast.error("Failed to save onboarding flow settings");
    }
  };

  // Reset onboarding flow settings to defaults
  const resetOnboardingFlow = () => {
    setOnboardingFlow({ ...defaultOnboardingFlow });
    setHasChanges(true);
    toast.info("Onboarding flow settings reset to defaults");
  };

  // Add a new message
  const addMessage = () => {
    if (!onboardingFlow) return;
    
    const newMessage: OnboardingMessage = {
      id: uuidv4(),
      text: "Type your message here...",
      waitForResponse: false,
      order: onboardingFlow.messages.length + 1
    };
    
    const updatedMessages = [...onboardingFlow.messages, newMessage];
    
    setOnboardingFlow({
      ...onboardingFlow,
      messages: updatedMessages
    });
    
    setHasChanges(true);
  };

  // Remove a message
  const removeMessage = (id: string) => {
    if (!onboardingFlow) return;
    
    const updatedMessages = onboardingFlow.messages
      .filter(message => message.id !== id)
      .map((message, index) => ({
        ...message,
        order: index + 1
      }));
    
    setOnboardingFlow({
      ...onboardingFlow,
      messages: updatedMessages
    });
    
    setHasChanges(true);
  };

  // Update a message
  const updateMessage = (id: string, field: keyof OnboardingMessage, value: any) => {
    if (!onboardingFlow) return;
    
    const updatedMessages = onboardingFlow.messages.map(message => {
      if (message.id === id) {
        return {
          ...message,
          [field]: value
        };
      }
      return message;
    });
    
    setOnboardingFlow({
      ...onboardingFlow,
      messages: updatedMessages
    });
    
    setHasChanges(true);
  };

  // Move message up in order
  const moveMessageUp = (id: string) => {
    if (!onboardingFlow) return;
    
    const messageIndex = onboardingFlow.messages.findIndex(message => message.id === id);
    
    if (messageIndex <= 0) return; // Can't move up if it's the first message
    
    const updatedMessages = [...onboardingFlow.messages];
    
    // Swap with the message above
    const temp = { ...updatedMessages[messageIndex] };
    updatedMessages[messageIndex] = { ...updatedMessages[messageIndex - 1], order: messageIndex + 1 };
    updatedMessages[messageIndex - 1] = { ...temp, order: messageIndex };
    
    setOnboardingFlow({
      ...onboardingFlow,
      messages: updatedMessages
    });
    
    setHasChanges(true);
  };

  // Move message down in order
  const moveMessageDown = (id: string) => {
    if (!onboardingFlow) return;
    
    const messageIndex = onboardingFlow.messages.findIndex(message => message.id === id);
    
    if (messageIndex >= onboardingFlow.messages.length - 1) return; // Can't move down if it's the last message
    
    const updatedMessages = [...onboardingFlow.messages];
    
    // Swap with the message below
    const temp = { ...updatedMessages[messageIndex] };
    updatedMessages[messageIndex] = { ...updatedMessages[messageIndex + 1], order: messageIndex + 1 };
    updatedMessages[messageIndex + 1] = { ...temp, order: messageIndex + 2 };
    
    setOnboardingFlow({
      ...onboardingFlow,
      messages: updatedMessages
    });
    
    setHasChanges(true);
  };

  // Update general settings
  const updateSettings = (field: string, value: any) => {
    if (!onboardingFlow) return;
    
    setOnboardingFlow({
      ...onboardingFlow,
      settings: {
        ...onboardingFlow.settings,
        [field]: value
      }
    });
    
    setHasChanges(true);
  };

  // Handle onboarding mode change
  const handleModeChange = (mode: 'flow' | 'agentic') => {
    if (!onboardingFlow) return;
    
    setOnboardingFlow({
      ...onboardingFlow,
      mode: mode
    });
    
    setHasChanges(true);
  };

  // If onboarding flow hasn't loaded yet, show loading state
  if (!onboardingFlow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main settings card */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Type</CardTitle>
          <CardDescription>
            Select how you want to onboard new users when they first interact with your agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="flow" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="flow" onClick={() => handleModeChange('flow')}>Flow Onboarding</TabsTrigger>
              <TabsTrigger value="agentic" disabled onClick={() => handleModeChange('agentic')}>Agentic Onboarding (Coming Soon)</TabsTrigger>
            </TabsList>
            <TabsContent value="flow" className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="enable-onboarding"
                    checked={onboardingFlow.enabled}
                    onCheckedChange={(checked) => {
                      setOnboardingFlow({
                        ...onboardingFlow,
                        enabled: checked
                      });
                      setHasChanges(true);
                    }} 
                  />
                  <Label htmlFor="enable-onboarding">Enable onboarding flow for new users</Label>
                </div>
                
                <div className="pt-2">
                  <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                    <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle>Flow Onboarding</AlertTitle>
                    <AlertDescription>
                      This approach uses predefined welcome messages to guide new users through their first interaction with your agent.
                      You can customize each message and decide whether to wait for user responses.
                    </AlertDescription>
                  </Alert>
                </div>
                
                <div className="space-y-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="skip-returning-users"
                      checked={onboardingFlow.settings.skipForReturningUsers}
                      onCheckedChange={(checked) => updateSettings('skipForReturningUsers', checked)} 
                    />
                    <Label htmlFor="skip-returning-users">Skip onboarding for returning users</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="ask-for-name"
                      checked={onboardingFlow.settings.askForName || false}
                      onCheckedChange={(checked) => updateSettings('askForName', checked)} 
                    />
                    <Label htmlFor="ask-for-name">Ask for user's name during onboarding</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="ask-for-business"
                      checked={onboardingFlow.settings.askForBusinessType || false}
                      onCheckedChange={(checked) => updateSettings('askForBusinessType', checked)} 
                    />
                    <Label htmlFor="ask-for-business">Ask for business type during onboarding</Label>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="agentic" className="pt-4">
              <div className="space-y-4">
                <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                  <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle>Agentic Onboarding (Coming Soon)</AlertTitle>
                  <AlertDescription>
                    The agentic approach uses goal-oriented conversations to understand user needs and customize the experience.
                    Instead of a fixed flow, the agent actively guides the conversation to gather relevant information and set
                    expectations based on the user's responses and needs. This helps create a more personalized experience.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Messages section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Onboarding Messages</CardTitle>
            <CardDescription>
              Customize the welcome messages shown to new users
            </CardDescription>
          </div>
          <Button onClick={addMessage}>
            <Plus className="h-4 w-4 mr-1" />
            Add Message
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {onboardingFlow.messages.length === 0 ? (
            <div className="text-center p-6 border border-dashed rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">No messages yet. Click "Add Message" to create your first welcome message.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {onboardingFlow.messages
                .sort((a, b) => a.order - b.order)
                .map((message, index) => (
                <Card key={message.id} className="relative border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                          Message {index + 1}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => moveMessageUp(message.id)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => moveMessageDown(message.id)}
                            disabled={index === onboardingFlow.messages.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900"
                            onClick={() => removeMessage(message.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor={`message-${message.id}`}>Message Text</Label>
                        <Textarea
                          id={`message-${message.id}`}
                          value={message.text}
                          onChange={(e) => updateMessage(message.id, 'text', e.target.value)}
                          placeholder="Enter your welcome message here..."
                          className="min-h-24"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id={`wait-response-${message.id}`}
                          checked={message.waitForResponse}
                          onCheckedChange={(checked) => updateMessage(message.id, 'waitForResponse', checked)} 
                        />
                        <Label htmlFor={`wait-response-${message.id}`}>
                          Wait for user response before continuing
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="destructive" onClick={resetOnboardingFlow}>
            <Trash2 className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button variant="outline" onClick={saveOnboardingFlowSettings} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </CardFooter>
      </Card>

      {/* Preview section */}
      <Card>
        <CardHeader>
          <CardTitle>Message Flow Preview</CardTitle>
          <CardDescription>
            See how your onboarding messages will appear to users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium">Chat Preview</h3>
            </div>
            <div className="p-4 space-y-4">
              {onboardingFlow.messages
                .sort((a, b) => a.order - b.order)
                .map((message, index) => (
                <div key={message.id} className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs">
                    AI
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-lg max-w-[80%]">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{message.text}</p>
                  </div>
                </div>
              ))}
              
              {onboardingFlow.messages.some(m => m.waitForResponse) && (
                <div className="flex gap-2 justify-end">
                  <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg max-w-[80%]">
                    <p className="text-sm text-gray-800 dark:text-gray-200 italic">User response here...</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs">
                    You
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
