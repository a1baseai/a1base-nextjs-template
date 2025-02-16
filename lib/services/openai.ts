import { ThreadMessage } from '@/types/chat'
import OpenAI from 'openai'
import { getSystemPrompt } from '../agent/system-prompt'
import { basicWorkflowsPrompt } from '../workflows/basic_workflows_prompt'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Add type for OpenAI chat roles
type ChatRole = "system" | "user" | "assistant" | "function"

/**
 * ============= OPENAI CALL TO TRIAGE THE MESSAGE INTENT ================
 * This function returns one of the following responseTypes:
 *  - simpleResponse: Provide a simple response
 *  - followUpResponse: Follow up on the message to gather additional information
 *  - handleEmailAction: Draft email and await user approval for sending
 *  - taskActionConfirmation: Confirm with user before proceeding with requested task (i.e before sending an email)
 * =======================================================================
 */
export async function triageMessageIntent(threadMessages: ThreadMessage[]): Promise<{ 
  responseType: 
  "sendIdentityCard"|
  "simpleResponse" |
  "followUpResponse" | 
  "handleEmailAction" | 
  "taskActionConfirmation"
}> {
  // Convert thread messages to OpenAI chat format
  const conversationContext = threadMessages.map((msg) => ({
    role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER! ? "assistant" as const : "user" as const,
    content: msg.content,
  }));

  // Heuristic check: if the latest message clearly asks for identity or contains an email address, return early
  const latestMessage = threadMessages[threadMessages.length - 1]?.content.toLowerCase() || '';
  if (latestMessage.includes("who are you") || latestMessage.includes("what are you")) {
    return { responseType: "sendIdentityCard" };
  }
  if (/\b[\w.-]+@[\w.-]+\.\w+\b/.test(latestMessage)) {
    return { responseType: "handleEmailAction" };
  }

  const triagePrompt = `
Based on the conversation, analyze the user's intent and respond with exactly one of these JSON responses:
{"responseType":"sendIdentityCard"}
{"responseType":"simpleResponse"}
// {"responseType":"followUpResponse"}
{"responseType":"handleEmailAction"} 
{"responseType":"taskActionConfirmation"}

Rules:
- If the user specifically requests an email to be written or sent, or includes an email address, select "handleEmailAction"
// - If the user asks a question, or requires an email to be written but didn't a recipient address, select "followUpResponse"
- If the user is providing a response to a previous message in the thread, select "taskActionConfirmation"
- If the user is requesting some sort of identification i.e 'who are you', select "sendIdentityCard"
- Otherwise, select "simpleResponse"

Return valid JSON with only that single key "responseType" and value as one of the three allowed strings.
`;

  // Use a faster model for triage to reduce latency
  const completion = await openai.chat.completions.create({
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
      "sendIdentityCard",
      "simpleResponse",
      // "followUpResponse",
      "handleEmailAction", 
      "taskActionConfirmation",
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
export async function generateAgentIntroduction(incomingMessage: string, userName?: string): Promise<string> {
  if (!userName) {
    return "Hey there!";
  }

  const conversation = [
    {
      role: "system" as const,
      content: getSystemPrompt(userName)
    },
    {
      role: "user" as const, 
      content: incomingMessage
    }
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: conversation,
  });

  return completion.choices[0]?.message?.content || "Hello!";
}


/**
 * Generate a response to a WhatsApp thread of messages.
 * If userPrompt is provided, it will be passed as a user-level instruction in addition to the system prompt.
 */
export async function generateAgentResponse(threadMessages: ThreadMessage[], userPrompt?: string): Promise<string> {
  const messages = threadMessages.map((msg) => ({
    role: (msg.sender_number === process.env.A1BASE_AGENT_NUMBER! ? "assistant" : "user") as ChatRole,
    content: msg.content,
  }));

  // Extract the latest user's name (not the agent)
  const userName = [...threadMessages]
    .reverse()
    .find((msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER!)?.sender_name;

  if (!userName) {
    return "Hey there!";
  }

  // Build the conversation to pass to OpenAI
  const conversation = [
    { role: "system" as ChatRole, content: getSystemPrompt(userName) },
  ];

  // If there's a user-level prompt from basicWorkflowsPrompt, add it as a user message
  if (userPrompt) {
    conversation.push({ role: "user" as ChatRole, content: userPrompt });
  }

  // Then add the actual chat messages
  conversation.push(...messages);

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: conversation,
  });

  const content = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response";

  // Try parsing as JSON to extract just the "message"
  try {
    const data = JSON.parse(content);
    return data.message || "No message found.";
  } catch (error) {
    // If not valid JSON, just return the entire text
    return content;
  }
}

/**
 * Generate an email (subject/body) from a series of thread messages.
 * If userPrompt is provided, it will be added as an extra instruction.
 */
export async function generateEmailFromThread(threadMessages: ThreadMessage[], userPrompt?: string): Promise<{
  recipientEmail: string;
  hasRecipient: boolean;
  emailContent: {
    subject: string;
    body: string;
  } | null;
}> {

  console.log("OPENAI CALL TO MAKE EMAIL")
  // Extract email from last message
  const lastMessage = threadMessages[threadMessages.length - 1];
  let recipientEmail = "";  // Define this variable
  
  // Grab conversation context
  const relevantMessages = threadMessages.slice(-3).map((msg) => ({
    role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER! ? 
      "assistant" as const : 
      "user" as const,
    content: msg.content,
  }));

  // Build conversation
  const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { 
      role: "system",
      content: basicWorkflowsPrompt.email_generation.user 
    }
  ];
  
  // If there's a user-level prompt, add it
  if (userPrompt) {
    conversation.push({ role: "user", content: userPrompt });
  }
  
  // Add the last few relevant messages
  conversation.push(...relevantMessages);

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: conversation,
  });

  const response = completion.choices[0].message?.content;
  console.log('OPENAI RESPONSE')
  console.log(response)

  if (!response) {
    return {
      recipientEmail: "",
      hasRecipient: false,
      emailContent: null
    };
  }

  // Parse out SUBJECT and BODY from the raw text
  const subjectMatch = response.match(/SUBJECT:\s*(.*)/);
  const bodyMatch = response.match(/BODY:\s*([\s\S]*)/);

  return {
    recipientEmail: "",  // This will be handled by the OpenAI call later
    hasRecipient: false, // This should be false by default since we're not handling recipient extraction here
    emailContent: {
      subject: subjectMatch?.[1]?.trim() || "No subject",
      body: bodyMatch?.[1]?.trim() || "No body content",
    }
  };
}