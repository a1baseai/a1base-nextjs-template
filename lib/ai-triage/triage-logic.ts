import { ThreadMessage } from "@/types/chat";
import { getInitializedAdapter } from "../supabase/config";
import {
  DefaultReplyToMessage,
  ConstructEmail,
} from "../workflows/basic_workflow";
import { triageMessageIntent } from "../services/openai";
import { A1BaseAPI } from "a1base-node";

const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Helper function to get the base URL for API requests
const getBaseUrl = () => {
  // Browser context: use relative URLs
  if (typeof window !== "undefined") {
    return "";
  }

  // Server context: we need absolute URLs
  // First check for NEXTAUTH_URL which is commonly set in Next.js apps
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) return nextAuthUrl;

  // Then check for VERCEL_URL which is set in Vercel deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  // Finally, default to localhost if no environment variables are set
  return "http://localhost:3000";
};

type MessageRecord = {
  message_id: string;
  content: string;
  sender_number: string;
  sender_name: string;
  timestamp: string;
  message_type?: string;
  message_content?: {
    text?: string;
    data?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
    quoted_message_content?: string;
    quoted_message_sender?: string;
    reaction?: string;
    groupName?: string;
    inviteCode?: string;
    error?: string;
  };
};

type TriageParams = {
  thread_id: string;
  message_id: string;
  content: string;
  message_type: string;
  message_content: {
    text?: string;
    data?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
    quoted_message_content?: string;
    quoted_message_sender?: string;
    reaction?: string;
    groupName?: string;
    inviteCode?: string;
    error?: string;
  };
  sender_name: string;
  sender_number: string;
  thread_type: string;
  timestamp: string;
  messagesByThread: Map<string, MessageRecord[]>;
  service: string;
};

type TriageResult = {
  type: "default" | "email" | "onboarding";
  success: boolean;
  message?: string;
  data?: string[] | { subject?: string; body?: string };
};

// ======================== PROJECT TRIAGE LOGIC ========================
// Analyzes the last 10 messages in a chat to determine if they relate to an
// existing project. If not, creates a new project.
// ===================================================================

interface ProjectIntent {
  type: 'CONTINUE_CURRENT_PROJECT' | 'COMPLETE_PROJECT' | 'REFERENCE_PAST_PROJECT' | 'START_NEW_PROJECT';
  projectId?: string; // For REFERENCE_PAST_PROJECT
}

/**
 * Analyzes a message to determine the user's intent regarding projects
 */
async function analyzeProjectIntent(
  message: MessageRecord, 
  existingProjects: any[]
): Promise<ProjectIntent> {
  // Default to continuing current project
  let intent: ProjectIntent = { type: 'CONTINUE_CURRENT_PROJECT' };
  
  // Simple keyword matching
  const content = message.content.toLowerCase();
  
  // Check for project completion phrases
  if (content.includes('complete project') || 
      content.includes('finish project') || 
      content.includes('mark as done') ||
      content.includes('project is done') ||
      content.includes('project complete')) {
    intent.type = 'COMPLETE_PROJECT';
    return intent;
  }
  
  // Check for new project phrases
  if (content.includes('new project') || 
      content.includes('start project') ||
      content.includes('create project') ||
      content.includes('begin project')) {
    intent.type = 'START_NEW_PROJECT';
    return intent;
  }
  
  // Check if referencing a past project by name
  for (const project of existingProjects.filter(p => !p.is_live)) {
    const projectName = project.name.toLowerCase();
    if (content.includes(projectName)) {
      intent.type = 'REFERENCE_PAST_PROJECT';
      intent.projectId = project.id;
      return intent;
    }
  }
  
  // For more sophisticated intent detection, one could use an LLM here
  
  return intent;
}

/**
 * Create default project name and description from a message
 */
function createProjectDefaults(latestMessage: MessageRecord) {
  // Default project name is based on first few words of the latest message
  const defaultName = latestMessage.content
    .split(' ')
    .slice(0, 3)
    .join(' ')
    .trim()
    .substring(0, 30) + '...';
  
  // Default description includes the sender and a snippet of the message
  const defaultDescription = `Project started by ${latestMessage.sender_name}. Initial message: ${latestMessage.content.substring(0, 100)}${latestMessage.content.length > 100 ? '...' : ''}`;

  return { defaultName, defaultDescription };
}

