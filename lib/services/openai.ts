import { ThreadMessage } from "@/types/chat";
import OpenAI from "openai";
import { getSystemPrompt } from "../agent/system-prompt";

// Don't initialize during build time
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// Create a lazy-loaded OpenAI client that will only be initialized at runtime
let openai: OpenAI;
const getOpenAI = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Warning: OPENAI_API_KEY is not set. Using dummy API key for build.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build-time',
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
    | "onboardingFlow"
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
  console.log(content);
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
 * Generate an introduction message for the AI agent when first joining a conversation.
 * Uses the agent profile settings to craft a contextual introduction.
 */
export async function generateAgentIntroduction(
  incomingMessage: string,
  userName?: string
): Promise<string> {
  if (!userName) {
    return "Hey there!";
  }

  // Get the system prompt with custom settings
  const systemPromptContent = await getSystemPrompt();
  
  const conversation = [
    {
      role: "system" as const,
      content: systemPromptContent,
    },
    {
      role: "user" as const,
      content: incomingMessage,
    },
  ];

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4",
    messages: conversation,
  });

  return completion.choices[0]?.message?.content || "Hello!";
}

/**
 * Generate a response to a WhatsApp thread of messages.
 * If userPrompt is provided, it will be passed as a user-level instruction in addition to the system prompt.
 */
export async function generateAgentResponse(
  threadMessages: ThreadMessage[],
  userPrompt?: string
): Promise<string> {
  const messages = threadMessages.map((msg) => ({
    role: (msg.sender_number === process.env.A1BASE_AGENT_NUMBER!
      ? "assistant"
      : "user") as ChatRole,
    content: msg.content,
  }));

  // Extract the latest user's name (not the agent)
  const userName = [...threadMessages]
    .reverse()
    .find(
      (msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER!
    )?.sender_name;

  if (!userName) {
    return "Hey there!";
  }

  // Get the system prompt with custom settings
  const systemPromptContent = await getSystemPrompt();
  
  // Build the conversation to pass to OpenAI
  const conversation = [
    { role: "system" as ChatRole, content: systemPromptContent },
  ];

  // If there's a user-level prompt from basicWorkflowsPrompt, add it as a user message
  if (userPrompt) {
    conversation.push({ role: "user" as ChatRole, content: userPrompt });
  }

  // Then add the actual chat messages
  conversation.push(...messages);

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4",
    messages: conversation as OpenAI.Chat.ChatCompletionMessageParam[],
  });

  return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response";
}
