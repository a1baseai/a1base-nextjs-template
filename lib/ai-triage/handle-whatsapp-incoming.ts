// import { WhatsAppIncomingData } from "a1base-node";
import { MessageRecord } from "@/types/chat";
import { triageMessage, projectTriage } from "./triage-logic";
import { initializeDatabase, getInitializedAdapter } from "../supabase/config";
import { WebhookPayload } from "@/app/api/messaging/incoming/route";
import { StartOnboarding } from "../workflows/onboarding-workflow";
import { A1BaseAPI } from "a1base-node";
import OpenAI from "openai";
import { loadOnboardingFlow } from "../onboarding-flow/onboarding-storage";
import { createAgenticOnboardingPrompt } from "../workflows/onboarding-workflow";
import { handleGroupChatOnboarding } from "../workflows/group-onboarding-workflow";
import { getSplitMessageSetting } from "../settings/message-settings";
import { saveMessage, userCheck } from "../data/message-storage";

// IN-MEMORY STORAGE
const messagesByThread = new Map();
// Maximum number of messages to keep in context
export const MAX_CONTEXT_MESSAGES = 10;

// The getSplitMessageSetting function has been moved to lib/settings/message-settings.ts

// Initialize A1Base API client for sending messages
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process onboarding conversation to extract user information and check if onboarding is complete
 * @param threadMessages Messages in the conversation thread
 * @param loadOnboardingFlow Function to load onboarding flow configuration
 * @returns Object containing extracted information and completion status
 */
async function processOnboardingConversation(
  threadMessages: MessageRecord[]
): Promise<{
  extractedInfo: Record<string, string>;
  isComplete: boolean;
}> {
  console.log("[Onboarding] Processing conversation for user information");

  try {
    // Load onboarding flow to get required fields
    const onboardingFlow = await loadOnboardingFlow();
    if (!onboardingFlow.agenticSettings?.userFields) {
      throw new Error("Onboarding settings not available");
    }

    // Get required fields from onboarding settings
    const requiredFields = onboardingFlow.agenticSettings.userFields
      .filter((field) => field.required)
      .map((field) => field.id);

    // Format the messages for analysis
    const formattedMessages = threadMessages.map((msg) => ({
      role:
        msg.sender_number === process.env.A1BASE_AGENT_NUMBER
          ? ("assistant" as const)
          : ("user" as const),
      content: msg.content,
    }));

    // Use OpenAI to extract structured information from the conversation
    const extractionPrompt = `
      Based on the conversation, extract the following information about the user:
      ${onboardingFlow.agenticSettings.userFields
        .map((field) => `- ${field.id}: ${field.description}`)
        .join("\n")}
      
      For any fields not mentioned in the conversation, return an empty string.
      You MUST respond in valid JSON format with only the extracted fields and nothing else.
      The response should be a valid JSON object that can be parsed with JSON.parse().
      
      Example response format: 
      { "name": "John Doe", "email": "john@example.com", "business_type": "Tech", "goals": "Increase productivity" }
      
      DO NOT include any explanations, markdown formatting, or anything outside the JSON object.
    `;

    // Call OpenAI to extract the information
    const extraction = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system" as const, content: extractionPrompt },
        ...formattedMessages,
      ],
      temperature: 0.2,
    });

    // Parse the extraction result
    const extractionContent = extraction.choices[0]?.message?.content || "{}";
    console.log("[Onboarding] Raw extraction content:", extractionContent);

    // Try to extract JSON from the response if it's not already valid JSON
    let jsonContent = extractionContent;
    if (extractionContent.includes("{") && extractionContent.includes("}")) {
      const jsonMatch = extractionContent.match(/\{[\s\S]*\}/); // Match everything between { and }
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
    }

    // Parse the JSON content
    let extractedInfo: Record<string, string>;
    try {
      extractedInfo = JSON.parse(jsonContent);
    } catch (e) {
      console.error("[Onboarding] Error parsing extraction result:", e);
      extractedInfo = {};
    }

    // Check if all required fields are filled
    const isComplete = requiredFields.every((field) => {
      return extractedInfo[field] && extractedInfo[field].trim() !== "";
    });

    console.log(`[Onboarding] Extraction results:`, extractedInfo);
    console.log(`[Onboarding] Onboarding complete: ${isComplete}`);

    return { extractedInfo, isComplete };
  } catch (error) {
    console.error("[Onboarding] Error processing conversation:", error);
    return { extractedInfo: {}, isComplete: false };
  }
}

