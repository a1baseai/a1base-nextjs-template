/**
 * Project Reminders Cron Endpoint
 *
 * This endpoint is designed to be called by a cron job to send reminders about active projects.
 * It iterates through all chats, checks for active projects, and sends a reminder message if any exist.
 *
 * How it works:
 * 1. Authenticates the request using the CRON_SECRET
 * 2. Queries all chats from the database
 * 3. For each chat, checks if there are active projects (is_live=true)
 * 4. If active projects exist, sends a reminder message using the AI agent
 * 5. The reminder includes project details, age, and suggestions for updates
 *
 * Security:
 * - Requires a valid CRON_SECRET in the Authorization header
 * - Uses HTTPS only
 *
 * Setup:
 * Configure this cron job to run at your desired frequency (e.g., daily or weekly)
 * using the A1Base Cron system or another cron service.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getInitializedAdapter } from "@/lib/supabase/config";
import { DefaultReplyToMessage } from "@/lib/workflows/basic_workflow";
import { routeConfig } from "@/lib/route-config";
import { ThreadMessage } from "@/types/chat";

const CRON_SECRET = process.env.CRON_SECRET;
// For development environment, use a default secret if not set
const isDevelopment = process.env.NODE_ENV === 'development';

export const POST = async (request: Request) => {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  // In development, if CRON_SECRET isn't set, accept any token for testing
  // In production, verify the authorization header matches the expected Bearer token
  if (!isDevelopment && CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    console.log(`[Project Reminders] Auth failed. Expected: Bearer ${CRON_SECRET}, Got: ${authHeader}`);
    return new NextResponse("Unauthorized", { status: 401 });
  }
  
  // If we're in development and CRON_SECRET isn't set, log a warning
  if (isDevelopment && !CRON_SECRET) {
    console.warn("[Project Reminders] CRON_SECRET not set in development environment. Proceeding without authentication check.");
  }

  try {
    console.log("[Project Reminders] Starting cron job execution");
    
    // Initialize the Supabase adapter
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error("[Project Reminders] Failed to initialize database adapter");
      return new NextResponse("Failed to initialize database adapter", { status: 500 });
    }
    
    console.log("[Project Reminders] Successfully initialized database adapter");

    // Get all chats from the database
    const { data: chats, error: chatsError } = await adapter.supabase
      .from("chats")
      .select("id, type, external_id, service");

    if (chatsError) {
      console.error("[Project Reminders] Error fetching chats:", chatsError);
      return new NextResponse("Error fetching chats", { status: 500 });
    }

    console.log(`[Project Reminders] Found ${chats.length} chats to process`);
    
    let remindersSent = 0;
    let chatsWithProjects = 0;
    
    // Process each chat
    for (const chat of chats) {
      console.log(`[Project Reminders] Processing chat ${chat.id} (${chat.type}) with external_id ${chat.external_id}`);
      
      // Get projects for this chat
      const projects = await adapter.getProjectsByChat(chat.id);
      console.log(`[Project Reminders] Chat ${chat.id} has ${projects.length} total projects:`, 
                  projects.map(p => `${p.name} (is_live: ${p.is_live})`))
      
      // Filter for active projects (is_live = true)
      const activeProjects = projects.filter(project => project.is_live === true);
      console.log(`[Project Reminders] Chat ${chat.id} has ${activeProjects.length} active projects`);
      
      if (activeProjects.length > 0) {
        chatsWithProjects++;
        console.log(`[Project Reminders] Chat ${chat.id} has ${activeProjects.length} active projects`);
        
        try {
          // Calculate project age and create a detailed list
          const projectDetails = activeProjects.map(project => {
            const createdAt = new Date(project.created_at);
            const now = new Date();
            const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            
            return {
              ...project,
              ageInDays,
              ageDescription: ageInDays === 0 ? 'today' : 
                             ageInDays === 1 ? 'yesterday' : 
                             `${ageInDays} days ago`
            };
          });
          
          // Sort projects by age (oldest first)
          projectDetails.sort((a, b) => b.ageInDays - a.ageInDays);
          
          // Create a formatted list of projects with their age
          const projectsList = projectDetails.map(p => 
            `- "${p.name}" (created ${p.ageDescription})`
          ).join("\n");
          
          // Create a system message with detailed project information
          const systemMessage: ThreadMessage = {
            content: `[SYSTEM INSTRUCTION: This is an automated reminder about active projects. The following projects are currently active in this chat:\n\n${projectsList}\n\nPlease remind the user about these projects in a friendly, helpful way. Suggest they update the status of these projects or mark them as completed if they're done. Don't mention this is an automated message; make it feel like a natural follow-up.]`,
            sender_number: process.env.A1BASE_AGENT_NUMBER || "",
            sender_name: "AI Assistant",
            thread_id: chat.external_id,
            thread_type: chat.type,
            timestamp: new Date().toISOString(),
            message_id: `system-reminder-${Date.now()}`,
            message_type: "text",
            message_content: { 
              text: `[SYSTEM INSTRUCTION: Project reminder]` 
            },
            role: "system",
          };
          
          // Create a context with active projects information
          const messages = [systemMessage];
          
          // Generate a reminder message using the AI
          const reminderMessage = await DefaultReplyToMessage(
            messages,
            chat.type as "individual" | "group",
            chat.external_id,
            "", // Empty string for sender_number for reminders
            chat.service,
            [], // No participants needed for this context
            activeProjects // Pass the active projects
          );
          
          console.log(`[Project Reminders] Sent reminder to chat ${chat.id}`);
          remindersSent++;
        } catch (error) {
          console.error(`[Project Reminders] Error sending reminder to chat ${chat.id}:`, error);
        }
      }
    }
    
    return new NextResponse(JSON.stringify({
      success: true,
      message: `Project reminders processed successfully`,
      stats: {
        totalChats: chats.length,
        chatsWithActiveProjects: chatsWithProjects,
        remindersSent: remindersSent
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error('[Project Reminders] Cron job failed:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
};

export const config = routeConfig;
