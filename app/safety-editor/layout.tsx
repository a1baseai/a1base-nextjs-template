"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Save, CheckCircle2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SafetyEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSavedMessage, setShowSavedMessage] = React.useState(false);

  // Handle save action
  const handleSave = () => {
    // Set saving status
    setIsSaving(true);

    // Trigger the save event for child components to listen to
    const saveEvent = new CustomEvent("save-safety-settings");
    document.dispatchEvent(saveEvent);

    // Simulate successful save (in real app, wait for promises to resolve)
    setTimeout(() => {
      setIsSaving(false);
      setShowSavedMessage(true);
      toast.success("Safety settings saved successfully");

      // Hide the success message after a delay
      setTimeout(() => setShowSavedMessage(false), 3000);
    }, 1000);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <div className="mb-6">
            <Link href="/profile-editor" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="text-lg font-semibold">Back to Profile Editor</span>
            </Link>
          </div>

          {/* Page content */}
          {children}
        </div>

        {/* Floating action bar */}
        <div className="fixed bottom-6 right-6 left-6 max-w-4xl mx-auto bg-gradient-to-r from-blue-600 to-blue-800 dark:bg-gray-800 border dark:border-gray-700 p-4 rounded-lg shadow-lg z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {showSavedMessage && (
                <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  All changes saved
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className={isSaving ? "opacity-80" : ""}
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
