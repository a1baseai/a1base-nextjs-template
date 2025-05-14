import { ThreadMessage, MessageRecord } from "@/types/chat";
import { getInitializedAdapter } from "../supabase/config";
import {
  DefaultReplyToMessage,
  ConstructEmail,
} from "../workflows/basic_workflow";
import { triageMessageIntent } from "../services/openai";
import { TriageParams, TriageResult } from "./types";
import { ProjectIntent } from "../workflows/types";



/**
 * Analyzes a message to determine the user's intent regarding projects
 */
async function analyzeProjectIntent(
  message: MessageRecord,
  existingProjects: any[]
): Promise<ProjectIntent> {
  // Default to continuing current project
  let intent: ProjectIntent = { type: "CONTINUE_CURRENT_PROJECT" };

  // Simple keyword matching
  const content = message.content.toLowerCase();

  // Check for project completion phrases
  if (
    content.includes("complete project") ||
    content.includes("finish project") ||
    content.includes("mark as done") ||
    content.includes("project is done") ||
    content.includes("project complete")
  ) {
    intent.type = "COMPLETE_PROJECT";
    return intent;
  }

  // Check for new project phrases
  if (
    content.includes("new project") ||
    content.includes("start project") ||
    content.includes("create project") ||
    content.includes("begin project")
  ) {
    intent.type = "START_NEW_PROJECT";
    return intent;
  }

  // Check if referencing a past project by name
  for (const project of existingProjects.filter((p) => !p.is_live)) {
    const projectName = project.name.toLowerCase();
    if (content.includes(projectName)) {
      intent.type = "REFERENCE_PAST_PROJECT";
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
  const defaultName =
    latestMessage.content
      .split(" ")
      .slice(0, 3)
      .join(" ")
      .trim()
      .substring(0, 30) + "...";

  // Default description includes the sender and a snippet of the message
  const defaultDescription = `Project started by ${
    latestMessage.sender_name
  }. Initial message: ${latestMessage.content.substring(0, 100)}${
    latestMessage.content.length > 100 ? "..." : ""
  }`;

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
  const { defaultName, defaultDescription } =
    createProjectDefaults(latestMessage);

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
      "project_created",
      `Project created from thread ${thread_id}`
    );
  }

  return projectId;
}

