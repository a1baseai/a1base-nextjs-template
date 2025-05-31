import { ThreadMessage } from "@/types/chat";
import OpenAI from "openai";
import { getSystemPrompt } from "../agent/system-prompt";
import { generateRichChatContext } from "./chat-context";
import {
  isSupabaseConfigured,
  getInitializedAdapter,
} from "../supabase/config";
import { SupabaseAdapter } from "../supabase/adapter";

/**
 * Normalizes a phone number by removing '+' and spaces.
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\+|\s/g, "");
}

// Don't initialize during build time
const isBuildTime =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE === "phase-production-build";

// Create a lazy-loaded OpenAI client that will only be initialized at runtime
let openai: OpenAI;
export const getOpenAI = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API error: No API key provided");
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-build-time",
    });
  }
  return openai;
};

// Add type for OpenAI chat roles
type ChatRole = "system" | "user" | "assistant" | "function";

/**
 * Formats messages for OpenAI API with support for both individual and group chats.
 * Uses phone number normalization for better matching.
 * Works with both ThreadMessage and MessageRecord types.
 *
 * @param messages - Array of message objects with required properties
 * @param threadType - Type of thread ('individual' or 'group')
 * @returns Array of formatted messages for OpenAI API
 */
export function formatMessagesForOpenAI<
  T extends {
    content: string;
    sender_number: string;
    sender_name?: string;
    timestamp?: string;
    message_type?: any; // Make message_type optional and accept any type
  }
>(
  messages: T[],
  threadType: string = "individual"
): { role: "user" | "assistant"; content: string }[] {
  const normalizedAgentNumber = normalizePhoneNumber(
    process.env.A1BASE_AGENT_NUMBER || ""
  );

  const formattedMessages = messages.map((msg) => {
    const normalizedSenderNumber = normalizePhoneNumber(msg.sender_number);
    const isAssistant = normalizedSenderNumber === normalizedAgentNumber;

    let messageCoreContent = msg.content;

    // Append sender's name to content if it's a group chat and sender is not the agent
    // Only if sender_name is available
    if (threadType === "group" && !isAssistant && msg.sender_name) {
      messageCoreContent = `${msg.sender_name} said: ${messageCoreContent}`;
    }

    // Create structured content with metadata
    const structuredContent: any = {
      message: messageCoreContent,
    };

    // Add optional fields if they exist
    if (msg.sender_name) structuredContent.userName = msg.sender_name;
    if (msg.sender_number) structuredContent.userId = msg.sender_number;
    if (msg.timestamp) structuredContent.sent_at = msg.timestamp;

    return {
      role: isAssistant ? "assistant" as const : "user" as const,
      // content: JSON.stringify(structuredContent),
      content: messageCoreContent,
    };
  });

  return formattedMessages;
}

/**
 * ============= OPENAI CALL TO TRIAGE THE MESSAGE INTENT ================
 * This function returns one of the following responseTypes:
 *  - simpleResponse: Provide a simple response
 *  - onboardingFlow: Handle onboarding flow
 *  - projectFlow: Handle all project-related actions
 *  - noReply: No reply needed
 * =======================================================================
 */
