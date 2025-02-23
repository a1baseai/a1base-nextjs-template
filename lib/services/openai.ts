import { ThreadMessage } from '../../types/chat'
import OpenAI from 'openai'
import { getSystemPrompt } from '../agent/system-prompt'
import { basicWorkflowsPrompt } from '../workflows/basic-workflows-prompt'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

import { ChatRole, EmailGenerationResult, MessageTriageResponse } from "../services/types";

/**
 * Analyzes message intent using OpenAI to determine appropriate response workflow.
 * 
 * This function uses GPT-3.5-turbo to analyze the conversation context and determine
 * the most appropriate way to handle the user's message. It performs quick heuristic
 * checks for common patterns before using AI for more complex analysis.
 * 
 * Response types:
 * - sendIdentityCard: User is asking about the agent's identity
 * - simpleResponse: Basic message requiring a direct response
 * - handleEmailAction: User wants to draft/send an email
 * - taskActionConfirmation: User is confirming a previous task
 * 
 * @param threadMessages - Array of messages providing conversation context
 * @returns MessageTriageResponse indicating how to handle the message
 * @throws May throw errors from OpenAI API calls
 */
export async function triageMessageIntent(threadMessages: ThreadMessage[]): Promise<MessageTriageResponse>{
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
 * Generates a personalized introduction message for the AI agent.
 * 
 * Uses GPT-4 to create a contextually appropriate introduction based on the agent's
 * profile settings and the user's initial message. The introduction is tailored to
 * match the agent's configured personality and communication style.
 * 
 * @param incomingMessage - The user's initial message to respond to
 * @param userName - Optional name of the user for personalization
 * @returns A personalized introduction message string
 * @throws May throw errors from OpenAI API calls
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
 * Generates a contextual response to a thread of messages using GPT-4.
 * 
 * This function combines the agent's system prompt with conversation history to
 * generate appropriate responses. It handles both direct responses and responses
 * that require additional context from a user-provided prompt.
 * 
 * The function:
 * 1. Maps messages to OpenAI chat format
 * 2. Extracts user context for personalization
 * 3. Combines system prompt with conversation history
 * 4. Handles both raw text and JSON-formatted responses
 * 
 * @param threadMessages - Array of messages in the conversation
 * @param userPrompt - Optional additional instructions for response generation
 * @returns Generated response string
 * @throws May throw errors from OpenAI API calls
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
 * Generates an email draft from conversation context using GPT-4.
 * 
 * This function analyzes recent messages to understand the email requirements and
 * generates appropriate subject and body content. It uses specialized prompts from
 * basicWorkflowsPrompt to ensure the email matches the agent's communication style.
 * 
 * The function:
 * 1. Extracts relevant context from recent messages
 * 2. Uses email-specific system prompts
 * 3. Generates and formats email content
 * 4. Handles recipient extraction separately
 * 
 * @param threadMessages - Array of messages providing email context
 * @param userPrompt - Optional additional instructions for email generation
 * @returns EmailGenerationResult containing subject, body, and recipient info
 * @throws May throw errors from OpenAI API calls
 */
export async function generateEmailFromThread(threadMessages: ThreadMessage[], userPrompt?: string): Promise<EmailGenerationResult>{

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
