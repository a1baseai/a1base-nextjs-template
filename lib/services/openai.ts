import { ThreadMessage } from "@/types/chat";
import OpenAI from "openai";
import { getSystemPrompt } from "../agent/system-prompt";
import { generateRichChatContext } from "./chat-context";
import {
  isSupabaseConfigured,
  getInitializedAdapter,
} from "../supabase/config";
import { SupabaseAdapter } from "../supabase/adapter";

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
 * ============= OPENAI CALL TO TRIAGE THE MESSAGE INTENT ================
 * This function returns one of the following responseTypes:
 *  - simpleResponse: Provide a simple response
 *  - followUpResponse: Follow up on the message to gather additional information
 *  - handleEmailAction: Draft email and await user approval for sending (DISABLED)
 *  - taskActionConfirmation: Confirm with user before proceeding with requested task (i.e before sending an email)
 * =======================================================================
 */
export async function triageMessageIntent(
  threadMessages: ThreadMessage[]
): Promise<{
  responseType:
    | "simpleResponse"
    // | "handleEmailAction" (DISABLED)
    | "onboardingFlow";
}> {
  // Convert thread messages to OpenAI chat format
  const conversationContext = threadMessages.map((msg) => ({
    role:
      msg.sender_number === process.env.A1BASE_AGENT_NUMBER!
        ? ("assistant" as const)
        : ("user" as const),
    content: msg.content,
  }));

  // Heuristic check: if the latest message clearly contains an email address, return early
  const latestMessage =
    threadMessages[threadMessages.length - 1]?.content.toLowerCase() || "";

  const triagePrompt = `
Based on the conversation, analyze the user's intent and respond with exactly one of these JSON responses:
{"responseType":"simpleResponse"}
// {"responseType":"handleEmailAction"} (DISABLED)

Rules:
// - If the user is asking to create, draft, or send an email, select "handleEmailAction" (DISABLED)
- Select "simpleResponse" for all user messages

Return valid JSON with only that single key "responseType" and value as one of the allowed strings.
`;

  // Use a faster model for triage to reduce latency
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: triagePrompt },
      ...conversationContext,
    ],
  });

  const content = completion.choices[0]?.message?.content || "";
  // console.log removed
  // Parse response and validate response type
  try {
    const parsed = JSON.parse(content);
    const validTypes = [
      "simpleResponse",
      // "handleEmailAction", (DISABLED)
    ];

    if (validTypes.includes(parsed.responseType)) {
      return { responseType: parsed.responseType };
    }

    return { responseType: "simpleResponse" };
  } catch {
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
          onboardingData = await supabaseAdapter.getChatOnboardingData(
            threadMessages[0].thread_id,
            service
          );
        } else if (threadType === "individual") {
          const userPhoneNumber = threadMessages.find(
            (msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER
          )?.sender_number;
          if (userPhoneNumber) {
            // console.log(`[generateAgentResponse] Fetching individual onboarding data for user: ${userPhoneNumber}`);
            onboardingData = await supabaseAdapter.getUserOnboardingData(
              userPhoneNumber
            );
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

  // If a specific user prompt is provided, add it as a plain string content message
  if (userPrompt) {
    conversationForOpenAI.push({ role: "user" as const, content: userPrompt });
  }

  // Format existing thread messages for OpenAI
  const formattedOpenAIMessages = threadMessages.map((msg) => {
    let messageCoreContent = msg.content; // This is the raw message content
    // Append sender's name to content if it's a group chat and sender is not the agent
    // This name will also be part of the 'actual_content' in the JSON
    if (
      threadType === "group" &&
      msg.sender_number !== process.env.A1BASE_AGENT_NUMBER
    ) {
      messageCoreContent = `${msg.sender_name} said: ${messageCoreContent}`;
    }

    const structuredContent = {
      message: messageCoreContent, // Ensure NO `(Sent at...)` string here
      userName: msg.sender_name,
      userId: msg.sender_number, // Using phone number as userId for context
      sent_at: msg.timestamp,
    };

    return {
      role:
        msg.sender_number === process.env.A1BASE_AGENT_NUMBER
          ? ("assistant" as const)
          : ("user" as const),
      content: JSON.stringify(structuredContent), // Content is now a stringified JSON object
    };
  });

  conversationForOpenAI.push(...formattedOpenAIMessages);

  console.log(
    "generateAgentResponse prompt messages (sent to OpenAI):",
    JSON.stringify(conversationForOpenAI, null, 2)
  );
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4",
    messages: conversationForOpenAI,
  });

  return (
    completion.choices[0]?.message?.content ||
    "Sorry, I couldn't generate a response"
  );
}
