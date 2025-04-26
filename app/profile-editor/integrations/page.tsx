"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <Card className="shadow-md border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          Integrations
        </CardTitle>
        <CardDescription>Connect your agent to external services</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-8 text-center">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">Coming Soon</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This section is under development. You'll soon be able to connect your agent to various external services.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
