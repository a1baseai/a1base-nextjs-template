"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, Upload, ImageIcon, Sparkles } from "lucide-react";
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
    supabaseUrlAvailable: boolean;
    supabaseKeyAvailable: boolean;
    supabaseConnected: boolean;
    requiredTables: string[];
    existingTables: string[];
    otherTables: string[];
  }>({
    openaiKeyAvailable: false,
    anthropicKeyAvailable: false,
    grokKeyAvailable: false,
    a1baseKeyAvailable: false,
    a1baseAgentName: null,
    a1baseAgentNumber: null,
    selectedModelProvider: "openai",
    supabaseUrlAvailable: false,
    supabaseKeyAvailable: false,
    supabaseConnected: false,
    requiredTables: [],
    existingTables: [],
    otherTables: [],
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [isUpdatingProfileName, setIsUpdatingProfileName] = useState(false);
  const [isUpdatingProfilePicture, setIsUpdatingProfilePicture] = useState(false);
  const [isSavingChunkSetting, setIsSavingChunkSetting] = useState(false);
  const [messageChunkingEnabled, setMessageChunkingEnabled] = useState(false);
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
      
      // Load message chunking setting
      await checkMessageChunkingSetting();
    } catch (error) {
      console.error("Failed to check environment variables:", error);
    } finally {
      setIsLoading(false);
    }
  }
  
  async function checkMessageChunkingSetting() {
    try {
      const response = await fetch("/api/settings/message-chunking");
      if (response.ok) {
        const data = await response.json();
        setMessageChunkingEnabled(data.splitParagraphs || false);
      }
    } catch (error) {
      console.error("Failed to check message chunking setting:", error);
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
    if (!profileName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a profile name",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdatingProfileName(true);
    
    try {
      const response = await fetch("/api/whatsapp/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: profileName }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Profile updated",
          description: "WhatsApp profile name has been updated successfully",
          variant: "default",
        });
      } else {
        throw new Error(data.error || "Failed to update profile name");
      }
    } catch (error) {
      console.error("Failed to update WhatsApp profile name:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update WhatsApp profile name",
        variant: "destructive",
        action: <ToastAction altText="Try again">Try again</ToastAction>,
      });
    } finally {
      setIsUpdatingProfileName(false);
    }
  }
  
  async function updateWhatsAppProfilePicture() {
    if (!profilePictureUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid image URL",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdatingProfilePicture(true);
    
    try {
      const response = await fetch("/api/whatsapp/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profilePictureUrl }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setProfilePictureUrl(""); // Reset field on success
        
        toast({
          title: "Profile updated",
          description: "WhatsApp profile picture has been updated successfully",
          variant: "default",
        });
      } else {
        throw new Error(data.error || "Failed to update profile picture");
      }
    } catch (error) {
      console.error("Failed to update WhatsApp profile picture:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update WhatsApp profile picture",
        variant: "destructive",
        action: <ToastAction altText="Try again">Try again</ToastAction>,
      });
    } finally {
      setIsUpdatingProfilePicture(false);
    }
  }
  
  async function toggleMessageChunking(enabled: boolean) {
    setIsSavingChunkSetting(true);
    
    try {
      const response = await fetch("/api/settings/message-chunking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ splitParagraphs: enabled }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessageChunkingEnabled(enabled);
        
        toast({
          title: "Setting updated",
          description: `Message chunking has been ${enabled ? "enabled" : "disabled"}`,
          variant: "default",
        });
      } else {
        throw new Error(data.error || "Failed to update message chunking setting");
      }
    } catch (error) {
      console.error("Failed to update message chunking setting:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update message chunking setting",
        variant: "destructive",
        action: <ToastAction altText="Try again">Try again</ToastAction>,
      });
    } finally {
      setIsSavingChunkSetting(false);
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
    <div className="container px-4 sm:px-6 py-6 sm:py-10 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Environment Configuration</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={checkEnvVars} 
          disabled={isLoading}
          className="gap-2 w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      
      <Card className="mb-6 sm:mb-8 overflow-hidden">
        <CardHeader className="bg-muted/50 px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl">API Keys Status</CardTitle>
          <CardDescription className="text-sm">
            Check the status of your environment configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="space-y-4 sm:space-y-6">
            <div className={`p-3 sm:p-4 rounded-lg border ${envStatus.openaiKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
                {envStatus.openaiKeyAvailable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                OpenAI API Key
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {envStatus.openaiKeyAvailable
                  ? "OpenAI API key is correctly configured"
                  : "OpenAI API key is missing. Set OPENAI_API_KEY in your .env file"}
              </p>
            </div>
            
            <div className={`p-3 sm:p-4 rounded-lg border ${envStatus.anthropicKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
                {envStatus.anthropicKeyAvailable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                Anthropic API Key
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {envStatus.anthropicKeyAvailable
                  ? "Anthropic API key is correctly configured"
                  : "Anthropic API key is missing. Set ANTHROPIC_API_KEY in your .env file"}
              </p>
            </div>

            <div className={`p-3 sm:p-4 rounded-lg border ${envStatus.grokKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
                {envStatus.grokKeyAvailable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                xAI Grok API Key
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {envStatus.grokKeyAvailable
                  ? "xAI Grok API key is correctly configured"
                  : "xAI Grok API key is missing. Set GROK_API_KEY in your .env file"}
              </p>
            </div>
            
            <div className={`p-3 sm:p-4 rounded-lg border ${envStatus.a1baseKeyAvailable ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
                {envStatus.a1baseKeyAvailable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                A1Base API Key
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {envStatus.a1baseKeyAvailable
                  ? "A1Base API key is correctly configured"
                  : "A1Base API key is missing. Set A1BASE_API_KEY in your .env file"}
              </p>
              {envStatus.a1baseKeyAvailable && envStatus.a1baseAgentNumber && (
                <div className="mt-2 text-xs sm:text-sm text-muted-foreground">
                  Agent Number: {envStatus.a1baseAgentNumber}
                </div>
              )}
            </div>

            <div className={`p-3 sm:p-4 rounded-lg border ${envStatus.supabaseConnected ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"}`}>
              <h3 className="font-medium mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
                {envStatus.supabaseConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                Supabase Configuration
              </h3>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {envStatus.supabaseUrlAvailable
                    ? "Supabase URL is correctly configured"
                    : "Supabase URL is missing. Set SUPABASE_URL in your .env file"}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {envStatus.supabaseKeyAvailable
                    ? "Supabase API key is correctly configured"
                    : "Supabase API key is missing. Set SUPABASE_KEY in your .env file"}
                </p>
                {envStatus.supabaseUrlAvailable && envStatus.supabaseKeyAvailable && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {envStatus.supabaseConnected
                      ? "✅ Connection to Supabase established successfully"
                      : "❌ Connection to Supabase failed. Check your credentials and Supabase service status"}
                  </p>
                )}
                
                {/* Supabase Tables Status Section */}
                {envStatus.supabaseConnected && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-medium mb-2 text-sm">Database Tables</h4>
                    
                    <div className="space-y-3">
                      {/* Required Tables */}
                      <div>
                        <h5 className="text-xs font-medium mb-1">Required Tables ({envStatus.existingTables.length}/{envStatus.requiredTables.length})</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {envStatus.requiredTables.map(table => {
                            const exists = envStatus.existingTables.includes(table);
                            return (
                              <div key={table} className="flex items-center gap-1">
                                <span className="text-xs">
                                  {exists ? "✅" : "❌"}
                                </span>
                                <span className="text-xs truncate">{table}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Other Tables */}
                      {envStatus.otherTables.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium mb-1">Additional Tables ({envStatus.otherTables.length})</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {envStatus.otherTables.map(table => (
                              <div key={table} className="flex items-center gap-1">
                                <span className="text-xs">•</span>
                                <span className="text-xs truncate">{table}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Setup Instructions */}
                      {envStatus.existingTables.length < envStatus.requiredTables.length && (
                        <div className="mt-2 text-xs px-2 py-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                          <p className="font-medium">Missing required tables</p>
                          <p className="mt-1">To set up the database, run the SQL commands in <code>supabase.sql</code> in your Supabase SQL editor.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl">Model Provider</CardTitle>
          <CardDescription className="text-sm">
            Select the model provider for your agent
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 px-4 sm:px-6">
          <RadioGroup 
            defaultValue={envStatus.selectedModelProvider} 
            onValueChange={saveModelProvider}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="openai" 
                id="openai" 
                disabled={!envStatus.openaiKeyAvailable || isSaving}
              />
              <Label htmlFor="openai" className={!envStatus.openaiKeyAvailable ? "opacity-50" : ""}>OpenAI</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="anthropic" 
                id="anthropic" 
                disabled={!envStatus.anthropicKeyAvailable || isSaving}
              />
              <Label htmlFor="anthropic" className={!envStatus.anthropicKeyAvailable ? "opacity-50" : ""}>Anthropic</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem 
                value="grok" 
                id="grok" 
                disabled={!envStatus.grokKeyAvailable || isSaving}
              />
              <Label htmlFor="grok" className={!envStatus.grokKeyAvailable ? "opacity-50" : ""}>Grok</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
      
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl">WhatsApp Profile Settings</CardTitle>
          <CardDescription className="text-sm">
            Configure your WhatsApp business profile
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className={envStatus.a1baseAgentNumber ? "" : "opacity-60 pointer-events-none"}>  
            <div className="space-y-6">
              {/* Profile Name Update Section */}
              <div>
                <h3 className="text-base font-medium mb-4">Profile Name</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <div className="grid w-full items-center gap-1.5">
                      <Label htmlFor="profileName">Business Name</Label>
                      <Input
                        id="profileName"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Your Business Name"
                        disabled={!envStatus.a1baseAgentNumber || isUpdatingProfileName}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <Button 
                    variant="secondary"
                    disabled={!envStatus.a1baseAgentNumber || isUpdatingProfileName || !profileName.trim()}
                    onClick={updateWhatsAppProfileName}
                    className="mt-auto sm:mt-0 w-full sm:w-auto sm:self-end"
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
              </div>
              
              {/* Profile Picture Update Section */}
              <div>
                <h3 className="text-base font-medium mb-4">Profile Picture</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <div className="grid w-full items-center gap-1.5">
                      <Label htmlFor="profilePicture">Image URL</Label>
                      <div className="flex">
                        <div className="relative w-full">
                          <ImageIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="profilePicture"
                            value={profilePictureUrl}
                            onChange={(e) => setProfilePictureUrl(e.target.value)}
                            placeholder="https://example.com/your-logo.png"
                            disabled={!envStatus.a1baseAgentNumber || isUpdatingProfilePicture}
                            className="pl-8 w-full"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use a square image (1:1 ratio) for best results
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={!envStatus.a1baseAgentNumber || isUpdatingProfilePicture || !profilePictureUrl.trim()}
                    onClick={updateWhatsAppProfilePicture}
                    className="mt-auto sm:mt-0 w-full sm:w-auto sm:self-end"
                  >
                    {isUpdatingProfilePicture ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Update Picture
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Message Chunking Toggle */}
              <div className="mt-8">
                <h3 className="text-base font-medium mb-4">Message Settings</h3>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex gap-3">
                    <Sparkles className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">WhatsApp Message Chunking</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Split large messages into multiple paragraphs when sending through WhatsApp.
                        This improves readability and delivery reliability for long messages.                      
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={messageChunkingEnabled ? "default" : "outline"}
                    size="sm"
                    disabled={isSavingChunkSetting}
                    onClick={() => toggleMessageChunking(!messageChunkingEnabled)}
                  >
                    {isSavingChunkSetting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : messageChunkingEnabled ? (
                      "Enabled"
                    ) : (
                      "Disabled"
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            {!envStatus.a1baseAgentNumber && (
              <div className="mt-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-1">WhatsApp Number Required</h3>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        To update WhatsApp profile settings, you need to get a WhatsApp number from A1Base and configure
                        it in your environment variables.
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
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl">Webhook Configuration</CardTitle>
          <CardDescription className="text-sm">
            Configure webhooks for your A1Base channels
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
          <Tabs defaultValue="phone">
            <TabsList className="mb-4 w-full grid grid-cols-2">
              <TabsTrigger value="phone">WhatsApp/SMS</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
            </TabsList>
            
            <TabsContent value="phone" className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Configure your WhatsApp and SMS webhooks to enable message handling through A1Framework.
              </p>
              
              <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex gap-2 sm:gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-1">Important Setup Step</h3>
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                      Set your webhook URL to <code className="px-1 py-0.5 sm:px-2 sm:py-1 bg-amber-100 dark:bg-amber-800/40 rounded text-xs sm:text-sm break-all">{webhookUrls.phoneWebhook}</code> in the A1Base dashboard.
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
              
              <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex gap-2 sm:gap-3">
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
