"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Bot, Save } from "lucide-react";
import { OnboardingFlow, UserField } from "@/lib/onboarding-flow/types";
import { loadOnboardingFlow, saveOnboardingFlow } from "@/lib/onboarding-flow/onboarding-storage";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function OnboardingFlowBuilder() {
  // State for onboarding flow
  const [onboardingFlow, setOnboardingFlow] = useState<OnboardingFlow | null>(null);
  
  // State to track if changes have been made
  const [hasChanges, setHasChanges] = useState(false);
  
  // State for tracking loading and saving operations
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on component mount
  useEffect(() => {
    const fetchOnboardingFlow = async () => {
      try {
        setIsLoading(true);
        let flow = await loadOnboardingFlow(); // Use 'let' for modification
        
        let flowModified = false;

        // Ensure flow is in agentic mode with agentic settings and has enabled property
        if (flow.mode !== 'agentic' || !flow.agenticSettings || flow.enabled === undefined) {
          flow = {
            ...flow,
            mode: 'agentic' as const,
            enabled: flow.enabled !== undefined ? flow.enabled : true,
            agenticSettings: flow.agenticSettings || {
              systemPrompt: 'You are conducting an onboarding conversation with a new user. Your goal is to make them feel welcome and collect some basic information that will help you assist them better in the future. Be friendly, professional, and conversational.',
              userFields: [
                {
                  _internalReactKey: uuidv4(),
                  id: 'full_name', // Default user-editable ID
                  label: 'Full Name',
                  required: true,
                  description: 'Ask for the user\'s full name'
                },
                {
                  _internalReactKey: uuidv4(),
                  id: 'email_address', // Default user-editable ID
                  label: 'Email Address',
                  required: true,
                  description: 'Ask for the user\'s email address'
                }
              ],
              finalMessage: 'Thank you for sharing this information. I\'ve saved your details and I\'m ready to help you achieve your goals.'
            }
          };
          flowModified = true; // Flow was modified with defaults
        }

        // Ensure all userFields have _internalReactKey
        if (flow.agenticSettings && flow.agenticSettings.userFields) {
          let fieldsChanged = false;
          const processedUserFields = flow.agenticSettings.userFields.map(field => {
            if (!field._internalReactKey) {
              fieldsChanged = true;
              return { ...field, _internalReactKey: uuidv4() };
            }
            return field;
          });
          if (fieldsChanged) {
            flow = {
              ...flow,
              agenticSettings: {
                ...flow.agenticSettings,
                userFields: processedUserFields
              }
            };
            flowModified = true;
          }
        }

        setOnboardingFlow(flow);
        if (flowModified) {
          // If the flow was structurally changed (e.g., defaults added, keys healed), mark changes and optionally save.
          setHasChanges(true); 
          // await saveOnboardingFlow(flow); // Or let user save explicitly
        }

      } catch (error) {
        console.error('Error loading onboarding flow:', error);
        toast.error('Failed to load onboarding flow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOnboardingFlow();
  }, []);

  // Save onboarding flow settings
  const handleSave = async () => {
    if (!onboardingFlow) return;
    
    try {
      setIsSaving(true);
      await saveOnboardingFlow(onboardingFlow);
      setHasChanges(false);
      toast.success("Onboarding flow saved successfully");
    } catch (error) {
      console.error("Error saving onboarding flow:", error);
      toast.error("Failed to save onboarding flow");
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
    
    // Add the event listener
    document.addEventListener('save-profile-settings', handleGlobalSave);
    
    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('save-profile-settings', handleGlobalSave);
    };
  }, [hasChanges, isSaving, onboardingFlow, handleSave]);

  // Add a new user field
  const addUserField = () => {
    if (!onboardingFlow) return;
    const newField: UserField = {
      _internalReactKey: uuidv4(), // Stable React key
      id: `new_field_${uuidv4().substring(0, 8)}`, // User-editable ID
      label: "",
      required: false,
      description: "Ask for this information from the user"
    };
    
    setOnboardingFlow({
      ...onboardingFlow,
      agenticSettings: {
        ...onboardingFlow.agenticSettings,
        userFields: [...onboardingFlow.agenticSettings.userFields, newField]
      }
    });
    setHasChanges(true);
  };

  // Remove a user field
  const removeUserField = (_internalReactKey: string) => {
    if (!onboardingFlow) return;
    setOnboardingFlow({
      ...onboardingFlow,
      agenticSettings: {
        ...onboardingFlow.agenticSettings,
        userFields: onboardingFlow.agenticSettings.userFields.filter(
          (field) => field._internalReactKey !== _internalReactKey
        ),
      },
    });
    setHasChanges(true);
  };

  // Update a user field
  const updateUserField = (_internalReactKey: string, propertyToUpdate: string, value: any) => {
    if (!onboardingFlow) return;
    setOnboardingFlow({
      ...onboardingFlow,
      agenticSettings: {
        ...onboardingFlow.agenticSettings,
        userFields: onboardingFlow.agenticSettings.userFields.map((f) =>
          f._internalReactKey === _internalReactKey ? { ...f, [propertyToUpdate]: value } : f
        ),
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
        [field]: value
      }
    });
    
    setHasChanges(true);
  };

  // Toggle onboarding flow enabled
  const toggleEnabled = (enabled: boolean) => {
    if (!onboardingFlow) return;
    
    // Update the flow with the new enabled state
    const updatedFlow = {
      ...onboardingFlow,
      enabled
    };
    
    // Set the updated flow in state
    setOnboardingFlow(updatedFlow);
    
    // Mark changes
    setHasChanges(true);
    
    // Log the change
    console.log(`Onboarding flow ${enabled ? 'enabled' : 'disabled'}`);
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
    <>
      <div className="container py-6 space-y-6">
        <h1 className="text-2xl font-bold">Agentic Onboarding Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Configure the AI-guided onboarding experience for new users
        </p>
        
        {/* Main settings card */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Onboarding Configuration</CardTitle>
                <CardDescription>
                  Customize how new users are welcomed and what information is collected
                </CardDescription>
              </div>
              <Switch 
                id="enable-onboarding"
                checked={onboardingFlow.enabled}
                onCheckedChange={toggleEnabled}
                disabled={isSaving}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-4">
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-800">
                  <Bot className="h-4 w-4" />
                  <AlertTitle>Agentic Onboarding</AlertTitle>
                  <AlertDescription>
                    The AI will guide the conversation naturally while collecting the information you specify below.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">AI Instructions</h3>
                    <div className="space-y-2">
                      <Label htmlFor="system-prompt">System Prompt</Label>
                      <Textarea
                        id="system-prompt"
                        value={onboardingFlow.agenticSettings.systemPrompt}
                        onChange={(e) => updateAgenticSettings('systemPrompt', e.target.value)}
                        placeholder="Instructions for the AI during onboarding..."
                        className="min-h-32"
                        disabled={isSaving}
                      />
                      <p className="text-sm text-gray-500">
                        Guide the AI on how to conduct the onboarding conversation and collect user information.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">User Information Fields</h3>
                      <Button 
                        variant="secondary" 
                        onClick={addUserField}
                        disabled={isSaving}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Field
                      </Button>
                    </div>
                    
                    {onboardingFlow.agenticSettings.userFields.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-3 border border-dashed rounded-lg p-8 my-4">
                        <p className="text-gray-500 text-center">No user fields defined yet</p>
                        <Button 
                          variant="outline" 
                          onClick={addUserField}
                          disabled={isSaving}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Field
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {onboardingFlow.agenticSettings.userFields.map((field) => (
                          <Card key={field._internalReactKey} className="overflow-hidden">
                            <CardContent className="p-4 space-y-4">
                              <div className="flex justify-between items-center">
                                <Badge variant={field.required ? "default" : "outline"}>
                                  {field.required ? "Required" : "Optional"}
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900"
                                  onClick={() => removeUserField(field._internalReactKey)}
                                  disabled={isSaving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`field-id-${field._internalReactKey}`}>Field ID</Label>
                                  <Input
                                    id={`field-id-${field._internalReactKey}`}
                                    value={field.id}
                                    onChange={(e) => updateUserField(field._internalReactKey, 'id', e.target.value)}
                                    placeholder="e.g., user_name, company_info"
                                    disabled={isSaving}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor={`field-label-${field._internalReactKey}`}>Display Label</Label>
                                  <Input
                                    id={`field-label-${field._internalReactKey}`}
                                    value={field.label}
                                    onChange={(e) => updateUserField(field._internalReactKey, 'label', e.target.value)}
                                    placeholder="e.g., Full Name, Email Address"
                                    disabled={isSaving}
                                  />
                                </div>
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
                        Message that will be shown when all required information has been collected.
                      </p>
                    </div>
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
