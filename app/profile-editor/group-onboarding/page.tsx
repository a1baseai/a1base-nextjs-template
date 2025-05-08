"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Bot, Save, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GroupOnboardingFlow, GroupAgenticSettings, UserField } from "@/lib/onboarding-flow/types";
import { loadGroupOnboardingFlow, saveGroupOnboardingFlow } from "@/lib/onboarding-flow/group-onboarding-storage";

export default function GroupOnboardingFlowBuilder() {
  // State for group onboarding flow
  const [onboardingFlow, setOnboardingFlow] = useState<GroupOnboardingFlow | null>(null);
  
  // State to track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);
  
  // State for tracking loading and saving operations
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on component mount
  useEffect(() => {
    const fetchGroupOnboardingFlow = async () => {
      try {
        setIsLoading(true);
        let flow = await loadGroupOnboardingFlow(); // Use 'let' to allow modification
        
        // Heal missing IDs and ensure _internalReactKey in userFields
        if (flow && flow.agenticSettings && flow.agenticSettings.userFields) {
          let changed = false;
          const processedUserFields = flow.agenticSettings.userFields.map(field => {
            let updatedField = { ...field } as UserField; // Cast to ensure type safety
            if (!updatedField._internalReactKey) {
              updatedField._internalReactKey = uuidv4();
              changed = true;
            }
            if (!updatedField.id) { // Original healing for user-editable ID
              // console.warn('Healing missing ID for userField:', field.label);
              updatedField.id = `healed_id_${uuidv4().substring(0, 8)}`;
              changed = true;
            }
            return updatedField;
          });
          
          if (changed) {
            flow = {
              ...flow,
              agenticSettings: {
                ...flow.agenticSettings,
                userFields: processedUserFields,
              },
            };
            // If IDs or keys were added, consider this a change that needs saving
            // setHasChanges(true); // Optional: mark as changed immediately or let user trigger save
          }
        }
        setOnboardingFlow(flow);
      } catch (error) {
        console.error('Error loading group onboarding flow:', error);
        toast.error('Failed to load group onboarding settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupOnboardingFlow();
  }, []);

  // Save onboarding flow settings
  const handleSave = async () => {
    if (!onboardingFlow) return;
    
    try {
      setIsSaving(true);
      await saveGroupOnboardingFlow(onboardingFlow);
      setHasChanges(false);
      toast.success("Group onboarding flow saved successfully");
    } catch (error) {
      console.error("Error saving group onboarding flow:", error);
      toast.error("Failed to save group onboarding settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Add event listener for global save button from the layout navbar
  useEffect(() => {
    // Create an event handler for the save event
    const handleGlobalSave = () => {
      if (hasChanges && !isSaving && onboardingFlow) {
        handleSave();
      }
    };
    
    // Add event listener for the custom save event from layout
    document.addEventListener('save-profile-settings', handleGlobalSave);
    
    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener('save-profile-settings', handleGlobalSave);
    };
  }, [hasChanges, isSaving, onboardingFlow, handleSave]);
  
  // Mark changes as unsaved when any field changes
  useEffect(() => {
    if (onboardingFlow) {
      setHasChanges(true);
    }
  }, [onboardingFlow]);

  // Add a new user field
  const addUserField = () => {
    if (!onboardingFlow) return;
    
    const newField: UserField = {
      _internalReactKey: uuidv4(), // Stable React key
      id: `new_field_${uuidv4().substring(0, 8)}`,
      label: '',
      required: false,
      description: '',
    };
    
    setOnboardingFlow({
      ...onboardingFlow,
      agenticSettings: {
        ...onboardingFlow.agenticSettings,
        userFields: [...onboardingFlow.agenticSettings.userFields, newField],
      },
    });
  };

  // Remove a user field
  const removeUserField = (_internalReactKey: string) => {
    if (!onboardingFlow) return;
    
    setOnboardingFlow({
      ...onboardingFlow,
      agenticSettings: {
        ...onboardingFlow.agenticSettings,
        userFields: onboardingFlow.agenticSettings.userFields.filter(field => field._internalReactKey !== _internalReactKey),
      },
    });
    setHasChanges(true);
  };

  // Update a user field
  const updateUserField = (_internalReactKey: string, propertyToUpdate: string, value: any) => {
    if (!onboardingFlow) return;
    
    const updatedFields = onboardingFlow.agenticSettings.userFields.map((f) =>
      f._internalReactKey === _internalReactKey ? { ...f, [propertyToUpdate]: value } : f
    );
    
    setOnboardingFlow({
      ...onboardingFlow,
      agenticSettings: {
        ...onboardingFlow.agenticSettings,
        userFields: updatedFields,
      },
    });
    setHasChanges(true);
  };

  // Update agentic settings
  const updateAgenticSettings = (field: string, value: any) => {
    if (!onboardingFlow) return;
    
    setOnboardingFlow({
      ...onboardingFlow,
      agenticSettings: {
        ...onboardingFlow.agenticSettings,
        [field]: value,
      },
    });
    setHasChanges(true);
  };

  // Toggle onboarding flow enabled
  const toggleEnabled = (enabled: boolean) => {
    if (!onboardingFlow) return;
    
    setOnboardingFlow({
      ...onboardingFlow,
      enabled,
    });
    
    // Show toast notification
    if (enabled) {
      toast.success("Group onboarding flow enabled");
    } else {
      toast.info("Group onboarding flow disabled");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!onboardingFlow) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="text-red-600 text-xl">Error loading group onboarding settings</div>
        <Button 
          variant="default" 
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Badge variant={onboardingFlow.enabled ? "default" : "outline"} className="py-1 px-3">
            {onboardingFlow.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <div className="flex items-center space-x-2">
            <Switch 
              id="enable-onboarding" 
              checked={onboardingFlow.enabled}
              onCheckedChange={toggleEnabled}
              disabled={isSaving}
            />
            <Label htmlFor="enable-onboarding">
              {onboardingFlow.enabled ? "Group onboarding flow is active" : "Group onboarding flow is inactive"}
            </Label>
          </div>
        </div>
        
        <Alert>
          <Users className="h-4 w-4" />
          <AlertTitle>Group Chat Onboarding</AlertTitle>
          <AlertDescription>
            Configure how your agent introduces itself and gathers information in group chat environments. 
            This flow is specifically designed for multi-participant conversations.
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardHeader>
            <CardTitle>Group Onboarding Configuration</CardTitle>
            <CardDescription>
              Configure how your agent introduces itself to a group and collects information. 
              The group onboarding process is specially tailored for multi-user environments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">General Settings</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="participant-threshold">Participant Threshold</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          id="participant-threshold"
                          type="number"
                          min={2}
                          value={onboardingFlow.agenticSettings.participantThreshold}
                          onChange={(e) => updateAgenticSettings('participantThreshold', parseInt(e.target.value) || 2)}
                          className="w-24"
                          disabled={isSaving}
                        />
                        <span className="text-sm text-gray-600">participants</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Minimum number of participants required to start the group onboarding process.
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="reintroduction-interval">Reintroduction Interval</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          id="reintroduction-interval"
                          type="number"
                          min={1}
                          value={onboardingFlow.agenticSettings.reintroductionInterval}
                          onChange={(e) => updateAgenticSettings('reintroductionInterval', parseInt(e.target.value) || 1)}
                          className="w-24"
                          disabled={isSaving}
                        />
                        <span className="text-sm text-gray-600">days</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        How often the agent should reintroduce itself in idle group chats.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="auto-start-onboarding"
                        checked={onboardingFlow.agenticSettings.autoStartOnboarding}
                        onCheckedChange={(checked) => updateAgenticSettings('autoStartOnboarding', checked)} 
                        disabled={isSaving}
                      />
                      <div>
                        <Label htmlFor="auto-start-onboarding">
                          Auto-start onboarding
                        </Label>
                        <p className="text-sm text-gray-500">
                          Automatically start the onboarding when a new group is created.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="reintroduce-agent"
                        checked={onboardingFlow.agenticSettings.reintroduceAgent}
                        onCheckedChange={(checked) => updateAgenticSettings('reintroduceAgent', checked)} 
                        disabled={isSaving}
                      />
                      <div>
                        <Label htmlFor="reintroduce-agent">
                          Reintroduce agent periodically
                        </Label>
                        <p className="text-sm text-gray-500">
                          Reintroduce the agent after periods of inactivity in the group.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">AI Configuration</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <Textarea
                    id="system-prompt"
                    value={onboardingFlow.agenticSettings.systemPrompt}
                    onChange={(e) => updateAgenticSettings('systemPrompt', e.target.value)}
                    className="min-h-32"
                    placeholder="Instructions for how the AI should conduct the group onboarding process..."
                    disabled={isSaving}
                  />
                  <p className="text-sm text-gray-500">
                    This is the instruction prompt that guides the AI on how to conduct the group onboarding process.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="initial-group-message">Initial Group Message</Label>
                  <Textarea
                    id="initial-group-message"
                    value={onboardingFlow.agenticSettings.initialGroupMessage}
                    onChange={(e) => updateAgenticSettings('initialGroupMessage', e.target.value)}
                    className="min-h-24"
                    placeholder="The first message the agent will send to the group chat..."
                    disabled={isSaving}
                  />
                  <p className="text-sm text-gray-500">
                    This is the first message your agent will send when joining a new group chat.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Information to Collect</h3>
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium">Information to Collect</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addUserField} 
                      disabled={isSaving}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                  
                  {onboardingFlow.agenticSettings.userFields.length === 0 ? (
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <p className="text-gray-500 dark:text-gray-400">
                        No fields defined. Add fields to collect information from your group.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {onboardingFlow.agenticSettings.userFields.map((field) => (
                        <Card key={field._internalReactKey} className="border-gray-200 dark:border-gray-700">
                          <CardContent className="space-y-4 pt-4">
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium">{field.label || 'Untitled Field'}</h5>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeUserField(field._internalReactKey)}
                                disabled={isSaving}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`field-id-${field._internalReactKey}`}>Field ID</Label>
                              <Input
                                id={`field-id-${field._internalReactKey}`}
                                value={field.id}
                                onChange={(e) => updateUserField(field._internalReactKey, 'id', e.target.value)}
                                placeholder="e.g., user_name, project_goal"
                                disabled={isSaving}
                              />
                              <p className="text-xs text-muted-foreground">
                                Unique identifier for this field. Avoid spaces and special characters.
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`field-label-${field._internalReactKey}`}>Display Label</Label>
                              <Input
                                id={`field-label-${field._internalReactKey}`}
                                value={field.label}
                                onChange={(e) => updateUserField(field._internalReactKey, 'label', e.target.value)}
                                placeholder="e.g., Group Purpose, Team Name, etc."
                                disabled={isSaving}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`field-desc-${field._internalReactKey}`}>Description for AI</Label>
                              <Textarea
                                id={`field-desc-${field._internalReactKey}`}
                                value={field.description}
                                onChange={(e) => updateUserField(field._internalReactKey, 'description', e.target.value)}
                                placeholder="Tell the AI how to ask for this information"
                                className="min-h-20"
                                disabled={isSaving}
                              />
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Switch 
                                id={`field-required-${field._internalReactKey}`}
                                checked={field.required}
                                onCheckedChange={(checked) => updateUserField(field._internalReactKey, 'required', checked)} 
                                disabled={isSaving}
                              />
                              <Label htmlFor={`field-required-${field._internalReactKey}`}>
                                This field is required
                              </Label>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Final Message</h3>
                  <div className="space-y-2">
                    <Label htmlFor="final-message">Completion Message</Label>
                    <Textarea
                      id="final-message"
                      value={onboardingFlow.agenticSettings.finalMessage}
                      onChange={(e) => updateAgenticSettings('finalMessage', e.target.value)}
                      placeholder="Message to show when all information is collected..."
                      className="min-h-24"
                      disabled={isSaving}
                    />
                    <p className="text-sm text-gray-500">
                      Message that will be shown when all required information has been collected from the group.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Floating action bar */}
      {hasChanges && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-background border-t shadow-lg transition-all ease-in-out duration-300">
          <div className="container flex items-center justify-between">
            <p className="text-sm">You have unsaved changes</p>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              size="sm"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-background border-t-foreground rounded-full"></div>
                  Saving...
                </>
              ) : (
                <>Save Changes</>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
