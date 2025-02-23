import OpenAI from 'openai';
import type { ThreadMessage } from '../../types/chat'
import { getSystemPrompt } from '../agent/system-prompt'

// Initialize Perplexity client
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai',
})

/**
 * Generate a response to a WhatsApp thread of messages.
 * If userPrompt is provided, it will be passed as a user-level instruction in addition to the system prompt.
 * 
 * @param threadMessages - Array of messages providing conversation context
 * @param userPrompt - Optional additional instructions for response generation
 * @returns Generated response string
 * @throws May throw errors from Perplexity API calls
 */
export async function generatePerplexityResponse(threadMessages: ThreadMessage[], userPrompt?: string): Promise<string> {
  const messages = threadMessages.map((msg) => ({
    role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER! ? "assistant" as const : "user" as const,
    content: msg.content,
  }));

  // Extract the latest user's name (not the agent)
  const userName = [...threadMessages]
    .reverse()
    .find((msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER!)?.sender_name;

  if (!userName) {
    return "Hey there!";
  }

  // Build the conversation to pass to Perplexity
  const conversation: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: getSystemPrompt(userName) },
  ];

  // If there's a user-level prompt, add it as a user message
  if (userPrompt) {
    conversation.push({ role: "user", content: userPrompt });
  }

  // Then add the actual chat messages
  conversation.push(...messages);

  const completion = await perplexity.chat.completions.create({
    model: "sonar-pro", // or another model as needed
    messages: conversation,
  });

  return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response";
}