/**
 * Save extracted onboarding information to user metadata in the database
 * @param sender_number User's phone number
 * @param extractedInfo Information extracted from conversation
 * @param isComplete Whether onboarding is complete
 * @returns Success status
 */
async function saveOnboardingInfo(
  sender_number: string,
  extractedInfo: Record<string, string>,
  isComplete: boolean
): Promise<boolean> {
  console.log(`[Onboarding] Saving onboarding info for user ${sender_number}`);

  try {
    // Try to get the initialized adapter for database operations
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error(`[Onboarding] Database adapter not initialized`);
      return false;
    }

    // Normalize phone number (remove '+' and spaces)
    const normalizedPhone = sender_number.replace(/\+|\s/g, "");

    // Prepare metadata with extracted info and completion status
    const metadata = {
      ...extractedInfo,
      onboarding_complete: isComplete,
    };

    // Update user metadata in database
    const success = await adapter.updateUser(normalizedPhone, { metadata });

    if (success) {
      console.log(
        `[Onboarding] Successfully updated user metadata for ${sender_number}`
      );
    } else {
      console.error(
        `[Onboarding] Failed to update user metadata for ${sender_number}`
      );
    }

    return success;
  } catch (error) {
    console.error("[Onboarding] Error saving onboarding info:", error);
    return false;
  }
}

/**
 * Handle follow-up onboarding messages with conversational AI
 * @param threadMessages Array of messages in the thread
 * @param thread_type Type of thread (individual or group)
 * @param thread_id ID of the thread
 * @param sender_number Phone number of the sender
 * @param service Service type (whatsapp, etc.)
 * @returns Response message object
 */
async function handleOnboardingFollowUp(
  threadMessages: MessageRecord[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<{ text: string; waitForResponse: boolean }> {
  console.log("[Onboarding] Handling follow-up onboarding message");

  try {
    // Load the onboarding flow configuration
    const onboardingFlow = await loadOnboardingFlow();

    // Create the system prompt for the AI
    const systemPrompt = createAgenticOnboardingPrompt(onboardingFlow);

    // Format messages for the AI - ensuring proper typing for the OpenAI API
    const formattedMessages = threadMessages.map((msg) => ({
      role:
        msg.sender_number === process.env.A1BASE_AGENT_NUMBER
          ? ("assistant" as const)
          : ("user" as const),
      content: msg.content,
    }));

    console.log(
      `[Onboarding] Processing ${formattedMessages.length} messages for follow-up`
    );

    // Process the conversation to extract user information
    const { extractedInfo, isComplete } = await processOnboardingConversation(
      threadMessages
    );

    // If we have a sender number and extracted information, save it
    if (sender_number && Object.keys(extractedInfo).length > 0) {
      await saveOnboardingInfo(sender_number, extractedInfo, isComplete);
    }

    // If onboarding is complete, send a final message
    let responseContent = "";
    if (isComplete) {
      // Get user's name from extracted info or default
      const userName = extractedInfo.name || "there";

      // Generate a personalized completion message
      responseContent =
        onboardingFlow.agenticSettings?.finalMessage ||
        `Thank you, ${userName}! Your onboarding is now complete. I've saved your information and I'm ready to help you with your tasks.`;

      console.log(
        `[Onboarding] Onboarding completed for user with phone number ${sender_number}`
      );
    } else {
      // Call OpenAI for a regular follow-up response
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system" as const, content: systemPrompt },
          ...formattedMessages,
        ],
        temperature: 0.7,
      });

      // Extract the AI's response
      responseContent =
        completion.choices[0]?.message?.content ||
        "I'm sorry, I couldn't process your message. Could you please try again?";

      console.log(`[Onboarding] Generated follow-up response`);
    }

    // If this is a WhatsApp or other channel, send the message
    if (
      (thread_type === "individual" || thread_type === "group") &&
      service !== "web-ui" &&
      service !== "__skip_send"
    ) {
      console.log("[Onboarding] Sending follow-up response via A1Base API");

      const messageData = {
        content: responseContent,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp" as const,
      };

      if (thread_type === "group" && thread_id) {
        await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          thread_id,
        });
      } else if (thread_type === "individual" && sender_number) {
        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          to: sender_number,
        });
      }
    }

    return {
      text: responseContent,
      waitForResponse: !isComplete, // Don't wait for response if onboarding is complete
    };
  } catch (error) {
    console.error("[Onboarding] Error in follow-up handling:", error);
    const errorMessage =
      "I'm having trouble processing your message. Let's continue with the onboarding. Could you please tell me your name?";

    // Handle error by sending a fallback message
    if (
      (thread_type === "individual" || thread_type === "group") &&
      service !== "web-ui" &&
      service !== "__skip_send"
    ) {
      const messageData = {
        content: errorMessage,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp" as const,
      };

      if (thread_type === "group" && thread_id) {
        await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          thread_id,
        });
      } else if (thread_type === "individual" && sender_number) {
        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...messageData,
          to: sender_number,
        });
      }
    }

    return { text: errorMessage, waitForResponse: true };
  }
}

