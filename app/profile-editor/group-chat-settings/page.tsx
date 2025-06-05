"use client"

import { useState, useEffect } from "react"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { MessageSquare } from "lucide-react"
import { AgentProfileSettings } from "@/lib/agent-profile/types"
import { getAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings"
import { saveProfileSettings } from "@/lib/storage/file-storage"

export default function GroupChatSettingsPage() {
  const [profileSettings, setProfileSettings] = useState<AgentProfileSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadProfileSettings()
    
    // Listen for save events from the ProfileEditorLayout
    const handleSaveEvent = () => {
      handleSave()
    }
    
    document.addEventListener('save-profile-settings', handleSaveEvent)
    
    return () => {
      document.removeEventListener('save-profile-settings', handleSaveEvent)
    }
  }, [])

  const loadProfileSettings = async () => {
    setLoading(true)
    try {
      const settings = await getAgentProfileSettings()
      setProfileSettings(settings)
    } catch (error) {
      console.error("Error loading profile settings:", error)
      toast({
        title: "Error",
        description: "Failed to load profile settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profileSettings) {
      toast({
        title: "Error",
        description: "No settings to save.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const success = await saveProfileSettings(profileSettings)
      
      if (success) {
        toast({
          title: "Success",
          description: "Group chat settings saved successfully",
        })
      } else {
        throw new Error("Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving profile settings:", error)
      toast({
        title: "Error Saving Settings",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateGroupChatPreference = (key: "respond_only_when_mentioned", value: any) => {
    if (!profileSettings) return
    
    setProfileSettings(prev => ({
      ...prev!,
      groupChatPreferences: {
        ...prev!.groupChatPreferences,
        [key]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading settings...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profileSettings) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Failed to load profile settings. Please refresh the page.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Group Chat Preferences
              </CardTitle>
              <CardDescription>
                Control how the AI agent "{profileSettings.name}" responds to messages in WhatsApp group chats. These settings are part of the agent's core profile configuration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ToggleSwitch
                id="respond-only-when-mentioned"
                checked={profileSettings.groupChatPreferences.respond_only_when_mentioned === true}
                onCheckedChange={(checked) => updateGroupChatPreference("respond_only_when_mentioned", checked)}
                label="Respond Only When Mentioned (Group Chats)"
                description="When enabled, the agent will only respond to WhatsApp GROUP messages where the agent is explicitly mentioned. Individual chats always receive responses."
                disabled={loading}
              />
              <Separator />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">How it works:</p>
                <ul className="space-y-1 pl-4">
                  <li>• <strong>Enabled:</strong> In group chats, agent responds only when mentioned (e.g., "{profileSettings.name}")</li>
                  <li>• <strong>Disabled:</strong> Agent responds to all group messages automatically</li>
                  <li>• <strong>Individual chats:</strong> Agent always responds regardless of this setting</li>
                  <li>• This setting only affects WhatsApp group conversations</li>
                </ul>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <Button 
                  variant="outline" 
                  onClick={loadProfileSettings}
                  disabled={loading || saving}
                >
                  Reload Settings
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={loading || saving}
                >
                  {saving ? "Saving..." : "Save Group Chat Settings"}
                </Button>
              </div>
            </CardContent>
        </Card>
    </div>
  )
} 