export async function triageMessageIntent(
  threadMessages: ThreadMessage[],
  projects: any[] = []
): Promise<{
  responseType: "simpleResponse" | "onboardingFlow" | "projectFlow" | "noReply";
  projectAction?: "create" | "update" | "complete" | "reference";
  projectName?: string;
  projectDescription?: string;
  updates?: Record<string, any>;
  attributes?: Record<string, any>;
  attributeUpdates?: Record<string, any>;
  replaceAttributes?: boolean;
}> {
  // Convert thread messages to OpenAI chat format
  const conversationContext = threadMessages.map((message) => {
    return {
      role: (message.role || (message.sender_number === process.env.A1BASE_AGENT_NUMBER ? "assistant" : "user")) as "assistant" | "user",
      content: message.content + (message.timestamp ? ` [${message.timestamp}]` : ""),
    };
  });

  // Heuristic check: if the latest message clearly contains an email address, return early
  const latestMessage =
    threadMessages[threadMessages.length - 1]?.content.toLowerCase() || "";
    
  // Extract existing project names to provide context
  const existingProjects = projects.map(p => ({
    name: p.name,
    description: p.description,
    is_live: p.is_live,
    id: p.id
  }));
  
  const existingProjectsContext = existingProjects.length > 0 
    ? `\nExisting projects in this chat:\n${JSON.stringify(existingProjects, null, 2)}\n` 
    : "\nNo existing projects in this chat.\n";

  const triagePrompt = `
Based on the conversation and the context of the recent messages, analyze the user's intent and respond with a JSON object:
- "responseType": one of ["simpleResponse", "projectFlow", "noReply", "onboardingFlow"]
- Additional fields based on intent.

Rules:
- "projectFlow": Used for ALL project-related actions. Use this for any message related to creating, updating, completing, or referencing projects.
- "onboardingFlow": Related to user onboarding.
- "simpleResponse": Default for all other messages including greetings, questions, statements, or any message from a human user that could benefit from a response.

For "projectFlow" responses, include these additional fields:
- "projectAction": one of ["create", "update", "complete", "reference"]
- "projectName": Name of the project (required for "create", optional for others if context makes it clear)
- "projectDescription": Description of the project (for "create")

Additional context-specific fields:
- For "create": include "attributes" (a JSON object with all project properties beyond name and description)
- For "update": if updating basic info, include "updates" (e.g., {"description": "new desc"})
- For updating properties: include "attributeUpdates" (e.g., {"status": "in progress", "priority": "high"}), "replaceAttributes" (boolean, default false)

${existingProjectsContext}

IMPORTANT DATABASE CONTEXT: In the projects table, the field "is_live" indicates project status:
- is_live=true means the project is ACTIVE and ongoing
- is_live=false means the project is COMPLETED

When a user says they've "completed" or "finished" a project, you should set projectAction to "complete" which will update is_live to false.

CRITICAL INSTRUCTION: When analyzing the message, ALWAYS check if it refers to an existing project by comparing project names. If there's ANY similarity between the mentioned project name and an existing project (especially if the project is marked as is_live=true), you MUST set projectAction to "update" rather than "create". Even if the user says "track a project" or uses creation language, if the project name is similar to an existing one, interpret it as an update request.

For attributes, you can create or modify any data structure that seems appropriate, using nested objects if needed.
Examples: 
- {"status": "in_progress", "priority": "high"}
- {"members": ["John", "Mary"], "tasks": [{"title": "Research", "status": "done"}, {"title": "Implementation", "status": "pending"}]}

Return valid JSON.
`;

  console.log("OpenaAI completion happening at triageMessageIntent");
  // Use a faster model for triage to reduce latency
  // Explicitly type the messages array for OpenAI
  type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };
  const messages: OpenAIMessage[] = [
    { role: "system", content: triagePrompt },
    ...conversationContext as OpenAIMessage[],
  ];
  
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4.1",
    messages,
  });

  const content = completion.choices[0]?.message?.content || "";
  // console.log removed
  // Parse response and validate response type
  try {
    const parsed = JSON.parse(content);
    const validTypes = [
      "simpleResponse", 
      "onboardingFlow",
      "projectFlow",
      "noReply",
    ];

    console.log("[TRIAGE DEBUG] Raw triage result:", parsed);
    console.log("[TRIAGE DEBUG] Existing projects context provided:", existingProjects.map(p => ({ name: p.name, is_live: p.is_live })));

    if (validTypes.includes(parsed.responseType)) {
      // Special handling for project flow
      if (parsed.responseType === "projectFlow") {
        // Create the consolidated project flow response
        const projectFlowResponse = {
          responseType: "projectFlow" as const,
          projectAction: parsed.projectAction as "create" | "update" | "complete" | "reference" | undefined,
          projectName: parsed.projectName,
          projectDescription: parsed.projectDescription,
          updates: parsed.updates,
          attributes: parsed.attributes,
          attributeUpdates: parsed.attributeUpdates,
          replaceAttributes: parsed.replaceAttributes === true
        };
        
        console.log("[TRIAGE DEBUG] Final project flow response:", projectFlowResponse);
        return projectFlowResponse;
      } else {
        // For non-project flows, just return the response type
        console.log("[TRIAGE DEBUG] Non-project response type:", parsed.responseType);
        return { responseType: parsed.responseType };
      }
    }

    return { responseType: "simpleResponse" };
  } catch (error) {
    console.error("Error parsing triage response:", error);
    // Default to simple response if parsing fails
    return { responseType: "simpleResponse" };
  }
}

