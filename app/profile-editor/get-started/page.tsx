"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Check, User, Database, MessageSquare, Zap } from "lucide-react";
import Image from "next/image";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { AgentProfileSettings } from "@/lib/agent-profile/types";
import { defaultBaseInformation } from "@/lib/agent-profile/agent-base-information";
import { saveToLocalStorage, loadFromLocalStorage, LOCAL_STORAGE_KEYS } from "@/lib/storage/local-storage";
import { saveProfileSettings, saveBaseInformation, loadProfileSettings } from "@/lib/storage/file-storage";
import { toast } from "sonner";

// Define the steps in the onboarding process
const steps = [
  {
    id: "welcome",
    title: "Welcome",
    description: "Let's set up your AI agent",
    icon: <User className="h-6 w-6" />,
  },
  {
    id: "agent-identity",
    title: "Agent Identity",
    description: "Define your agent's persona",
    icon: <User className="h-6 w-6" />,
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    description: "Provide information for your agent",
    icon: <Database className="h-6 w-6" />,
  },
  {
    id: "behavior",
    title: "Behavior",
    description: "Configure how your agent interacts",
    icon: <MessageSquare className="h-6 w-6" />,
  },
  {
    id: "complete",
    title: "Complete",
    description: "You're all set",
    icon: <Check className="h-6 w-6" />,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Available GIF URLs for profile selection (same as in profile-settings page)
  const gifUrls = [
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250215_1417_Confident+Startup+Smile_simple_compose_01jm5v0x50f2kaarp5nd556cbw.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250210_1742_Corporate+Serene+Smile_simple_compose_01jkq9gs6rea3v4n7w461rwye2.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1254_Confident+Startup+Professional_simple_compose_01jm0heqkvez2a2xbpsdh003z8.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1255_Startup+Workplace+Smile_simple_compose_01jm0hgd5afymrz6ewd1c0nbra.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1256_Confident+Startup+Glance_simple_compose_01jm0hj6cfedn8m2gr8ynrwbgs.gif",
  ];
  
  // Load data on component mount
  useEffect(() => {
    // Load profile settings from the server
    const loadServerData = async () => {
      try {
        setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };
    
    loadServerData();
  }, []);

  // Function to go to the next step
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Function to go to the previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Function to handle input changes
  const handleInputChange = (field: keyof AgentProfileSettings, value: any) => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return { ...defaultAgentProfileSettings, [field]: value };
      
      return {
        ...prev,
        [field]: value
      };
    });
  };

  // Function to handle changes in nested objects
  const handleNestedChange = (parent: keyof AgentProfileSettings, field: string, value: any) => {
    if (!profileSettings) return;
    
    setProfileSettings(prev => {
      if (!prev) return { ...defaultAgentProfileSettings };
      
      return {
        ...prev,
        [parent]: {
          ...(prev[parent] as any),
          [field]: value
        }
      };
    });
  };

  // Function to complete the onboarding
  const completeOnboarding = async () => {
    if (!profileSettings) return;
    
    try {
      // Save profile settings
      await saveProfileSettings(profileSettings);
      saveToLocalStorage(LOCAL_STORAGE_KEYS.AGENT_PROFILE, profileSettings);
      
      // Save default base information
      await saveBaseInformation(defaultBaseInformation);
      
      toast.success("Profile settings saved successfully");
      
      // Redirect to the profile editor main page
      router.push("/profile-editor/profile-settings");
    } catch (error) {
      console.error("Error saving profile settings:", error);
      toast.error("Failed to save profile settings");
      console.error("Error in onboarding completion:", error);
    }
  };

  // Calculate progress percentage
  const progressPercentage = ((currentStep + 1) / steps.length) * 100;
  
  // If still loading or profile settings not available, show loading state
  if (loading || !profileSettings) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Loading your profile...</h2>
          <Progress value={100} className="w-64 h-2 animate-pulse" />
        </div>
      </div>
    );
  }

  // Render different content based on the current step
  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case "welcome":
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Zap className="h-12 w-12 text-blue-600 dark:text-blue-300" />
            </div>
            <h3 className="text-2xl font-bold">Welcome to Agent Setup</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Let's set up your AI agent with a few simple steps. This will help you create an agent that's tailored to your needs.
            </p>
            <div className="pt-4">
              <Button onClick={nextStep} className="w-full md:w-auto">
                Start Setup <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
        
      case "agent-identity":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Name</label>
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={profileSettings.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g., Alex"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Role</label>
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={profileSettings.role}
                    onChange={(e) => handleInputChange("role", e.target.value)}
                    placeholder="e.g., Sales Assistant"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company Name</label>
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={profileSettings.companyName}
                    onChange={(e) => handleInputChange("companyName", e.target.value)}
                    placeholder="e.g., Acme Inc."
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Agent Avatar</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {gifUrls.map((url, index) => (
                  <div
                    key={index}
                    className={`cursor-pointer border-2 rounded-lg overflow-hidden hover:opacity-80 transition-opacity ${
                      profileSettings.profileImageUrl === url
                        ? "border-blue-500 shadow-lg"
                        : "border-transparent"
                    }`}
                    onClick={() => handleInputChange("profileImageUrl", url)}
                  >
                    <div className="relative">
                      <Image
                        src={url}
                        alt={`Avatar option ${index + 1}`}
                        width={150}
                        height={150}
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
          </div>
        );
        
      case "knowledge-base":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Company Information</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Description</label>
                <textarea 
                  className="w-full rounded-md border border-gray-300 p-2 h-32"
                  value={profileSettings.companyDescription}
                  onChange={(e) => handleInputChange("companyDescription", e.target.value)}
                  placeholder="Describe your company, products, or services..."
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Agent Purpose</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Define what your agent is designed to help with
              </p>
              
              {profileSettings.botPurpose.map((purpose, index) => (
                <div key={index} className="flex space-x-2">
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={purpose}
                    onChange={(e) => {
                      const newPurposes = [...profileSettings.botPurpose];
                      newPurposes[index] = e.target.value;
                      handleInputChange("botPurpose", newPurposes);
                    }}
                    placeholder={`Purpose ${index + 1}`}
                  />
                  {index === 0 && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        handleInputChange("botPurpose", [...profileSettings.botPurpose, ""]);
                      }}
                    >
                      Add
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
        
      case "behavior":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Communication Style</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={profileSettings.languageStyle.language}
                    onChange={(e) => handleNestedChange("languageStyle", "language", e.target.value)}
                    placeholder="e.g., English"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dialect</label>
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={profileSettings.languageStyle.dialect}
                    onChange={(e) => handleNestedChange("languageStyle", "dialect", e.target.value)}
                    placeholder="e.g., American English"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Tone</label>
                {profileSettings.languageStyle.tone.map((tone, index) => (
                  <div key={index} className="flex space-x-2">
                    <input 
                      type="text" 
                      className="w-full rounded-md border border-gray-300 p-2"
                      value={tone}
                      onChange={(e) => {
                        const newTones = [...profileSettings.languageStyle.tone];
                        newTones[index] = e.target.value;
                        handleNestedChange("languageStyle", "tone", newTones);
                      }}
                      placeholder={`Tone ${index + 1} (e.g., Professional, Friendly)`}
                    />
                    {index === 0 && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          handleNestedChange("languageStyle", "tone", [
                            ...profileSettings.languageStyle.tone, 
                            ""
                          ]);
                        }}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Behavior Settings</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Personify Agent</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Make the agent behave more like a real person
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={profileSettings.isPersonified}
                      onChange={(e) => handleInputChange("isPersonified", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
        
      case "complete":
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Check className="h-12 w-12 text-green-600 dark:text-green-300" />
            </div>
            <h3 className="text-2xl font-bold">Setup Complete!</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Your AI agent has been configured with the basic settings. You can now fine-tune your agent in the profile editor.
            </p>
            <div className="pt-4">
              <Button onClick={completeOnboarding} className="w-full md:w-auto">
                Finish & Go to Profile Editor
              </Button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Progress tracker */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </h2>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {Math.round(progressPercentage)}% Complete
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {steps.map((step, index) => (
            <div 
              key={index}
              className={`flex flex-col items-center ${
                index < currentStep 
                  ? "text-blue-600 dark:text-blue-400" 
                  : index === currentStep 
                    ? "text-blue-900 dark:text-blue-100" 
                    : "text-gray-400 dark:text-gray-600"
              }`}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                  index < currentStep 
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" 
                    : index === currentStep 
                      ? "bg-blue-600 dark:bg-blue-500 text-white" 
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
                }`}
              >
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.icon
                )}
              </div>
              <span className="text-xs font-medium text-center hidden md:block">{step.title}</span>
            </div>
          ))}
        </div>
      </div>
      
      <Card className="shadow-md border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
        <CardFooter className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
          <Button 
            variant="outline" 
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {currentStep < steps.length - 1 && (
            <Button onClick={nextStep}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
