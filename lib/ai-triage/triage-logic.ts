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

  // Check for explicit project creation phrases - be very strict to avoid false positives
  if (
    // Require more specific phrases that clearly indicate project creation intent
    content.includes("track this project") ||
    content.includes("track the project") ||
    content.includes("create a project") ||
    content.includes("start a project") ||
    content.includes("make a project") ||
    content.includes("begin a project") ||
    content.includes("new project called") ||
    content.includes("create project called") ||
    content.includes("track project called") ||
    // Also check for phrases with colons that often indicate project creation
    (content.includes("project:") && content.length < 100) ||
    (content.includes("project name:") && content.length < 100)
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

    // Default case - return current live project if it exists, otherwise return null
    // We no longer automatically create projects in the default case
    if (liveProject) {
      return liveProject.id;
    } else {
      // Don't create a default project - only create projects when explicitly requested
      return null;
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
      : await triageMessageIntent(messages, projects);
    // Based on the triage result, choose the appropriate workflow

    // Get the chat ID for project operations
    let chatId = null;
    let adapter = null;
    if (
      !isOnboardingTrigger &&
      ["projectFlow", "createProject", "updateProject", "completeProject", "referenceProject", "updateProjectAttributes"].includes(triage.responseType)
    ) {
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

      case "projectFlow":
        // Handle all project-related intents in a single flow
        const projectAction = (triage as any).projectAction || "create";
        let projectResult = null;
        let projectMessage = "";
        let targetProject = null;

        // Get project name and description
        const projectName = (triage as any).projectName || "";
        const projectDescription = (triage as any).projectDescription || "";
        
        // Don't allow project creation with generic names
        if (projectAction === "create" && (!projectName || projectName === "New Project")) {
          // If no specific project name was provided, don't create a project
          return {
            type: "default",
            success: true,
            message: await DefaultReplyToMessage(
              messages,
              thread_type as "individual" | "group",
              thread_id,
              sender_number,
              service,
              participants,
              projects
            ),
          };
        }
        
        if (adapter && chatId) {
          // Get existing projects to check if we're referencing one
          const existingProjects = await adapter.getProjectsByChat(chatId);
          
          console.log(`[PROJECT DEBUG] Looking for target project. Action: ${projectAction}, Name: "${projectName}", Existing projects:`, 
            existingProjects.map(p => ({ id: p.id, name: p.name, is_live: p.is_live })));
            
          // Find the target project - either specified by name, or use the live project
          if (projectName && projectName !== "New Project") {
            // Try to find the project by name first - do an exact match
            targetProject = existingProjects.find(
              (p) => p.name.toLowerCase() === projectName.toLowerCase()
            );
            
            console.log(`[PROJECT DEBUG] Exact name match result:`, targetProject ? 
              { id: targetProject.id, name: targetProject.name, is_live: targetProject.is_live } : "No exact match");
              
            // If no exact match, try a fuzzy match for project completion
            if (!targetProject && projectAction === "complete") {
              console.log(`[PROJECT DEBUG] Attempting fuzzy match for project completion`);
              
              // For completion, check if the project name is contained within any existing project names
              targetProject = existingProjects.find(p => 
                p.name.toLowerCase().includes(projectName.toLowerCase()) || 
                projectName.toLowerCase().includes(p.name.toLowerCase())
              );
              
              console.log(`[PROJECT DEBUG] Fuzzy match result:`, targetProject ? 
                { id: targetProject.id, name: targetProject.name, is_live: targetProject.is_live } : "No fuzzy match");
            }
          }
          
          // If no project found by name and not creating a new one, use the live project
          if (!targetProject && projectAction !== "create") {
            targetProject = existingProjects.find((p) => p.is_live === true);
            console.log(`[PROJECT DEBUG] Falling back to live project:`, targetProject ? 
              { id: targetProject.id, name: targetProject.name, is_live: targetProject.is_live } : "No live project found");
          }

          // Process according to the project action
          switch(projectAction) {
            case "create":
              try {
                // Mark any existing live projects as complete first
                const liveProject = existingProjects.find(
                  (p) => p.is_live === true
                );

                if (liveProject) {
                  await adapter.updateProject(liveProject.id, { is_live: false });
                  await adapter.logProjectEvent(
                    liveProject.id,
                    "project_completed",
                    "Project completed due to new project creation"
                  );
                }

                // All attributes outside of name and description go into the attributes object
                const projectAttributes = (triage as any).attributes || {};

                // Create the new project
                projectResult = await adapter.createProject(
                  projectName,
                  projectDescription,
                  chatId,
                  projectAttributes
                );

                if (projectResult) {
                  // Log the creation event
                  await adapter.logProjectEvent(
                    projectResult,
                    "project_created",
                    `Project created with name: ${projectName}`
                  );

                  projectMessage = `Created new project: ${projectName}`;
                }
              } catch (error) {
                console.error("Error creating project:", error);
                projectMessage = "Failed to create project";
              }
              break;
              
            case "update":
              if (targetProject) {
                try {
                  // Get updates - could be main project details or attributes
                  const basicUpdates = (triage as any).updates || {};
                  const attributeUpdates = (triage as any).attributeUpdates || {};
                  const replaceAttributes = (triage as any).replaceAttributes === true;
                  const updateData = { ...basicUpdates };
                  let attrUpdateResult = true;
                  
                  // Apply the basic updates first
                  if (Object.keys(basicUpdates).length > 0) {
                    projectResult = await adapter.updateProject(
                      targetProject.id,
                      updateData
                    );
                    
                    if (projectResult) {
                      await adapter.logProjectEvent(
                        targetProject.id,
                        "project_updated",
                        `Project updated: ${JSON.stringify(basicUpdates)}`
                      );
                    }
                  }
                  
                  // Then apply attribute updates if present
                  if (Object.keys(attributeUpdates).length > 0) {
                    attrUpdateResult = await adapter.updateProjectAttributes(
                      targetProject.id,
                      attributeUpdates,
                      replaceAttributes
                    );
                    
                    if (attrUpdateResult) {
                      await adapter.logProjectEvent(
                        targetProject.id,
                        "project_attributes_updated",
                        `Project attributes updated: ${JSON.stringify(attributeUpdates)}`
                      );
                    }
                  }
                  
                  // Update is successful if either basic or attribute updates succeeded
                  projectResult = projectResult || attrUpdateResult;
                  projectMessage = `Updated project: ${targetProject.name}`;
                } catch (error) {
                  console.error("Error updating project:", error);
                  projectMessage = "Failed to update project";
                }
              } else {
                projectMessage = "No matching project found to update";
              }
              break;
              
            case "complete":
              console.log("[PROJECT DEBUG] Attempting to complete project:", { 
                projectName, 
                targetProjectId: targetProject?.id,
                targetProjectName: targetProject?.name,
                targetProjectIsLive: targetProject?.is_live
              });
              
              if (targetProject) {
                try {
                  console.log(`[PROJECT DEBUG] Found target project to complete: ${targetProject.name} (ID: ${targetProject.id})`);
                  
                  // Mark the project as complete
                  projectResult = await adapter.updateProject(
                    targetProject.id,
                    { is_live: false }
                  );
                  
                  console.log(`[PROJECT DEBUG] Project update result:`, projectResult);

                  if (projectResult) {
                    // Log the completion event
                    await adapter.logProjectEvent(
                      targetProject.id,
                      "project_completed",
                      `Project marked as complete`
                    );
                    
                    console.log(`[PROJECT DEBUG] Project completion event logged for: ${targetProject.name}`);
                    projectMessage = `Completed project: ${targetProject.name}`;
                  } else {
                    console.log(`[PROJECT DEBUG] Failed to update project is_live status to false`);
                  }
                } catch (error) {
                  console.error("[PROJECT DEBUG] Error completing project:", error);
                  projectMessage = "Failed to complete project";
                }
              } else {
                console.log(`[PROJECT DEBUG] No target project found to complete with name: ${projectName}`);
                projectMessage = "No active project found to complete";
              }
              break;
              
            case "reference":
              // Special case for listing all projects (when no specific project is referenced)
              if (!projectName || projectName.trim() === "") {
                console.log("[PROJECT DEBUG] Handling request to list all projects with status");
                
                // This is likely a request to list all projects with their status
                if (existingProjects && existingProjects.length > 0) {
                  const activeProjects = existingProjects.filter(p => p.is_live === true);
                  const completedProjects = existingProjects.filter(p => p.is_live === false);
                  
                  projectResult = true; // Mark as successful
                  projectMessage = `Found ${activeProjects.length} active and ${completedProjects.length} completed projects`;
                  
                  // Store project lists for the context message
                  const projectContext = {
                    activeProjects: activeProjects.map(p => ({ name: p.name, id: p.id })),
                    completedProjects: completedProjects.map(p => ({ name: p.name, id: p.id }))
                  };
                  
                  // Set a special attribute to indicate this is a project listing request
                  (triage as any).projectListing = projectContext;
                } else {
                  projectMessage = "No projects found";
                }
              } 
              // Regular reference to a specific project
              else if (targetProject) {
                projectResult = targetProject.id;
                projectMessage = `Referenced project: ${targetProject.name}`;
              } else {
                projectMessage = "Could not find the referenced project";
              }
              break;
          }
        } else {
          projectMessage = "Unable to perform project operation - chat not found";
        }

        // Create context message about what was done
        let projectContext = "";
        
        // Special handling for project listing requests
        if (projectAction === "reference" && (triage as any).projectListing) {
          const activeProjects = (triage as any).projectListing.activeProjects || [];
          const completedProjects = (triage as any).projectListing.completedProjects || [];
          
          // Create a formatted list of projects with their status
          let projectListContext = "Here's a list of all projects with their status:\n\n";
          
          if (activeProjects.length > 0) {
            projectListContext += "Active projects:\n";
            activeProjects.forEach((p: { name: string; id: string }) => {
              projectListContext += `- ${p.name}\n`;
            });
            projectListContext += "\n";
          }
          
          if (completedProjects.length > 0) {
            projectListContext += "Completed projects:\n";
            completedProjects.forEach((p: { name: string; id: string }) => {
              projectListContext += `- ${p.name}\n`;
            });
          }
          
          projectContext = projectListContext.trim();
        } 
        // Standard project action context
        else {
          let actionVerb = "updated";
          switch(projectAction) {
            case "create": actionVerb = "created"; break;
            case "update": actionVerb = "updated"; break;
            case "complete": actionVerb = "completed"; break;
            case "reference": actionVerb = "referenced"; break;
          }
          
          projectContext = `Project "${projectName}" was just ${actionVerb}. ${projectMessage}`.trim();
        }

        // Add a system message to inform the AI about the project action
        const projectMessagesWithContext = [
          ...messages,
          {
            content: projectContext,
            sender_number: process.env.A1BASE_AGENT_NUMBER || "",
            sender_name: "AI Assistant",
            thread_id,
            thread_type,
            timestamp: new Date().toISOString(),
            message_id: `system-ctx-${Date.now()}`,
            message_type: "text" as ThreadMessage["message_type"],
            message_content: { text: projectContext },
            role: "assistant",
          } as ThreadMessage,
        ];

        // Generate a response
        const projectResponse = await DefaultReplyToMessage(
          projectMessagesWithContext,
          thread_type as "individual" | "group",
          thread_id,
          sender_number,
          service,
          participants,
          projects
        );

        // Create the response data object with the appropriate fields
        const projectData: any = {
          projectAction,
          projectName,
        };
        
        // Add action-specific fields
        if (projectAction === "create") {
          projectData.projectDescription = projectDescription;
          projectData.projectId = projectResult || undefined;
          projectData.attributes = (triage as any).attributes;
        } else if (projectAction === "update") {
          projectData.updates = (triage as any).updates;
          projectData.attributeUpdates = (triage as any).attributeUpdates;
          projectData.replaceAttributes = (triage as any).replaceAttributes === true;
        } else if (projectAction === "reference") {
          // Check if this is a project listing request
          if ((triage as any).projectListing) {
            projectData.isProjectListing = true;
            projectData.activeProjects = (triage as any).projectListing.activeProjects;
            projectData.completedProjects = (triage as any).projectListing.completedProjects;
          } else {
            // Regular project reference
            projectData.projectId = projectResult || undefined;
          }
        }

        return {
          type: "project",
          success: projectResult !== null,
          message: projectResponse,
          data: projectData,
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
