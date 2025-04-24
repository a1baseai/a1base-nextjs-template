"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function DebugPage() {
  const [envStatus, setEnvStatus] = useState<{
    openaiKeyAvailable: boolean;
    anthropicKeyAvailable: boolean;
    grokKeyAvailable: boolean;
    a1baseKeyAvailable: boolean;
    a1baseAgentName: string | null;
    a1baseAgentNumber: string | null;
    selectedModelProvider: string;
  }>({
    openaiKeyAvailable: false,
    anthropicKeyAvailable: false,
    grokKeyAvailable: false,
    a1baseKeyAvailable: false,
    a1baseAgentName: null,
    a1baseAgentNumber: null,
    selectedModelProvider: "openai",
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [isUpdatingProfileName, setIsUpdatingProfileName] = useState(false);
  const [isUpdatingProfilePicture, setIsUpdatingProfilePicture] = useState(false);
  const [webhookUrls, setWebhookUrls] = useState({
    phoneWebhook: "",
    emailWebhook: ""
  });

  async function checkEnvVars() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/debug-env");
      const data = await response.json();
      setEnvStatus(data);
      
      // Set the profile name from env variables if available
      if (data.a1baseAgentName) {
        setProfileName(data.a1baseAgentName);
      }
    } catch (error) {
      console.error("Failed to check environment variables:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveModelProvider(provider: string) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/model-provider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selectedModelProvider: provider }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update local state
        setEnvStatus((prev) => ({
          ...prev,
          selectedModelProvider: provider,
        }));
        
        toast({
          title: "Model provider updated",
          description: `Successfully switched to ${provider.toUpperCase()} APIs`,
          variant: "default",
        });
      } else {
        throw new Error(data.error || "Failed to update model provider");
      }
    } catch (error) {
      console.error("Failed to update model provider:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update model provider",
        variant: "destructive",
        action: <ToastAction altText="Try again">Try again</ToastAction>,
      });
    } finally {
      setIsSaving(false);
    }
  }
  
  async function updateWhatsAppProfileName() {
    if (!profileName) {
      toast({
        title: "Profile name required",
        description: "Please enter a profile name",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdatingProfileName(true);
    try {
      const response = await fetch("/api/whatsapp/profile/update-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: profileName }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Profile name updated",
          description: "WhatsApp profile name updated successfully",
          variant: "default",
        });
      } else {
        throw new Error(data.message || "Failed to update WhatsApp profile name");
      }
    } catch (error) {
      console.error("Failed to update WhatsApp profile name:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update WhatsApp profile name",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfileName(false);
    }
  }
  
  async function updateWhatsAppProfilePicture() {
    if (!profilePictureUrl) {
      toast({
        title: "Profile picture URL required",
        description: "Please enter a valid image URL",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdatingProfilePicture(true);
    try {
      const response = await fetch("/api/whatsapp/profile/update-picture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: profilePictureUrl }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Profile picture updated",
          description: "WhatsApp profile picture updated successfully",
          variant: "default",
        });
        
        // Clear the input field after successful update
        setProfilePictureUrl("");
      } else {
        throw new Error(data.message || "Failed to update WhatsApp profile picture");
      }
    } catch (error) {
      console.error("Failed to update WhatsApp profile picture:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update WhatsApp profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfilePicture(false);
    }
  }

  useEffect(() => {
    checkEnvVars();
    
    // Set webhook URLs on client-side only
    setWebhookUrls({
      phoneWebhook: `${window.location.origin}/api/webhook/a1base`,
      emailWebhook: `${window.location.origin}/api/webhook/a1mail`
    });
  }, []);

  return (
    <div className="container py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Environment Configuration</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={checkEnvVars} 
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader className="bg-muted/50">
          <CardTitle>API Keys Status</CardTitle>
          <CardDescription>
            Check the status of your environment configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className={`p-4 rounded-lg border ${envStatus.openaiKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                {envStatus.openaiKeyAvailable ? 
                  <span className="text-green-600 dark:text-green-400">✅</span> : 
                  <span className="text-red-600 dark:text-red-400">❌</span>
                }
                OpenAI API Key
              </h3>
              <p className="text-sm text-muted-foreground">
                {envStatus.openaiKeyAvailable ? 
                  "Successfully configured" : 
                  "Not configured. Add OPENAI_API_KEY to your .env file."
                }
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${envStatus.anthropicKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                {envStatus.anthropicKeyAvailable ? 
                  <span className="text-green-600 dark:text-green-400">✅</span> : 
                  <span className="text-red-600 dark:text-red-400">❌</span>
                }
                Anthropic/Claude API Key
              </h3>
              <p className="text-sm text-muted-foreground">
                {envStatus.anthropicKeyAvailable ? 
                  "Successfully configured" : 
                  "Not configured. Add ANTHROPIC_API_KEY to your .env file."
                }
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${envStatus.grokKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                {envStatus.grokKeyAvailable ? 
                  <span className="text-green-600 dark:text-green-400">✅</span> : 
                  <span className="text-red-600 dark:text-red-400">❌</span>
                }
                Grok API Key
              </h3>
              <p className="text-sm text-muted-foreground">
                {envStatus.grokKeyAvailable ? 
                  "Successfully configured" : 
                  "Not configured. Add GROK_API_KEY or GROK_API_TOKEN to your .env file."
                }
              </p>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="font-medium mb-4 text-lg">A1BASE Configuration</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className={`p-4 rounded-lg border ${envStatus.a1baseKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  {envStatus.a1baseKeyAvailable ? 
                    <span className="text-green-600 dark:text-green-400">✅</span> : 
                    <span className="text-red-600 dark:text-red-400">❌</span>
                  }
                  A1BASE API Key
                </h3>
                <p className="text-sm text-muted-foreground">
                  {envStatus.a1baseKeyAvailable ? 
                    "Successfully configured" : 
                    "Not configured. Add A1BASE_API_KEY to your .env file."
                  }
                </p>
              </div>
  
              <div className={`p-4 rounded-lg border ${envStatus.a1baseAgentName ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  {envStatus.a1baseAgentName ? 
                    <span className="text-green-600 dark:text-green-400">✅</span> : 
                    <span className="text-red-600 dark:text-red-400">❌</span>
                  }
                  A1BASE Agent Name
                </h3>
                <p className="text-sm text-muted-foreground">
                  {envStatus.a1baseAgentName ? 
                    `Configured as: ${envStatus.a1baseAgentName}` : 
                    "Not configured. Add A1BASE_AGENT_NAME to your .env file."
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-8">
        <CardHeader className="bg-muted/50">
          <CardTitle>Model Provider Settings</CardTitle>
          <CardDescription>
            Select which AI model provider to use throughout the application
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <RadioGroup
            value={envStatus.selectedModelProvider}
            className="space-y-4"
            onValueChange={(value) => saveModelProvider(value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="openai" 
                id="openai" 
                disabled={!envStatus.openaiKeyAvailable || isSaving}
              />
              <Label htmlFor="openai" className={!envStatus.openaiKeyAvailable ? "opacity-50" : ""}>
                <div className="flex items-center gap-2">
                  OpenAI (GPT-4) 
                  {envStatus.selectedModelProvider === "openai" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="anthropic" 
                id="anthropic" 
                disabled={!envStatus.anthropicKeyAvailable || isSaving}
              />
              <Label htmlFor="anthropic" className={!envStatus.anthropicKeyAvailable ? "opacity-50" : ""}>
                <div className="flex items-center gap-2">
                  Anthropic (Claude) 
                  {envStatus.selectedModelProvider === "anthropic" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="grok" 
                id="grok" 
                disabled={!envStatus.grokKeyAvailable || isSaving}
              />
              <Label htmlFor="grok" className={!envStatus.grokKeyAvailable ? "opacity-50" : ""}>
                <div className="flex items-center gap-2">
                  Grok 
                  {envStatus.selectedModelProvider === "grok" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </Label>
            </div>
          </RadioGroup>
          
          <div className="mt-6 text-sm text-muted-foreground">
            <p>
              The selected model provider will be used for all AI-powered features in the application.
              {!envStatus.openaiKeyAvailable && !envStatus.anthropicKeyAvailable && !envStatus.grokKeyAvailable && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  ⚠️ No API keys are configured. Please add at least one provider API key to your .env file.
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader className="bg-muted/50">
          <CardTitle>WhatsApp Profile Settings</CardTitle>
          <CardDescription>
            Update your WhatsApp business profile settings
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className={envStatus.a1baseAgentNumber ? "" : "opacity-60 pointer-events-none"}>  
            <div className="space-y-6">
              {/* Profile Name Update Section */}
              <div>
                <h3 className="text-base font-medium mb-2">Update Profile Name</h3>
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <div className="flex-grow">
                    <Input
                      placeholder="Enter profile name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      disabled={!envStatus.a1baseAgentNumber || isUpdatingProfileName}
                      className="w-full"
                    />
                  </div>
                  <Button 
                    onClick={updateWhatsAppProfileName}
                    disabled={!envStatus.a1baseAgentNumber || isUpdatingProfileName || !profileName}
                    className="whitespace-nowrap"
                  >
                    {isUpdatingProfileName ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Name"
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  This will update the profile name shown to your WhatsApp contacts.
                </p>
              </div>

              {/* Profile Picture Update Section */}
              <div>
                <h3 className="text-base font-medium mb-2">Update Profile Picture</h3>
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <div className="flex-grow">
                    <Input
                      placeholder="Enter image URL"
                      value={profilePictureUrl}
                      onChange={(e) => setProfilePictureUrl(e.target.value)}
                      disabled={!envStatus.a1baseAgentNumber || isUpdatingProfilePicture}
                      className="w-full"
                    />
                  </div>
                  <Button 
                    onClick={updateWhatsAppProfilePicture}
                    disabled={!envStatus.a1baseAgentNumber || isUpdatingProfilePicture || !profilePictureUrl}
                    className="whitespace-nowrap"
                  >
                    {isUpdatingProfilePicture ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Update Picture
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Use a direct URL to a JPG or PNG image (recommended size: square, at least 640x640 pixels).
                </p>
              </div>
            </div>
            
            {!envStatus.a1baseAgentNumber && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4 dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-1">WhatsApp number not configured</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      To update WhatsApp profile settings, you need to get a WhatsApp number from A1Base and configure
                      it in your environment variables as A1BASE_AGENT_NUMBER.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2 gap-2" asChild>
                      <a href="https://www.a1base.com/dashboard/phone-numbers" target="_blank" rel="noopener noreferrer">
                        Get a WhatsApp number
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Configure webhooks for your A1Base channels
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="phone">
            <TabsList className="mb-4">
              <TabsTrigger value="phone">WhatsApp/SMS Webhooks</TabsTrigger>
              <TabsTrigger value="email">Email Webhooks</TabsTrigger>
            </TabsList>
            
            <TabsContent value="phone" className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Configure your WhatsApp and SMS webhooks to enable message handling through A1Framework.
              </p>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-1">Important Setup Step</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Set your webhook URL to <code className="px-2 py-1 bg-amber-100 dark:bg-amber-800/40 rounded">{webhookUrls.phoneWebhook}</code> in the A1Base dashboard.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button variant="outline" className="gap-2" asChild>
                <a href="https://www.a1base.com/dashboard/phone-numbers" target="_blank" rel="noopener noreferrer">
                  Configure Phone Webhooks
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </TabsContent>
            
            <TabsContent value="email" className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Configure your email webhooks to enable email handling through A1Framework.
              </p>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-1">Important Setup Step</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Set your email webhook URL to <code className="px-2 py-1 bg-amber-100 dark:bg-amber-800/40 rounded">{webhookUrls.emailWebhook}</code> in the A1Base dashboard.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button variant="outline" className="gap-2" asChild>
                <a href="https://www.a1base.com/dashboard/email-addresses" target="_blank" rel="noopener noreferrer">
                  Configure Email Webhooks
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