/**
 * Generate an introduction from the AI agent
 */
export async function generateAgentIntroduction(
  userPrompt?: string, // This is more like a system instruction for introduction
  threadType: string = "individual",
  participants: any[] = [],
  projects: any[] = []
): Promise<string> {
  const systemPromptContent = await getSystemPrompt();
  const richContext = generateRichChatContext(
    threadType,
    [], // No messages for a fresh introduction context
    participants,
    projects
  );
  const introSystemMessageWithContext = systemPromptContent + richContext;

  // console.log(
  //   "generateAgentIntroduction prompt messages (sent to OpenAI):",
  //   JSON.stringify(
  //     [
  //       { role: "system", content: introSystemMessageWithContext },
  //       { role: "user", content: userPrompt || "Introduce yourself." }, // User prompt for intro
  //     ],
  //     null,
  //     2
  //   )
  // );

  // Call generateAgentResponse with an empty message list and the constructed prompt
  // The userPrompt for generateAgentIntroduction acts as the 'userPrompt' for generateAgentResponse in this specific context
  return generateAgentResponse(
    [], // No prior messages for introduction
    userPrompt || "Introduce yourself briefly and state your purpose.", // This acts as the userPrompt for the system's intro
    threadType,
    participants,
    projects,
    undefined // service - not typically available/relevant for a fresh intro
  );
}

/**
 * Generate a response from the AI agent
 */
