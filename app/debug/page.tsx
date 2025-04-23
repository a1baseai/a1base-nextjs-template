"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
  const [envStatus, setEnvStatus] = useState<{
    openaiKeyAvailable: boolean;
    a1baseKeyAvailable: boolean;
    a1baseAgentName: string | null;
  }>({
    openaiKeyAvailable: false,
    a1baseKeyAvailable: false,
    a1baseAgentName: null,
  });

  useEffect(() => {
    async function checkEnvVars() {
      try {
        const response = await fetch("/api/debug-env");
        const data = await response.json();
        setEnvStatus(data);
      } catch (error) {
        console.error("Failed to check environment variables:", error);
      }
    }

    checkEnvVars();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>
      <div className="space-y-4 p-4 border rounded-lg">
        <div>
          <h2 className="font-medium">OpenAI API Key:</h2>
          <p className="ml-4">
            {envStatus.openaiKeyAvailable ? "✅ Available" : "❌ Not Available"}
          </p>
        </div>

        <div>
          <h2 className="font-medium">A1BASE API Key:</h2>
          <p className="ml-4">
            {envStatus.a1baseKeyAvailable ? "✅ Available" : "❌ Not Available"}
          </p>
        </div>

        <div>
          <h2 className="font-medium">A1BASE Agent Name:</h2>
          <p className="ml-4">
            {envStatus.a1baseAgentName ? `✅ ${envStatus.a1baseAgentName}` : "❌ Not Available"}
          </p>
        </div>
      </div>
    </div>
  );
}
