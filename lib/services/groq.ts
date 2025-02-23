import Groq from "groq-sdk";
import { ThreadMessage } from '@/types/chat'
import { getSystemPrompt } from '../agent/system-prompt'
import { basicWorkflowsPrompt } from '../workflows/basic-workflows-prompt'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

import { ChatRole, EmailGenerationResult, MessageTriageResponse } from "./types";

/**
 * Triage the message intent to determine appropriate response type
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
    ],
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
 * Generate an introduction message for the AI agent
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

  const completion = await groq.chat.completions.create({
    messages: conversation,
    model: "llama-3.3-70b-versatile",
  });

  return completion.choices[0]?.message?.content || "Hello!";
}

/**
 * Generate a response to a thread of messages
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
 * Generate an email from thread messages
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