/**
 * Creates a new project for a chat
 */
async function createNewProject(
  adapter: any, 
  chatId: string, 
  thread_id: string, 
  latestMessage: MessageRecord
): Promise<string | null> {
  const { defaultName, defaultDescription } = createProjectDefaults(latestMessage);
  
  // Create a new project
  const projectId = await adapter.createProject(
    defaultName,
    defaultDescription,
    chatId
  );

  if (projectId) {
    // Log project creation
    await adapter.logProjectEvent(
      projectId,
      'project_created',
      `Project created from thread ${thread_id}`
    );
    console.log(`[projectTriage] Created new project: ${defaultName} with ID: ${projectId}`);
  }
  
  return projectId;
}

export async function projectTriage(
  threadMessages: MessageRecord[],
  thread_id: string,
  chatId: string,
  service: string
): Promise<string | null> {
  console.log('[projectTriage] Starting project triage');

  try {
    // Get the adapter
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.log('[projectTriage] No adapter available, skipping project triage');
      return null;
    }

    // If there are no messages, skip project triage
    if (!threadMessages || threadMessages.length === 0) {
      console.log('[projectTriage] No messages to analyze, skipping project triage');
      return null;
    }

    // Get existing projects for this chat
    const existingProjects = await adapter.getProjectsByChat(chatId);
    
    // Find the currently live project (if any)
    const liveProject = existingProjects.find(p => p.is_live === true);
    
    // Get the latest message for analysis
    const latestMessage = threadMessages[threadMessages.length - 1];
    
    // Analyze message to determine intent regarding projects
    const intent = await analyzeProjectIntent(latestMessage, existingProjects);
    
    console.log(`[projectTriage] Detected intent: ${intent.type}`);
    
    switch (intent.type) {
      case 'CONTINUE_CURRENT_PROJECT':
        // Just return the current live project ID if it exists
        if (liveProject) {
          console.log(`[projectTriage] Continuing with existing project: ${liveProject.name}`);
          return liveProject.id;
        }
        // If no live project, fall through to create a new one
        console.log('[projectTriage] No live project to continue, will create new one');
        break;
      
      case 'COMPLETE_PROJECT':
        if (liveProject) {
          // Mark project as completed
          const updated = await adapter.updateProject(liveProject.id, { is_live: false });
          if (updated) {
            await adapter.logProjectEvent(
              liveProject.id,
              'project_completed',
              `Project completed: ${latestMessage.content.substring(0, 100)}`
            );
            console.log(`[projectTriage] Marked project as complete: ${liveProject.name}`);
          }
          return liveProject.id;
        }
        console.log('[projectTriage] No live project to complete');
        break;
      
      case 'REFERENCE_PAST_PROJECT':
        // If user is asking about a specific past project
        if (intent.projectId) {
          const referencedProject = existingProjects.find(p => p.id === intent.projectId);
          if (referencedProject) {
            console.log(`[projectTriage] Referencing past project: ${referencedProject.name}`);
            return intent.projectId;
          }
        }
        // Otherwise continue with live project or create new one
        if (liveProject) {
          console.log(`[projectTriage] Using live project: ${liveProject.name}`);
          return liveProject.id;
        }
        console.log('[projectTriage] No referenced project found, will create new one');
        break;
        
      case 'START_NEW_PROJECT':
        // If there's a live project, mark it as complete first
        if (liveProject) {
          const updated = await adapter.updateProject(liveProject.id, { is_live: false });
          if (updated) {
            await adapter.logProjectEvent(
              liveProject.id,
              'project_completed',
              `Project completed due to new project start`
            );
            console.log(`[projectTriage] Marked previous project as complete: ${liveProject.name}`);
          }
        }
        
        // Create a new project
        return await createNewProject(adapter, chatId, thread_id, latestMessage);
    }
    
    // Default case - return current live project or create a new one if none exists
    if (liveProject) {
      console.log(`[projectTriage] Using existing live project: ${liveProject.name}`);
      return liveProject.id;
    } else {
      console.log('[projectTriage] No live project found, creating new one');
      return await createNewProject(adapter, chatId, thread_id, latestMessage);
    }
  } catch (error) {
    console.error('[projectTriage] Error:', error);
    return null;
  }
}

