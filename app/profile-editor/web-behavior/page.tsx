"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";

export default function WebBehaviorPage() {
  return (
    <Card className="shadow-md border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Web Behavior
        </CardTitle>
        <CardDescription>Configure how your agent behaves on the web</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-8 text-center">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">Coming Soon</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This section is under development. You'll soon be able to configure your agent's web browsing behavior and preferences.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
