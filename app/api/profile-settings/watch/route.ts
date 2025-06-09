/**
 * Profile Settings Watch API Route
 * 
 * Provides Server-Sent Events (SSE) for real-time profile updates
 * when the profile-settings.json file changes
 */

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { AgentProfileSettings } from "@/lib/agent-profile/types";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROFILE_SETTINGS_FILE = path.join(process.cwd(), "data", "profile-settings.json");

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      const sendUpdate = () => {
        try {
          if (fs.existsSync(PROFILE_SETTINGS_FILE)) {
            const data = fs.readFileSync(PROFILE_SETTINGS_FILE, "utf8");
            const settings = JSON.parse(data) as AgentProfileSettings;
            
            const message = `data: ${JSON.stringify({ settings })}\n\n`;
            controller.enqueue(encoder.encode(message));
          }
        } catch (error) {
          console.error("Error reading profile settings:", error);
        }
      };
      
      // Send initial data
      sendUpdate();
      
      // Watch for file changes
      let watcher: fs.FSWatcher | null = null;
      
      try {
        watcher = fs.watch(PROFILE_SETTINGS_FILE, (eventType) => {
          if (eventType === 'change') {
            // Add a small delay to ensure file write is complete
            setTimeout(sendUpdate, 100);
          }
        });
      } catch (error) {
        console.error("Error setting up file watcher:", error);
      }
      
      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        if (watcher) {
          watcher.close();
        }
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 