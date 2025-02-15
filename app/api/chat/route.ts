import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getSystemPrompt } from "../../../lib/agent/system-prompt";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const systemMessage = { role: "system", content: getSystemPrompt("Default User") };
  const modifiedMessages = [systemMessage, ...messages];
  const result = streamText({
    model: openai("gpt-4o"),
    messages: modifiedMessages,
  });
  return result.toDataStreamResponse();
}