import { ThreadMessage } from "@/types/chat";
import OpenAI from "openai";
import { getSystemPrompt } from "../agent/system-prompt";
import { generateRichChatContext } from "./chat-context";

// Don't initialize during build time
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

// Create a lazy-loaded OpenAI client that will only be initialized at runtime
let openai: OpenAI;
export const getOpenAI = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API error: No API key provided');
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
 * Generate a response from the AI agent
 */
export async function generateAgentResponse(
  threadMessages: ThreadMessage[],
  userPrompt?: string,
  threadType: string = 'individual',
  participants: any[] = [],
  projects: any[] = []
): Promise<string> {
  // Try to extract the user's name from the latest message
  const userName = threadMessages.find(
    (msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER
    )?.sender_name;

  if (!userName) {
    return "Hey there!";
  }

  // Get the system prompt with custom settings
  const systemPromptContent = await getSystemPrompt();
  
  // Generate rich context about the chat (participants, projects, etc.)
  const richContext = generateRichChatContext(
    threadType,
    threadMessages,
    participants,
    projects
  );
  
  // Combine the base system prompt with the rich context
  const enhancedSystemPrompt = systemPromptContent + richContext;
  
  // Build the conversation to pass to OpenAI
  const conversation = [
    { role: "system" as ChatRole, content: enhancedSystemPrompt },
  ];

  // If there's a user-level prompt from basicWorkflowsPrompt, add it as a user message
  if (userPrompt) {
    conversation.push({ role: "user" as ChatRole, content: userPrompt });
  }

  // Then add the actual chat messages with sender names for better context
  // Format messages with sender names for better context in group chats
  const formattedMessages = threadMessages.map((msg: ThreadMessage) => {
    // For messages from the agent, just pass through
    if (msg.sender_number === process.env.A1BASE_AGENT_NUMBER) {
      return {
        role: "assistant" as ChatRole,
        content: msg.content
      };
    }
    
    // For user messages, include the sender's name in group chats
    // Using a format that doesn't influence the AI to mimic it in responses
    let content = msg.content;
    if (threadType === 'group' && msg.sender_name) {
      content = `${msg.sender_name} said: ${content}`;
    }
    
    return {
      role: "user" as ChatRole,
      content: content
    };
  });
  
  conversation.push(...formattedMessages);

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4",
    messages: conversation as OpenAI.Chat.ChatCompletionMessageParam[],
  });

  return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response";
}