// ======================== MAIN TRIAGE LOGIC ========================
// Processes incoming messages and routes them to appropriate workflows
// in basic_workflow.ts. Currently triages for:
// - Simple response to one off message
// - Drafting and sending an email
//
// To add new triage cases:
// 1. Add new responseType to triageMessageIntent() in openai.ts
// 2. Add corresponding workflow function in basic_workflow.ts
// 3. Add new case in switch statement below
// 4. Update TriageResult type if needed
// ===================================================================

export async function triageMessage({
  thread_id,
  // content,
  // sender_name,
  sender_number,
  thread_type,
  messagesByThread,
  service,
}: TriageParams): Promise<TriageResult> {
  console.log("[triageMessage] Starting message triage");

  try {
    let threadMessages: MessageRecord[] = [];

    // Skip Supabase for web-ui service
    if (service === "web-ui") {
      threadMessages = messagesByThread.get(thread_id) || [];
    } else {
      // Try to get messages from Supabase first
      const adapter = await getInitializedAdapter();

      if (adapter) {
        // console.log("[triageMessage] Using Supabase for message history");
        const thread = await adapter.getThread(thread_id);
        if (thread?.messages) {
          // Get last 10 messages from the thread
          threadMessages = thread.messages.slice(-10);
          // console.log(threadMessages);
        }
      } else {
        console.log(
          "[triageMessage] Using in-memory storage for message history"
        );
        threadMessages = messagesByThread.get(thread_id) || [];
      }
    }

    // Convert to ThreadMessage format
    const messages: ThreadMessage[] = threadMessages.map((msg) => ({
      content: msg.content,
      sender_number: msg.sender_number,
      sender_name: msg.sender_name,
      thread_id,
      thread_type,
      timestamp: msg.timestamp,
      message_id: msg.message_id,
      message_type: (msg.message_type ||
        "text") as ThreadMessage["message_type"],
      message_content: msg.message_content || {
        text: msg.content,
      },
      role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER ? "assistant" : "user"
    }));
    
    // Check for the exact "Start onboarding" trigger phrase in the most recent message
    const latestMessage = messages[messages.length - 1];
    const isOnboardingTrigger = 
      latestMessage && 
      latestMessage.role === "user" && 
      latestMessage.content && 
      latestMessage.content.trim().toLowerCase() === "start onboarding";
    
    // If it's an onboarding trigger, skip the intent classification
    const triage = isOnboardingTrigger 
      ? { responseType: "onboardingFlow" } 
      : await triageMessageIntent(messages);
    // Based on the triage result, choose the appropriate workflow

    switch (triage.responseType) {
      case "onboardingFlow":
        console.log("Running Onboarding Flow");
        
        const onboardingResponse = await DefaultReplyToMessage(
          messages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service
        );
        
        return {
          type: "onboarding",
          success: true,
          message: onboardingResponse,
        };
        
      case "handleEmailAction":
        console.log("Running Email Workflow");

        const emailData = await ConstructEmail(messages);

        if (service === "web-ui") {
          return {
            type: "email",
            success: true,
            message: `Email drafted with subject: ${emailData.subject}`,
            data: emailData,
          };
        }

        const emailConfirmation = `I've prepared an email with the subject "${emailData.subject}". Would you like me to send it?`;

        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          content: emailConfirmation,
          from: process.env.A1BASE_AGENT_NUMBER!,
          to: sender_number,
          service: "whatsapp",
        });

        return {
          type: "email",
          success: true,
          message: emailConfirmation,
          data: emailData,
        };

      case "simpleResponse":
      default:
        console.log("Running Default Response");

        const response = await DefaultReplyToMessage(
          messages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service
        );

        console.log("Response:", response);

        if (service === "web-ui") {
          return {
            type: "default",
            success: true,
            message: response,
          };
        }

        return {
          type: "default",
          success: true,
          message: response || "Default response sent",
        };
    }
  } catch (error) {
    console.error("[Triage] Error:", error);
    return {
      type: "default",
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