export async function generateAgentResponse(
  threadMessages: ThreadMessage[],
  userPrompt?: string,
  threadType: string = "individual",
  participants: any[] = [],
  projects: any[] = [],
  service?: string // Added service parameter
): Promise<string> {
  // Try to extract the user's name from the latest message
  const userName = threadMessages.find(
    (msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER
  )?.sender_name;

  if (!userName && threadMessages.length > 0) {
    // Check threadMessages.length to ensure it's not an intro call with no user
    // This case might occur if the first message is from the agent, or if sender_name is missing
    // For now, let's have a generic fallback if we can't find a user name in a populated thread
    // console.warn("[generateAgentResponse] Could not determine userName from threadMessages.");
    // Depending on desired behavior, could return a generic greeting or error
  }
  // If threadMessages is empty (like in an intro), userName will be undefined, which is handled by the intro prompt itself.

  // Get the system prompt with custom settings
  const systemPromptContent = await getSystemPrompt();
  const richContext = generateRichChatContext(
    threadType,
    threadMessages,
    participants,
    projects
  );
  // Combine the base system prompt with the rich context
  let enhancedSystemPrompt = systemPromptContent + richContext;

  // If a specific user prompt is provided, add it to the system prompt
  if (userPrompt) {
    enhancedSystemPrompt += `\n\n--- User Specific Instructions ---\n${userPrompt}\n--- End User Specific Instructions ---`;
  }

  // --- BEGIN MODIFICATION: Fetch and add Supabase onboarding data ---
  if (isSupabaseConfigured()) {
    const supabaseAdapter = getInitializedAdapter();
    if (supabaseAdapter) {
      let onboardingData: Record<string, any> | null = null;
      try {
        if (
          threadType === "group" &&
          service &&
          threadMessages.length > 0 &&
          threadMessages[0].thread_id
        ) {
          // console.log(`[generateAgentResponse] Fetching group onboarding data for thread_id: ${threadMessages[0].thread_id}, service: ${service}`);
          const adapter = await supabaseAdapter;
          if (adapter) {
            onboardingData = await adapter.getChatOnboardingData(
              threadMessages[0].thread_id,
              service
            );
          }
        } else if (threadType === "individual") {
          const userPhoneNumber = threadMessages.find(
            (msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER
          )?.sender_number;
          if (userPhoneNumber) {
            // console.log(`[generateAgentResponse] Fetching individual onboarding data for user: ${userPhoneNumber}`);
            const adapter = await supabaseAdapter;
            if (adapter) {
              onboardingData = await adapter.getUserOnboardingData(
                userPhoneNumber
              );
            }
          }
        }

        if (onboardingData && Object.keys(onboardingData).length > 0) {
          // console.log("[generateAgentResponse] Successfully fetched onboarding data:", onboardingData);
          const onboardingContext = `\n\n--- Onboarding Data Context ---\n${JSON.stringify(
            onboardingData,
            null,
            2
          )}\n--- End Onboarding Data Context ---`;
          enhancedSystemPrompt += onboardingContext;
        } else {
          // console.log("[generateAgentResponse] No onboarding data found or data is empty.");
        }
        
        // Fetch and add projects related to this chat
        try {
          if (threadMessages.length > 0 && threadMessages[0].thread_id) {
            const threadId = threadMessages[0].thread_id;
            // Use the correct adapter method name
            const adapter = await supabaseAdapter;
            const projects = adapter ? await adapter.getProjectsByChat(threadId) : [];
            
            if (projects && projects.length > 0) {
              // console.log(`[generateAgentResponse] Successfully fetched ${projects.length} projects for chat: ${threadId}`);
              const activeProjects = projects.filter((p: any) => p.is_live === true);
              const completedProjects = projects.filter((p: any) => p.is_live === false);
              
              const projectsContext = `\n\n--- Projects Context ---\n${
                activeProjects.length > 0 ? 
                `Active Projects:\n${activeProjects.map((p: any) => 
                  `- "${p.name}" (ID: ${p.id})\n  Description: ${p.description}\n  Created: ${new Date(p.created_at).toISOString()}\n  Attributes: ${JSON.stringify(p.attributes || {}, null, 2)}`
                ).join('\n\n')}` : 'No active projects.'
              }\n\n${
                completedProjects.length > 0 ? 
                `Completed Projects:\n${completedProjects.map((p: any) => 
                  `- "${p.name}" (ID: ${p.id})\n  Description: ${p.description}\n  Completed: ${p.updated_at ? new Date(p.updated_at).toISOString() : 'unknown'}\n  Attributes: ${JSON.stringify(p.attributes || {}, null, 2)}`
                ).join('\n\n')}` : 'No completed projects.'
              }\n--- End Projects Context ---`;
              
              enhancedSystemPrompt += projectsContext;
            } else {
              // console.log(`[generateAgentResponse] No projects found for chat: ${threadId}`);
            }
          }
        } catch (error) {
          // console.error("[generateAgentResponse] Error fetching projects data:", error);
          // Proceed without projects data if an error occurs
        }
      } catch (error) {
        // console.error("[generateAgentResponse] Error fetching onboarding data from Supabase:", error);
        // Proceed without onboarding data if an error occurs
      }
    } else {
      // console.warn("[generateAgentResponse] Supabase is configured, but adapter is not initialized.");
    }
  } else {
    // console.log("[generateAgentResponse] Supabase not configured. Skipping onboarding data fetch.");
  }
  // --- END MODIFICATION ---

  const conversationForOpenAI: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  conversationForOpenAI.push({
    role: "system" as const,
    content: enhancedSystemPrompt, // System prompt content is a plain string
  });

  // The userPrompt is now added to the system prompt instead of as a separate message

  // Format existing thread messages for OpenAI using our unified function
  const formattedOpenAIMessages = formatMessagesForOpenAI(
    threadMessages,
    threadType
  );

  conversationForOpenAI.push(...formattedOpenAIMessages);

  console.log("OpenAI completion happening at generateAgentResponse function");

  console.log("conversationForOpenAI", conversationForOpenAI);

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4.1",
    messages: conversationForOpenAI,
  });

  console.log("conversationForOpenAI completion", completion);

  return (
    completion.choices[0]?.message?.content ||
    "Sorry, I couldn't generate a response"
  );
}
