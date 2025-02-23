import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { fromStreamText } from "assistant-stream/ai-sdk";
import { createAssistantStreamResponse } from "assistant-stream";
import { getSystemPrompt } from "../../../lib/agent/system-prompt";
import { triageMessage } from "../../../lib/ai-triage/triage-logic";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const systemMessage = { role: "system", content: getSystemPrompt() };
  const modifiedMessages = [systemMessage, ...messages];

  // console.log(
  //   "Messages:",
  //   messages.map((msg: any) => ({
  //     role: msg.role,
  //     content: msg.content[0]?.text || msg.content,
  //     timestamp: new Date().toISOString(),
  //   }))
  // );

  // Set up dummy values for web chat where thread_id and other parameters are not available
  const dummyThreadId = "webchat";
  const dummySenderName = "WebUser";
  const dummySenderNumber = "web";
  const dummyThreadType = "individual";
  const dummyMessageId = Date.now().toString();
  const dummyTimestamp = new Date().toISOString();
  const dummyService = "web-ui";

  // Extract the content from the most recent message (assumes user message is last)
  const lastMessage = messages[messages.length - 1];
  const messageContent = lastMessage.content[0]?.text || lastMessage.content;

  // Create an in-memory message record and map for the triage function
  const dummyMessageRecord = {
    message_id: dummyMessageId,
    content: messageContent,
    sender_number: dummySenderNumber,
    sender_name: dummySenderName,
    timestamp: dummyTimestamp,
  };

  const messagesByThread = new Map();
  messagesByThread.set(dummyThreadId, [dummyMessageRecord]);

  try {
    // Run the triage logic using the dummy data suitable for web chat
    const triageResponse = await triageMessage({
      thread_id: dummyThreadId,
      message_id: dummyMessageId,
      content: messageContent,
      sender_name: dummySenderName,
      sender_number: dummySenderNumber,
      thread_type: dummyThreadType,
      timestamp: dummyTimestamp,
      messagesByThread,
      service: dummyService,
    });

    console.log("[POST] Triage Response:", triageResponse);

    return createAssistantStreamResponse(async (controller) => {
      if (triageResponse.type === 'default-webchat') {
        // Stream the default chat response
        const result = streamText({
          model: openai("gpt-4"),
          messages: modifiedMessages,
        });
        controller.merge(fromStreamText(result.fullStream));
      } else {
        // Stream the triage response data
        controller.appendText(triageResponse.message || 'No response message available');
      }
    });

  } catch (error) {
    console.error("[POST] Triage Error:", error);
    throw error;
  }
}