export async function projectTriage(
  threadMessages: MessageRecord[],
  thread_id: string,
  chatId: string,
  service: string
): Promise<string | null> {
  try {
    // Get the adapter
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return null;
    }

    // If there are no messages, skip project triage
    if (!threadMessages || threadMessages.length === 0) {
      return null;
    }

    // Get existing projects for this chat
    const existingProjects = await adapter.getProjectsByChat(chatId);

    // Find the currently live project (if any)
    const liveProject = existingProjects.find((p) => p.is_live === true);

    // Get the latest message for analysis
    const latestMessage = threadMessages[threadMessages.length - 1];

    // Analyze message to determine intent regarding projects
    const intent = await analyzeProjectIntent(latestMessage, existingProjects);

    switch (intent.type) {
      case "CONTINUE_CURRENT_PROJECT":
        // Just return the current live project ID if it exists
        if (liveProject) {
          return liveProject.id;
        }
        // If no live project, fall through to create a new one
        break;

      case "COMPLETE_PROJECT":
        if (liveProject) {
          // Mark project as completed
          const updated = await adapter.updateProject(liveProject.id, {
            is_live: false,
          });
          if (updated) {
            await adapter.logProjectEvent(
              liveProject.id,
              "project_completed",
              `Project completed: ${latestMessage.content.substring(0, 100)}`
            );
          }
          return liveProject.id;
        }
        break;

      case "REFERENCE_PAST_PROJECT":
        // If user is asking about a specific past project
        if (intent.projectId) {
          const referencedProject = existingProjects.find(
            (p) => p.id === intent.projectId
          );
          if (referencedProject) {
            return intent.projectId;
          }
        }
        // Otherwise continue with live project or create new one
        if (liveProject) {
          return liveProject.id;
        }
        break;

      case "START_NEW_PROJECT":
        // If there's a live project, mark it as complete first
        if (liveProject) {
          const updated = await adapter.updateProject(liveProject.id, {
            is_live: false,
          });
          if (updated) {
            await adapter.logProjectEvent(
              liveProject.id,
              "project_completed",
              `Project completed due to new project start`
            );
          }
        }

        // Create a new project
        return await createNewProject(
          adapter,
          chatId,
          thread_id,
          latestMessage
        );
    }

    // Default case - return current live project or create a new one if none exists
    if (liveProject) {
      return liveProject.id;
    } else {
      return await createNewProject(adapter, chatId, thread_id, latestMessage);
    }
  } catch (error) {
    console.error("Error in project triage:", error);
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
  sender_number,
  thread_type,
  messagesByThread,
  service,
}: TriageParams): Promise<TriageResult> {
  // Initialize variables to hold participants and projects data
  let participants: any[] = [];
  let projects: any[] = [];

  try {
    let threadMessages: MessageRecord[] = [];

    // Skip Supabase for web-ui service
    if (service === "web-ui") {
      threadMessages = messagesByThread.get(thread_id) || [];
    } else {
      // Try to get messages from Supabase first
      try {
        // Init adapter
        const adapter = await getInitializedAdapter();
        if (adapter) {
          const thread = await adapter.getThread(thread_id);
          if (thread) {
            threadMessages = thread.messages || [];

            // Get participants data for context
            participants = thread.participants || [];

            // Get projects data associated with the chat
            if (thread.id) {
              try {
                projects = (await adapter.getProjectsByChat(thread.id)) || [];
              } catch (projectError) {
                console.error(
                  "Error retrieving projects for chat:",
                  projectError
                );
              }
            }
          } else {
            // Thread not found, fall back to in-memory
            threadMessages = messagesByThread.get(thread_id) || [];
          }
        } else {
          // No adapter, fall back to in-memory
          threadMessages = messagesByThread.get(thread_id) || [];
        }
      } catch (error) {
        console.error("Error retrieving thread from Supabase:", error);
        // Continue with in-memory as fallback
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
      role:
        msg.sender_number === process.env.A1BASE_AGENT_NUMBER
          ? "assistant"
          : "user",
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
    
    // Get the chat ID for project operations
    let chatId = null;
    let adapter = null;
    if (!isOnboardingTrigger && ["createProject", "updateProject", "completeProject", "referenceProject", "updateProjectAttributes"].includes(triage.responseType)) {
      try {
        adapter = await getInitializedAdapter();
        if (adapter) {
          const thread = await adapter.getThread(thread_id);
          if (thread && thread.id) {
            chatId = thread.id;
          }
        }
      } catch (error) {
        console.error("Error getting chat ID for project operation:", error);
      }
    }

    switch (triage.responseType) {
      case "onboardingFlow":
        const onboardingResponse = await DefaultReplyToMessage(
          messages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );

        return {
          type: "onboarding",
          success: true,
          message: onboardingResponse,
        };

      case "createProject":
        // Handle project creation intent
        let createProjectResult = null;
        let createProjectMessage = "";
        
        if (adapter && chatId) {
          // Create a new project using the adapter
          const projectName = (triage as any).projectName || "New Project";
          const projectDescription = (triage as any).projectDescription || "Project created from conversation";
          const projectAttributes = (triage as any).attributes || {};
          
          try {
            // Mark any existing live projects as complete first
            const existingProjects = await adapter.getProjectsByChat(chatId);
            const liveProject = existingProjects.find((p) => p.is_live === true);
            
            if (liveProject) {
              await adapter.updateProject(liveProject.id, { is_live: false });
              await adapter.logProjectEvent(
                liveProject.id,
                "project_completed",
                "Project completed due to new project creation"
              );
            }
            
            // Create the new project
            createProjectResult = await adapter.createProject(
              projectName,
              projectDescription,
              chatId,
              projectAttributes
            );
            
            if (createProjectResult) {
              // Log the creation event
              await adapter.logProjectEvent(
                createProjectResult,
                "project_created",
                `Project created with name: ${projectName}`
              );
              
              createProjectMessage = `Created new project: ${projectName}`;
            }
          } catch (error) {
            console.error("Error creating project:", error);
            createProjectMessage = "Failed to create project";
          }
        } else {
          createProjectMessage = "Unable to create project - chat not found";
        }
        
        // Create context message about what was done
        const createContextProjectName = (triage as any).projectName || "New Project";
        const createProjectContext = `Project "${createContextProjectName}" was just created. The project is now active. ${createProjectMessage}`.trim();
        
        // Add a system message to inform the AI about the project action
        const createMessagesWithContext = [...messages, {
          content: createProjectContext,
          sender_number: process.env.A1BASE_AGENT_NUMBER || "",
          sender_name: "AI Assistant",
          thread_id,
          thread_type,
          timestamp: new Date().toISOString(),
          message_id: `system-ctx-${Date.now()}`,
          message_type: "text" as ThreadMessage["message_type"],
          message_content: { text: createProjectContext },
          role: "assistant"
        } as ThreadMessage];
        
        // Still generate a default response even for project creation
        const createProjectResponse = await DefaultReplyToMessage(
          createMessagesWithContext,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );
        
        return {
          type: "project",
          success: createProjectResult !== null,
          message: createProjectResponse,
          data: {
            projectAction: "create",
            projectName: (triage as any).projectName,
            projectDescription: (triage as any).projectDescription,
            projectId: createProjectResult || undefined
          }
        };
        
      case "updateProject":
        // Handle project update intent
        let updateProjectResult = false;
        let updateProjectMessage = "";
        
        if (adapter && chatId && projects.length > 0) {
          // Get the live project or the specified project by name
          const targetProjectName = (triage as any).projectName || "";
          let targetProject;
          
          if (targetProjectName) {
            // Find project by name
            targetProject = projects.find(p => 
              p.name.toLowerCase() === targetProjectName.toLowerCase());
          } else {
            // Use the live project
            targetProject = projects.find(p => p.is_live === true);
          }
          
          if (targetProject) {
            try {
              // Get the updates from the triage result
              const updates = (triage as any).updates || {};
              
              // Apply the updates
              updateProjectResult = await adapter.updateProject(
                targetProject.id,
                updates
              );
              
              if (updateProjectResult) {
                // Log the update event
                await adapter.logProjectEvent(
                  targetProject.id,
                  "project_updated",
                  `Project updated: ${JSON.stringify(updates)}`
                );
                
                updateProjectMessage = `Updated project: ${targetProject.name}`;
              }
            } catch (error) {
              console.error("Error updating project:", error);
              updateProjectMessage = "Failed to update project";
            }
          } else {
            updateProjectMessage = "No matching project found";
          }
        } else {
          updateProjectMessage = "Unable to update project - no active projects";
        }
        
        // Get the project name for context
        const updateContextProjectName = (triage as any).projectName || "unknown project";
        
        // Create context message about what was done
        const updateProjectContext = `Project "${updateContextProjectName}" was just updated. ${updateProjectMessage}`.trim();
        
        // Add a system message to inform the AI about the project action
        const updateMessagesWithContext = [...messages, {
          content: updateProjectContext,
          sender_number: process.env.A1BASE_AGENT_NUMBER || "",
          sender_name: "AI Assistant",
          thread_id,
          thread_type,
          timestamp: new Date().toISOString(),
          message_id: `system-ctx-${Date.now()}`,
          message_type: "text" as ThreadMessage["message_type"],
          message_content: { text: updateProjectContext },
          role: "assistant"
        } as ThreadMessage];
        
        // Still generate a default response for project update
        const updateProjectResponse = await DefaultReplyToMessage(
          updateMessagesWithContext,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );
        
        return {
          type: "project",
          success: updateProjectResult,
          message: updateProjectResponse,
          data: {
            projectAction: "update",
            projectName: (triage as any).projectName,
            updates: (triage as any).updates
          }
        };
        
      case "completeProject":
        // Handle project completion intent
        let completeProjectResult = false;
        let completeProjectMessage = "";
        
        if (adapter && chatId && projects.length > 0) {
          // Get the live project or the specified project by name
          const targetProjectName = (triage as any).projectName || "";
          let targetProject;
          
          if (targetProjectName) {
            // Find project by name
            targetProject = projects.find(p => 
              p.name.toLowerCase() === targetProjectName.toLowerCase());
          } else {
            // Use the live project
            targetProject = projects.find(p => p.is_live === true);
          }
          
          if (targetProject) {
            try {
              // Mark the project as complete
              completeProjectResult = await adapter.updateProject(
                targetProject.id,
                { is_live: false }
              );
              
              if (completeProjectResult) {
                // Log the completion event
                await adapter.logProjectEvent(
                  targetProject.id,
                  "project_completed",
                  `Project marked as complete`
                );
                
                completeProjectMessage = `Completed project: ${targetProject.name}`;
              }
            } catch (error) {
              console.error("Error completing project:", error);
              completeProjectMessage = "Failed to complete project";
            }
          } else {
            completeProjectMessage = "No active project found to complete";
          }
        } else {
          completeProjectMessage = "Unable to complete project - no active projects";
        }
        
        // Get the project name for context
        const completeContextProjectName = (triage as any).projectName || "unknown project";
        
        // Create context message about what was done
        const completeProjectContext = `Project "${completeContextProjectName}" was just marked as completed. ${completeProjectMessage}`.trim();
        
        // Add a system message to inform the AI about the project action
        const completeMessagesWithContext = [...messages, {
          content: completeProjectContext,
          sender_number: process.env.A1BASE_AGENT_NUMBER || "",
          sender_name: "AI Assistant",
          thread_id,
          thread_type,
          timestamp: new Date().toISOString(),
          message_id: `system-ctx-${Date.now()}`,
          message_type: "text" as ThreadMessage["message_type"],
          message_content: { text: completeProjectContext },
          role: "assistant"
        } as ThreadMessage];
        
        // Still generate a default response for project completion
        const completeProjectResponse = await DefaultReplyToMessage(
          completeMessagesWithContext,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );
        
        return {
          type: "project",
          success: completeProjectResult,
          message: completeProjectResponse,
          data: {
            projectAction: "complete",
            projectName: (triage as any).projectName
          }
        };
        
      case "updateProjectAttributes":
        // Handle project attribute updates
        let updateAttributesResult = false;
        let updateAttributesMessage = "";
        
        if (adapter && chatId && projects.length > 0) {
          // Get the live project or the specified project by name
          const targetProjectName = (triage as any).projectName || "";
          let targetProject;
          
          if (targetProjectName) {
            // Find project by name
            targetProject = projects.find(p => 
              p.name.toLowerCase() === targetProjectName.toLowerCase());
          } else {
            // Use the live project
            targetProject = projects.find(p => p.is_live === true);
          }
          
          if (targetProject) {
            try {
              // Get the attribute updates from the triage result
              const attributeUpdates = (triage as any).attributeUpdates || {};
              const replaceAttributes = (triage as any).replaceAttributes === true;
              
              // Update the attributes
              updateAttributesResult = await adapter.updateProjectAttributes(
                targetProject.id,
                attributeUpdates,
                replaceAttributes
              );
              
              if (updateAttributesResult) {
                // Log the update event
                await adapter.logProjectEvent(
                  targetProject.id,
                  "project_attributes_updated",
                  `Project attributes updated: ${JSON.stringify(attributeUpdates)}`
                );
                
                updateAttributesMessage = `Updated project attributes for: ${targetProject.name}`;
              }
            } catch (error) {
              console.error("Error updating project attributes:", error);
              updateAttributesMessage = "Failed to update project attributes";
            }
          } else {
            updateAttributesMessage = "No matching project found";
          }
        } else {
          updateAttributesMessage = "Unable to update project attributes - no active projects";
        }
        
        // Get the project name for context
        const attributesContextProjectName = (triage as any).projectName || "unknown project";
        
        // Create context message about what was done
        const updateAttributesContext = `Project "${attributesContextProjectName}" attributes were just updated. ${updateAttributesMessage}`.trim();
        
        // Add a system message to inform the AI about the project action
        const attributesMessagesWithContext = [...messages, {
          content: updateAttributesContext,
          sender_number: process.env.A1BASE_AGENT_NUMBER || "",
          sender_name: "AI Assistant",
          thread_id,
          thread_type,
          timestamp: new Date().toISOString(),
          message_id: `system-ctx-${Date.now()}`,
          message_type: "text" as ThreadMessage["message_type"],
          message_content: { text: updateAttributesContext },
          role: "assistant"
        } as ThreadMessage];
        
        // Still generate a default response for attribute updates
        const updateAttributesResponse = await DefaultReplyToMessage(
          attributesMessagesWithContext,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );
        
        return {
          type: "project",
          success: updateAttributesResult,
          message: updateAttributesResponse,
          data: {
            projectAction: "updateAttributes",
            projectName: (triage as any).projectName,
            attributeUpdates: (triage as any).attributeUpdates,
            replaceAttributes: (triage as any).replaceAttributes === true
          }
        };
        
      case "referenceProject":
        // Handle reference to past project
        let referenceProjectResult = null;
        
        if (adapter && chatId && projects.length > 0) {
          // Find the referenced project
          const targetProjectName = (triage as any).projectName || "";
          
          if (targetProjectName) {
            const referencedProject = projects.find(p => 
              p.name.toLowerCase() === targetProjectName.toLowerCase());
              
            if (referencedProject) {
              referenceProjectResult = referencedProject.id;
            }
          }
        }
        
        // Create context message about what was done
        const referenceResultMessage = referenceProjectResult ? 
          `Referenced project with ID ${referenceProjectResult}` : 
          "Could not find the referenced project";
          
        const referenceProjectContext = `${referenceResultMessage}`.trim();
        
        // Add a system message to inform the AI about the project action
        const referenceMessagesWithContext = [...messages, {
          content: referenceProjectContext,
          sender_number: process.env.A1BASE_AGENT_NUMBER || "",
          sender_name: "AI Assistant",
          thread_id,
          thread_type,
          timestamp: new Date().toISOString(),
          message_id: `system-ctx-${Date.now()}`,
          message_type: "text" as ThreadMessage["message_type"],
          message_content: { text: referenceProjectContext },
          role: "assistant"
        } as ThreadMessage];
        
        // Still generate a default response for project reference
        const referenceProjectResponse = await DefaultReplyToMessage(
          referenceMessagesWithContext,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );
        
        return {
          type: "project",
          success: referenceProjectResult !== null,
          message: referenceProjectResponse,
          data: {
            projectAction: "reference",
            projectName: (triage as any).projectName,
            projectId: referenceProjectResult || undefined
          }
        };

      case "noReply":
        // Just return an empty success response
        return {
          type: "default",
          success: true,
          message: "",
        };

      case "simpleResponse":
      default:
        const response = await DefaultReplyToMessage(
          messages,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );

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
    console.error("Error in message triage:", error);
    return {
      type: "default",
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