// Interface moved to lib/interfaces/database-adapter.ts
// userCheck function moved to lib/data/message-storage.ts

/**
 * Save a message either to Supabase (if configured) or in-memory storage
 * This function has been moved to lib/data/message-storage.ts
 */

/**
 * Save a message to in-memory storage
 */
async function saveToMemory(threadId: string, message: MessageRecord) {
  let threadMessages = messagesByThread.get(threadId) || [];
  threadMessages.push(message);

  if (threadMessages.length > MAX_CONTEXT_MESSAGES) {
    threadMessages = threadMessages.slice(-MAX_CONTEXT_MESSAGES);
  }

  const normalizedAgentNumber = process.env.A1BASE_AGENT_NUMBER?.replace(
    /\+/g,
    ""
  );
  threadMessages = threadMessages.filter((msg: MessageRecord) => {
    const msgNumber = msg.sender_number.replace(/\+/g, "");
    return msgNumber !== normalizedAgentNumber;
  });

  messagesByThread.set(threadId, threadMessages);
}

export async function handleWhatsAppIncoming(webhookData: WebhookPayload) {
  // Extract data for easier access
  const {
    thread_id,
    message_id,
    message_type,
    message_content,
    sender_number,
    thread_type,
    timestamp,
    service,
  } = webhookData;

  // The content field is for backward compatibility
  const content = message_content.text || "";

  // Get sender name with potential override for agent
  let sender_name = webhookData.sender_name;
  if (sender_number === process.env.A1BASE_AGENT_NUMBER) {
    sender_name = process.env.A1BASE_AGENT_NAME || sender_name;
  }

  // Initialize database on first message
  await initializeDatabase();

  console.log("[Message Received]", {
    sender_number,
    message_content,
    thread_type,
    timestamp,
    service,
  });

  // Skip processing for messages from our own agent
  if (sender_number === process.env.A1BASE_AGENT_NUMBER!) {
    console.log("[Message] Skipping processing for agent's own message");
    return;
  }

  // Check if this is a new user/thread and should trigger onboarding
  const adapter = await getInitializedAdapter();
  let shouldTriggerOnboarding = false;
  let chatId: string | null = null;
  let threadMessages: MessageRecord[] = [];

  // Save the message to storage (either Supabase or in-memory)
  if (adapter) {
    try {
      // Process and store the webhook data in Supabase
      const { success, isNewChat } = await adapter.processWebhookPayload(webhookData);
      
      // Check if this is a new group chat and handle group onboarding if needed
      if (success && thread_type === 'group') {
        await handleGroupChatOnboarding(webhookData, isNewChat);
      }
      
      if (!success) {
        console.error(
          `[Supabase] Failed to store webhook data for message ${message_id}`
        );
      }

      // Check if this is a new thread in the database
      const thread = await adapter.getThread(thread_id);
      if (!thread) {
        shouldTriggerOnboarding = true;
      } else {
        chatId = thread.id;
        threadMessages = thread.messages || [];

        console.log("thread sender")
        console.log(thread.sender);
        console.log("thread sender metadata")
        

        // Check and log onboarding status from the sender's metadata
        if (thread.sender) {
          const onboardingComplete =
            thread.sender.metadata?.onboarding_complete === true;

          console.log("Onboarding complete:", onboardingComplete);

          // Set onboarding flag based on metadata
          if (!onboardingComplete) {
            shouldTriggerOnboarding = true;
            console.log(
              `[Onboarding] Will trigger onboarding for user ${thread.sender.name}.`
            );
          }
        } else {
          console.log(
            `[Onboarding] Could not determine sender for thread ${thread_id}`
          );
        }
      }

      // Store in memory too for redundancy
      await saveToMemory(thread_id, {
        message_id,
        content,
        message_type,
        message_content,
        sender_number,
        sender_name,
        timestamp,
      });
    } catch (error) {
      console.error("[Supabase] Error processing webhook data:", error);
      // Fallback to in-memory storage if database fails
      await saveMessage(
        thread_id,
        {
          message_id,
          content,
          message_type,
          message_content,
          sender_number,
          sender_name,
          timestamp,
        },
        thread_type,
        await getInitializedAdapter(),
        saveToMemory
      );

      // Get messages from memory instead
      threadMessages = messagesByThread.get(thread_id) || [];
      if (threadMessages.length === 0) {
        shouldTriggerOnboarding = true;
      }
    }
  } else {
    // No database adapter available, use in-memory storage only
    await saveMessage(
      thread_id,
      {
        message_id,
        content,
        message_type,
        message_content,
        sender_number,
        sender_name,
        timestamp,
      },
      thread_type,
      null, // No adapter available
      saveToMemory
    );

    // Get messages from memory
    threadMessages = messagesByThread.get(thread_id) || [];
    if (threadMessages.length === 0) {
      shouldTriggerOnboarding = true;
    }
  }

  // Always run project triage for every message (if we have a chat ID)
  let projectId: string | null = null;
  if (chatId) {
    try {
      // Run project triage on the messages
      projectId = await projectTriage(
        threadMessages,
        thread_id,
        chatId,
        service
      );
    } catch (error) {
      console.error("[WhatsApp] Error in project triage:", error);
    }
  }

  // Always run message triage to generate a response
  try {
    // Special handling for onboarding process
    if (shouldTriggerOnboarding) {
      // Check if this is a first message (starting onboarding) or a follow-up
      const isOnboardingInProgress = threadMessages.length > 1;

      if (isOnboardingInProgress) {
        console.log(
          `[WhatsApp] Continuing onboarding flow for thread ${thread_id}`
        );
        try {
          // Handle follow-up onboarding message with AI
          const response = await handleOnboardingFollowUp(
            threadMessages,
            thread_type as "individual" | "group",
            thread_id,
            sender_number,
            "__skip_send" // Special marker to avoid double-sending
          );

          // Split and send messages if needed
          const splitParagraphs = await getSplitMessageSetting();
          const messageLines = splitParagraphs
            ? response.text.split("\n").filter((line) => line.trim())
            : [response.text];

          // Send each line as a separate message
          for (const line of messageLines) {
            await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
              content: line,
              from: process.env.A1BASE_AGENT_NUMBER!,
              to: sender_number,
              service: "whatsapp",
            });
            // Wait a short delay between messages
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          // Return early since we've handled the message
          return { success: true, message: "Onboarding follow-up handled" };
        } catch (error) {
          console.error(
            "[WhatsApp] Error handling onboarding follow-up:",
            error
          );
          // Continue with regular triage if follow-up handling fails
        }
      } else {
        try {
          // Create an array of thread messages in the correct format for initial onboarding
          const formattedThreadMessages = threadMessages.map((msg) => ({
            message_id: msg.message_id,
            content: msg.content,
            message_type: (msg.message_type || "text") as
              | "text"
              | "rich_text"
              | "image"
              | "video"
              | "audio"
              | "location"
              | "reaction"
              | "group_invite"
              | "unsupported_message_type",
            message_content: msg.message_content || { text: msg.content },
            sender_number: msg.sender_number,
            sender_name: msg.sender_name,
            timestamp: msg.timestamp,
            role: (msg.sender_number === process.env.A1BASE_AGENT_NUMBER
              ? "assistant"
              : "user") as "user" | "assistant" | "system",
          }));

          // For initial onboarding, use the StartOnboarding function to generate messages
          const onboardingData = await StartOnboarding(
            formattedThreadMessages,
            thread_type as "individual" | "group",
            thread_id,
            sender_number,
            "__skip_send" // Special marker to avoid double-sending
          );

          if (
            onboardingData &&
            onboardingData.messages &&
            onboardingData.messages.length > 0
          ) {
            console.log(
              `[TRIAGE] Got ${onboardingData.messages.length} onboarding messages to send`
            );
            const splitParagraphs = await getSplitMessageSetting();
            for (const message of onboardingData.messages) {
              const messageLines = splitParagraphs
                ? message.text.split("\n").filter((line) => line.trim())
                : [message.text];

              // Send each line as a separate message
              for (const line of messageLines) {
                await client.sendIndividualMessage(
                  process.env.A1BASE_ACCOUNT_ID!,
                  {
                    content: line,
                    from: process.env.A1BASE_AGENT_NUMBER!,
                    to: sender_number,
                    service: "whatsapp",
                  }
                );
                // Wait a short delay between messages
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }

            // Add a larger delay between different onboarding messages
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          return;
        } catch (error) {
          console.error(`[WhatsApp] Error in onboarding flow:`, error);
          // Fall through to standard message triage
        }
      }
    }

    // For all other messages, run standard message triage
    const triageResult = await triageMessage({
      thread_id,
      message_id,
      content,
      message_type,
      message_content,
      sender_name,
      sender_number,
      thread_type,
      timestamp,
      messagesByThread,
      service: "__skip_send", // Special marker to avoid double-sending
    });

    if (triageResult.success) {
      // Send the response if the triage was successful and we have a message to send
      if (triageResult.message) {
        // For web-ui service, the response is handled by the calling code
        if (service !== "web-ui") {
          // Check if we should split messages (based on settings or defaults)
          const splitParagraphs = await getSplitMessageSetting();

          // Split response into paragraphs if setting is enabled
          const messages = splitParagraphs
            ? triageResult.message.split("\n").filter((msg) => msg.trim())
            : [triageResult.message];

          // Send each message line individually
          for (const messageContent of messages) {
            await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
              content: messageContent,
              from: process.env.A1BASE_AGENT_NUMBER!,
              to: sender_number,
              service: "whatsapp",
            });

            // Add a small delay between messages to maintain order
            if (splitParagraphs && messages.length > 1) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }
      }
    } else {
      console.error(`[WhatsApp] Triage failed: ${triageResult.message}`);
      // Optionally send an error message
      if (service !== "web-ui") {
        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          content:
            "Sorry, I'm having trouble processing your request right now. Please try again later.",
          from: process.env.A1BASE_AGENT_NUMBER!,
          to: sender_number,
          service: "whatsapp",
        });
      }
    }
  } catch (error) {
    console.error("[WhatsApp] Error in message triage:", error);
  }
}
