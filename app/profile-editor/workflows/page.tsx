"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, FileCode, ExternalLink, Edit } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface WorkflowFile {
  name: string;
  path: string;
  content: string;
}

export default function WorkflowsViewer() {
  const [workflowFiles, setWorkflowFiles] = useState<WorkflowFile[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the workflow files
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/workflows");

        if (!response.ok) {
          throw new Error("Failed to fetch workflows");
        }

        const data = await response.json();
        setWorkflowFiles(data.workflows);

        // Select the first workflow by default
        if (data.workflows.length > 0 && !selectedWorkflow) {
          setSelectedWorkflow(data.workflows[0].path);
        }
      } catch (error) {
        console.error("Error loading workflows:", error);
        toast.error("Failed to load workflow files");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  const handleSelectWorkflow = (path: string) => {
    const selectedFile = workflowFiles.find((file) => file.path === path);
    if (selectedFile) {
      setSelectedWorkflow(path);
    }
  };

  // Function to get the absolute file path for editors
  const getFullPath = (relativePath: string) => {
    return `/Users/pasha/Projects/a1consumer/a1foundermode/${relativePath}`;
  };

  // Get the selected workflow content
  const getSelectedWorkflowContent = () => {
    if (!selectedWorkflow) return "";
    const selectedFile = workflowFiles.find(
      (file) => file.path === selectedWorkflow
    );
    return selectedFile?.content || "";
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
        <h1 className="text-2xl font-bold">Workflow Files</h1>
        <p className="text-gray-500 dark:text-gray-400">
          View your agent's workflow files
        </p>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>How to Edit Workflows</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            These workflow files need to be edited directly on your machine. You
            can't edit them in the browser.
          </p>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <p className="font-semibold mb-1">To edit these files:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the workflow file in your code editor</li>
              <li>Make your changes</li>
              <li>Save the file</li>
              <li>Restart the application if necessary</li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Files</CardTitle>
              <CardDescription>Select a file to view</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workflowFiles.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No workflow files found
                  </p>
                ) : (
                  workflowFiles.map((file) => (
                    <Button
                      key={file.path}
                      variant={
                        selectedWorkflow === file.path ? "default" : "outline"
                      }
                      className="w-full justify-start"
                      onClick={() => handleSelectWorkflow(file.path)}
                    >
                      <FileCode className="h-4 w-4 mr-2" />
                      {file.name}
                    </Button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="md:col-span-3">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {selectedWorkflow
                    ? workflowFiles.find((f) => f.path === selectedWorkflow)
                        ?.name
                    : "Select a workflow"}
                </CardTitle>
                <CardDescription>
                  {selectedWorkflow ||
                    "Please select a workflow file from the list"}
                </CardDescription>
              </div>

              {selectedWorkflow && (
                <div>
                  <Button
                    variant="outline"
                    className="mr-2"
                    onClick={() => {
                      // Copy the file path to clipboard
                      navigator.clipboard.writeText(
                        getFullPath(selectedWorkflow)
                      );
                      toast.success("File path copied to clipboard");
                    }}
                  >
                    <FileCode className="h-4 w-4 mr-2" />
                    Copy Path
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedWorkflow ? (
              <div className="relative">
                <ScrollArea className="h-[600px] w-full rounded-md border">
                  <pre className="p-4 text-sm font-mono">
                    <code className="language-typescript">
                      {getSelectedWorkflowContent()}
                    </code>
                  </pre>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[600px] border border-dashed rounded-md">
                <p className="text-gray-500 dark:text-gray-400">
                  Select a workflow file to view
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
