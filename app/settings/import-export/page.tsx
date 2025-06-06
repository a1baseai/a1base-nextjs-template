"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Download, Upload, FileJson, AlertCircle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Define the settings files we want to export/import
const SETTINGS_FILES = [
  { name: "profile-settings.json", description: "Agent profile and personality settings" },
  { name: "group-onboarding-flow.json", description: "Group chat onboarding configuration" },
  { name: "onboarding-flow.json", description: "Individual chat onboarding configuration" },
  { name: "safety-settings.json", description: "Safety and moderation settings" },
  { name: "message-settings.json", description: "Message formatting preferences" },
  { name: "agent-memory-settings.json", description: "Agent memory configuration" },
  { name: "base-information.json", description: "Base information settings" },
  { name: "model-settings.json", description: "AI model preferences" },
]

interface SettingsData {
  version: string
  exportedAt: string
  settings: {
    [key: string]: any
  }
}

export default function ImportExportPage() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importData, setImportData] = useState<SettingsData | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0) // For resetting file input
  const { toast } = useToast()

  const exportSettings = async () => {
    setExporting(true)
    try {
      // Fetch all settings files
      const settingsData: { [key: string]: any } = {}
      const errors: string[] = []

      for (const file of SETTINGS_FILES) {
        try {
          const response = await fetch(`/api/settings/export?file=${encodeURIComponent(file.name)}`)
          if (response.ok) {
            const data = await response.json()
            settingsData[file.name] = data
          } else {
            errors.push(`Failed to fetch ${file.name}`)
          }
        } catch (error) {
          errors.push(`Error fetching ${file.name}: ${error}`)
        }
      }

      if (errors.length > 0) {
        toast({
          title: "Export completed with warnings",
          description: `Some files could not be exported: ${errors.join(", ")}`,
          variant: "destructive",
        })
      }

      // Create the export data
      const exportData: SettingsData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        settings: settingsData,
      }

      // Download the file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `a1-settings-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export successful",
        description: "Your settings have been exported successfully.",
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export failed",
        description: "Failed to export settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text) as SettingsData

      // Validate the data structure
      if (!data.version || !data.settings) {
        throw new Error("Invalid settings file format")
      }

      setImportData(data)
      toast({
        title: "File loaded",
        description: "Review the settings below before importing.",
      })
    } catch (error) {
      console.error("File read error:", error)
      toast({
        title: "Invalid file",
        description: "The selected file is not a valid settings export.",
        variant: "destructive",
      })
      setFileInputKey(prev => prev + 1) // Reset file input
    }
  }

  const importSettings = async () => {
    if (!importData) return

    setImporting(true)
    try {
      const results: { file: string; success: boolean; error?: string }[] = []

      for (const [fileName, fileData] of Object.entries(importData.settings)) {
        try {
          const response = await fetch("/api/settings/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName,
              data: fileData,
            }),
          })

          const result = await response.json()
          results.push({
            file: fileName,
            success: result.success,
            error: result.error,
          })
        } catch (error) {
          results.push({
            file: fileName,
            success: false,
            error: String(error),
          })
        }
      }

      // Check results
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)

      if (failed.length === 0) {
        toast({
          title: "Import successful",
          description: `All ${successful.length} settings files imported successfully.`,
        })
      } else if (successful.length > 0) {
        toast({
          title: "Partial import",
          description: `${successful.length} files imported, ${failed.length} failed.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Import failed",
          description: "No settings files could be imported.",
          variant: "destructive",
        })
      }

      // Reset state
      setImportData(null)
      setFileInputKey(prev => prev + 1)
    } catch (error) {
      console.error("Import error:", error)
      toast({
        title: "Import failed",
        description: "Failed to import settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              <h1 className="text-xl font-semibold">Import/Export Settings</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              This feature allows you to export and import all your agent settings. 
              Always review imported settings before applying them, as they will overwrite your current configuration.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Settings
              </CardTitle>
              <CardDescription>
                Download all your current settings as a single JSON file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This will export the following settings files:
                </p>
                <ul className="text-sm space-y-1 ml-4">
                  {SETTINGS_FILES.map(file => (
                    <li key={file.name} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{file.name}</span>
                        <span className="text-muted-foreground"> - {file.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <Button 
                onClick={exportSettings} 
                disabled={exporting}
                className="w-full sm:w-auto"
              >
                {exporting ? "Exporting..." : "Export All Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Settings
              </CardTitle>
              <CardDescription>
                Upload a previously exported settings file to restore your configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="settings-file-input"
                  />
                  <label htmlFor="settings-file-input">
                    <Button variant="outline" className="cursor-pointer" asChild>
                      <span>Choose File</span>
                    </Button>
                  </label>
                </div>

                {importData && (
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Ready to Import</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-2 mt-2">
                          <p>File version: {importData.version}</p>
                          <p>Exported at: {new Date(importData.exportedAt).toLocaleString()}</p>
                          <p>Contains {Object.keys(importData.settings).length} settings files</p>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="flex gap-4">
                      <Button 
                        onClick={importSettings} 
                        disabled={importing}
                      >
                        {importing ? "Importing..." : "Import Settings"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setImportData(null)
                          setFileInputKey(prev => prev + 1)
                        }}
                        disabled={importing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 