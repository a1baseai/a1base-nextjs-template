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
      role: isAssistant ? "assistant" : "user",
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

  console.log("OpenaAI completion happening at triageMessageIntent");
  // Use a faster model for triage to reduce latency
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4.1",
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

  // The userPrompt is now added to the system prompt instead of as a separate message

  // Format existing thread messages for OpenAI using our unified function
  const formattedOpenAIMessages = formatMessagesForOpenAI(
    threadMessages,
    threadType
  );

  conversationForOpenAI.push(...formattedOpenAIMessages);

  console.log("OpenAI completion happening at generateAgentResponse function");
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4.1",
    messages: conversationForOpenAI,
  });

  return (
    completion.choices[0]?.message?.content ||
    "Sorry, I couldn't generate a response"
  );
}
