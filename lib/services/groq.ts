import Groq from "groq-sdk";
import type { ThreadMessage } from '../../types/chat'
import { getSystemPrompt } from '../agent/system-prompt'
import { basicWorkflowsPrompt } from '../workflows/basic-workflows-prompt'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

import { ChatRole, EmailGenerationResult, MessageTriageResponse } from "../services/types";

/**
 * Analyzes message intent using Groq's LLaMA model to determine appropriate response workflow.
 * 
 * This function uses LLaMA 3.3 70B to analyze the conversation context and determine
 * the most appropriate way to handle the user's message. It follows the same response
 * patterns as the OpenAI implementation but uses Groq's API for potentially faster
 * or more cost-effective processing.
 * 
 * Response types:
 * - sendIdentityCard: User is asking about the agent's identity
 * - simpleResponse: Basic message requiring a direct response
 * - handleEmailAction: User wants to draft/send an email
 * - taskActionConfirmation: User is confirming a previous task
 * 
 * @param threadMessages - Array of messages providing conversation context
 * @returns MessageTriageResponse indicating how to handle the message
 * @throws May throw errors from Groq API calls
 */
export async function triageMessageIntent(threadMessages: ThreadMessage[]): Promise<MessageTriageResponse>{
  const conversationContext = threadMessages.map((msg) => ({
    role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER! ? "assistant" as const : "user" as const,
    content: msg.content,
  }));

  const triagePrompt = `
Based on the conversation, analyze the user's intent and respond with exactly one of these JSON responses:
{"responseType":"sendIdentityCard"}
{"responseType":"simpleResponse"}
{"responseType":"handleEmailAction"} 
{"responseType":"taskActionConfirmation"}

Rules:
- If the user specifically requests an email to be written or sent, or includes an email address, select "handleEmailAction"
- If the user is providing a response to a previous message in the thread, select "taskActionConfirmation"
- If the user is requesting some sort of identification i.e 'who are you', select "sendIdentityCard"
- Otherwise, select "simpleResponse"

Return valid JSON with only that single key "responseType" and value as one of the allowed strings.
`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: triagePrompt },
      ...conversationContext,
    ] as { role: string; content: string }[],
    model: "llama-3.3-70b-versatile",
  });

  const content = completion.choices[0]?.message?.content || "";
  console.log(content)

  try {
    const parsed = JSON.parse(content);
    const validTypes = [
      "sendIdentityCard",
      "simpleResponse",
      "handleEmailAction", 
      "taskActionConfirmation",
    ];

    if (validTypes.includes(parsed.responseType)) {
      return { responseType: parsed.responseType };
    }

    return { responseType: "simpleResponse" };
  } catch {
    return { responseType: "simpleResponse" };
  }
}

/**
 * Generates a personalized introduction message using Groq's LLaMA model.
 * 
 * Uses LLaMA 3.3 70B to create a contextually appropriate introduction based on
 * the agent's profile settings and the user's initial message. The introduction
 * is tailored to match the agent's configured personality and communication style.
 * 
 * @param incomingMessage - The user's initial message to respond to
 * @param userName - Optional name of the user for personalization
 * @returns A personalized introduction message string
 * @throws May throw errors from Groq API calls
 */
export async function generateAgentIntroduction(incomingMessage: string, userName?: string): Promise<string> {
  if (!userName) {
    return "Hey there!";
  }

  const conversation: { role: string; content: string }[] = [
    {
      role: "system" as const,
      content: getSystemPrompt(userName)
    },
    {
      role: "user" as const, 
      content: incomingMessage
    }
  ];

  const completion = await groq.chat.completions.create({
    messages: conversation,
    model: "llama-3.3-70b-versatile",
  });

  return completion.choices[0]?.message?.content || "Hello!";
}

/**
 * Generates a contextual response to a thread of messages using LLaMA.
 * 
 * This function combines the agent's system prompt with conversation history to
 * generate appropriate responses. It handles both direct responses and responses
 * that require additional context from a user-provided prompt.
 * 
 * The function:
 * 1. Maps messages to chat format
 * 2. Extracts user context for personalization
 * 3. Combines system prompt with conversation history
 * 4. Handles both raw text and JSON-formatted responses
 * 
 * @param threadMessages - Array of messages in the conversation
 * @param userPrompt - Optional additional instructions for response generation
 * @returns Generated response string
 * @throws May throw errors from Groq API calls
 */
export async function generateAgentResponse(threadMessages: ThreadMessage[], userPrompt?: string): Promise<string> {
  const messages = threadMessages.map((msg) => ({
    role: (msg.sender_number === process.env.A1BASE_AGENT_NUMBER! ? "assistant" : "user") as ChatRole,
    content: msg.content,
  }));

  const userName = [...threadMessages]
    .reverse()
    .find((msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER!)?.sender_name;

  if (!userName) {
    return "Hey there!";
  }

  const conversation = [
    { role: "system" as ChatRole, content: getSystemPrompt(userName) },
  ];

  if (userPrompt) {
    conversation.push({ role: "user" as ChatRole, content: userPrompt });
  }

  conversation.push(...messages);

  const completion = await groq.chat.completions.create({
    messages: conversation,
    model: "llama-3.3-70b-versatile",
  });

  const content = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response";

  try {
    const data = JSON.parse(content);
    return data.message || "No message found.";
  } catch (error) {
    return content;
  }
}

/**
 * Generates an email draft from conversation context using LLaMA.
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
 * @throws May throw errors from Groq API calls
 */
export async function generateEmailFromThread(threadMessages: ThreadMessage[], userPrompt?: string): Promise<EmailGenerationResult>{
  const relevantMessages = threadMessages.slice(-3).map((msg) => ({
    role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER! ? 
      "assistant" as const : 
      "user" as const,
    content: msg.content,
  }));

  const conversation = [
    { 
      role: "system",
      content: basicWorkflowsPrompt.email_generation.user 
    }
  ];
  
  if (userPrompt) {
    conversation.push({ role: "user", content: userPrompt });
  }

  conversation.push(...relevantMessages);

  const completion = await groq.chat.completions.create({
    messages: conversation,
    model: "llama-3.3-70b-versatile",
  });

  const response = completion.choices[0].message?.content;

  if (!response) {
    return {
      recipientEmail: "",
      hasRecipient: false,
      emailContent: null
    };
  }

  const subjectMatch = response.match(/SUBJECT:\s*(.*)/);
  const bodyMatch = response.match(/BODY:\s*([\s\S]*)/);

  return {
    recipientEmail: "",
    hasRecipient: false,
    emailContent: {
      subject: subjectMatch?.[1]?.trim() || "No subject",
      body: bodyMatch?.[1]?.trim() || "No body content",
    }
  };
}
