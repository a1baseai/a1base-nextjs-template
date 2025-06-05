"use client"

import { useState, useEffect } from "react"
// import { ToggleSwitch } from "@/components/ui/toggle-switch" // No longer needed here
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { Settings, User, Bell, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { UserPreferences } from "@/types/chat"

interface UserSettings {
  phoneNumber: string
  preferences: UserPreferences
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    phoneNumber: "",
    preferences: {} // Keep email or other general preferences here
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const defaultPhoneNumber = process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER || "+1234567890"
    setSettings(prev => ({ ...prev, phoneNumber: defaultPhoneNumber }))
    loadUserSettings(defaultPhoneNumber)
  }, [])

  const loadUserSettings = async (phoneNumber: string) => {
    if (!phoneNumber) return
    setLoading(true)
    try {
      const response = await fetch(`/api/settings/user-preferences?phone_number=${encodeURIComponent(phoneNumber)}`)
      const data = await response.json()
      if (data.success) {
        setSettings(prev => ({
          ...prev,
          // Only load preferences relevant to this page (e.g., email, excluding group chat toggle)
          preferences: { email: data.preferences?.email } 
        }))
      } else {
        console.warn("Failed to load user settings:", data.error)
        if (!data.error?.includes("User not found")) {
          toast({
            title: "Error",
            description: "Failed to load settings. Using defaults.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      toast({
        title: "Error",
        description: "Failed to load settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings.phoneNumber) {
      toast({ title: "Error", description: "Phone number is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/settings/user-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: settings.phoneNumber,
          // Only save preferences managed by this page
          preferences: { email: settings.preferences.email }, 
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast({ title: "Success", description: "Settings saved successfully" })
      } else {
        throw new Error(data.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const updatePreference = (key: keyof UserPreferences, value: any) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value
      }
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <h1 className="text-xl font-semibold">General Settings</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Manage your basic profile settings. Group chat specific settings are now in the Profile Editor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="phone-number">Phone Number (for API context)</Label>
                <Input
                  id="phone-number"
                  value={settings.phoneNumber}
                  onChange={(e) => setSettings(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="+1234567890"
                  className="max-w-md"
                  disabled // Assuming this is primarily for context now
                />
                <p className="text-xs text-muted-foreground">
                  This phone number is used for API interactions. Group chat settings are managed elsewhere.
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.preferences.email || ""}
                  onChange={(e) => updatePreference("email", e.target.value)}
                  placeholder="your@email.com"
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  Email address for receiving reports and notifications.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Removed Messaging Preferences Card */}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Additional notification settings will be available in future updates.
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button 
              variant="outline" 
              onClick={() => loadUserSettings(settings.phoneNumber)}
              disabled={loading || saving}
            >
              Reset
            </Button>
            <Button 
              onClick={saveSettings}
              disabled={loading || saving || !settings.phoneNumber}
            >
              {saving ? "Saving..." : "Save General Settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 