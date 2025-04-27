"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, FileCode, Edit } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export default function TriageLogicViewer() {
  const [triageFileContent, setTriageFileContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Load the triage file content
  useEffect(() => {
    const fetchTriageLogic = async () => {
      try {
        setIsLoading(true);

        const response = await fetch("/api/triage-logic");

        if (!response.ok) {
          throw new Error("Failed to fetch triage logic");
        }

        const data = await response.json();
        setTriageFileContent(data.content);
      } catch (error) {
        console.error("Error loading triage logic:", error);
        toast.error("Failed to load triage logic");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTriageLogic();
  }, []);

  // Function to get the absolute file path for editors
  const getFullPath = () => {
    return `/Users/pasha/Projects/a1consumer/a1foundermode/lib/ai-triage/triage-logic.ts`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Triage Logic</h1>
        <p className="text-gray-500 dark:text-gray-400">
          View how your agent triages and routes incoming messages
        </p>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>How to Edit Triage Logic</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            The triage logic file needs to be edited directly on your machine.
            You can't edit it in the browser.
          </p>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <p className="font-semibold mb-1">To edit this file:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the triage logic file in your code editor</li>
              <li>Make your changes</li>
              <li>Save the file</li>
              <li>Restart the application if necessary</li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Triage Logic Code</CardTitle>
            <CardTitle className="text-sm font-normal text-gray-500 dark:text-gray-400">
              lib/ai-triage/triage-logic.ts
            </CardTitle>
          </div>
          <div>
            <Button
              variant="outline"
              className="mr-2"
              onClick={() => {
                // Copy the file path to clipboard
                navigator.clipboard.writeText(getFullPath());
                toast.success("File path copied to clipboard");
              }}
            >
              <FileCode className="h-4 w-4 mr-2" />
              Copy Path
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <ScrollArea className="h-[600px] w-full rounded-md border">
              <pre className="p-4 text-sm font-mono">
                <code className="language-typescript">{triageFileContent}</code>
              </pre>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm space-y-4">
        <h3 className="font-medium">Documentation</h3>

        <div className="space-y-2">
          <h4 className="font-medium">What is AI Triage Logic?</h4>
          <p className="text-gray-500 dark:text-gray-400">
            The triage logic determines how your agent analyzes incoming
            messages and decides which workflow should handle them. It's the
            routing layer that makes your agent smart.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Tips for Editing</h4>
          <ul className="list-disc pl-5 text-gray-500 dark:text-gray-400 space-y-1">
            <li>Add new patterns to match different types of user requests</li>
            <li>
              Ensure each request maps to the appropriate workflow function
            </li>
            <li>Be careful with regex patterns and test thoroughly</li>
            <li>
              Update the explanations in comments to help future understanding
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
