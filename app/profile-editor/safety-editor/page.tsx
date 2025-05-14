"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

type SafetySettings = {
  enabled: boolean;
  guidelines: string[];
  jailbreakWarning: string;
  identityStatements: string[];
};

export default function SafetySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SafetySettings>({
    enabled: true,
    guidelines: [],
    jailbreakWarning: '',
    identityStatements: []
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/safety-settings');
        if (!response.ok) {
          throw new Error('Failed to fetch safety settings');
        }
        const data = await response.json();
        setSettings(data);
      } catch (error) {
        console.error('Error fetching safety settings:', error);
        toast.error('Failed to load safety settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    
    // Listen for save event from the layout
    const handleSaveEvent = () => {
      handleSave();
    };
    
    document.addEventListener('save-profile-settings', handleSaveEvent);
    
    // Cleanup
    return () => {
      document.removeEventListener('save-profile-settings', handleSaveEvent);
    };
  }, []);

  const handleGuidelinesChange = (index: number, value: string) => {
    const newGuidelines = [...settings.guidelines];
    newGuidelines[index] = value;
    setSettings({ ...settings, guidelines: newGuidelines });
  };

  const addGuideline = () => {
    setSettings({
      ...settings,
      guidelines: [...settings.guidelines, '']
    });
  };

  const removeGuideline = (index: number) => {
    const newGuidelines = [...settings.guidelines];
    newGuidelines.splice(index, 1);
    setSettings({ ...settings, guidelines: newGuidelines });
  };

  const handleIdentityStatementsChange = (index: number, value: string) => {
    const newIdentityStatements = [...settings.identityStatements];
    newIdentityStatements[index] = value;
    setSettings({ ...settings, identityStatements: newIdentityStatements });
  };

  const addIdentityStatement = () => {
    setSettings({
      ...settings,
      identityStatements: [...settings.identityStatements, '']
    });
  };

  const removeIdentityStatement = (index: number) => {
    const newIdentityStatements = [...settings.identityStatements];
    newIdentityStatements.splice(index, 1);
    setSettings({ ...settings, identityStatements: newIdentityStatements });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/safety-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save safety settings');
      }

      toast.success('Safety settings saved successfully');
    } catch (error) {
      console.error('Error saving safety settings:', error);
      toast.error('Failed to save safety settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Safety Settings Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Safety Settings</CardTitle>
          <CardDescription>
            Configure AI safety guidelines and identity statements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="safety-enabled">Enable Safety Settings</Label>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  When disabled, safety guidelines and identity statements will not be included in the system prompt
                </div>
              </div>
              <Switch
                id="safety-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>
          </div>

          <Tabs defaultValue="guidelines" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
              <TabsTrigger value="jailbreak">Jailbreak Warning</TabsTrigger>
              <TabsTrigger value="identity">Identity Statements</TabsTrigger>
            </TabsList>
            
            <TabsContent value="guidelines">
              <div className="space-y-4">
                {settings.guidelines.map((guideline, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={guideline}
                      onChange={(e) => handleGuidelinesChange(index, e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => removeGuideline(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addGuideline} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" /> Add Guideline
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="jailbreak">
              <div className="space-y-2">
                <Label>Jailbreak Warning</Label>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Text to respond with when the AI detects a jailbreak attempt
                </div>
                <Textarea
                  value={settings.jailbreakWarning}
                  onChange={(e) => setSettings({ ...settings, jailbreakWarning: e.target.value })}
                  className="min-h-[200px]"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="identity">
              <div className="space-y-4">
                {settings.identityStatements.map((statement, index) => (
                  <div key={index} className="flex gap-2">
                    <Textarea
                      value={statement}
                      onChange={(e) => handleIdentityStatementsChange(index, e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => removeIdentityStatement(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addIdentityStatement} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" /> Add Identity Statement
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
