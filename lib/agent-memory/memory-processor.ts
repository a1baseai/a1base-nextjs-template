import OpenAI from "openai";
import { loadAgentMemorySettings } from "../storage/file-storage";
import type { AgentMemorySettingsData, CustomMemoryField } from "./types";
import type { SupabaseAdapter } from "../supabase/config";

/**
 * Defines the structure for suggested memory updates identified by the AI.
 */
export interface IdentifiedMemoryUpdate {
  id: string; // The ID of the CustomMemoryField
  title: string; // The title of the CustomMemoryField (for logging/readability)
  newValue: string; // The new value suggested for this field
}

export interface MemoryUpdateSuggestions {
  userMemoryUpdates: IdentifiedMemoryUpdate[];
  chatMemoryUpdates: IdentifiedMemoryUpdate[];
}

/**
 * Analyzes an incoming message against configured agent memory fields and suggests updates.
 *
 * @param messageContent The text content of the incoming message.
 * @param userId A unique identifier for the user.
 * @param chatId A unique identifier for the chat thread.
 * @param openaiClient An initialized OpenAI client instance.
 * @param adapter An initialized SupabaseAdapter instance, or null if not configured.
 * @returns A Promise resolving to MemoryUpdateSuggestions, detailing potential updates.
 */
export async function processMessageForMemoryUpdates(
  messageContent: string,
  userId: string,
  chatId: string,
  openaiClient: OpenAI,
  adapter: SupabaseAdapter | null
): Promise<MemoryUpdateSuggestions> {
  const emptySuggestions: MemoryUpdateSuggestions = {
    userMemoryUpdates: [],
    chatMemoryUpdates: [],
  };

  console.log("Running PRocessMessageForMemoryUpdates");

  try {
    const settings = await loadAgentMemorySettings();
    if (!settings) {
      console.warn(
        "[MemoryProcessor] Agent memory settings not found. Skipping memory update check."
      );
      return emptySuggestions;
    }

    const enabledUserMemoryFields = settings.userMemoryEnabled
      ? settings.userMemoryFields
      : [];
    const enabledChatMemoryFields = settings.chatMemoryEnabled
      ? settings.chatThreadMemoryFields
      : [];

    if (
      enabledUserMemoryFields.length === 0 &&
      enabledChatMemoryFields.length === 0
    ) {
      // console.log('[MemoryProcessor] No enabled memory fields. Skipping memory update check.');
      return emptySuggestions;
    }

    // Construct the prompt for the AI
    // System message outlining the task and desired JSON output format
    const systemMessage = `You are an AI assistant tasked with analyzing a user's message to update predefined memory fields. Based on the message and the available memory fields (for general user profile and for the current chat thread), determine if any fields should be updated with new information explicitly or strongly implicitly present in the message. 

Respond ONLY with a JSON object. The JSON object must contain two keys: "userMemoryUpdates" and "chatMemoryUpdates". Each key's value should be an array of objects. Each object in the array must have an "id" (the ID of the memory field to update) and a "newValue" (the new string value for that field). 

If no updates are identified for a category, provide an empty array for that key. Only include fields for which a direct and clear update is present in the message. Do not infer values that are not clearly stated. If the message is a question, it's unlikely to update memory unless it explicitly states new information. Focus on factual updates.`;

    console.log("MEMORY SYSTEM MESSAGE");
    console.log(systemMessage);

    // User message for the AI, providing context and the message to analyze
    const aiUserMessage = `User Message (from user ${userId} in chat ${chatId}):
"${messageContent}"

Available User Memory Fields (for user ${userId}):
${JSON.stringify(
  enabledUserMemoryFields.map((f: CustomMemoryField) => ({
    id: f.id,
    title: f.title,
    description: f.description,
  }))
)}

Available Chat Thread Memory Fields (for chat ${chatId}):
${JSON.stringify(
  enabledChatMemoryFields.map((f: CustomMemoryField) => ({
    id: f.id,
    title: f.title,
    description: f.description,
  }))
)}

Please analyze the user message and provide necessary updates in the specified JSON format.`;

console.log("MEMORY AI MESSAGE")
console.log(aiUserMessage)

    // console.log('[MemoryProcessor] AI Prompt:', aiUserMessage); // For debugging the prompt

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4.1", // This model is good with JSON mode
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: aiUserMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more factual, less creative output
    });

    console.log("Response from OpenAI for memory updates:", response);

    const aiResponseContent = response.choices[0]?.message?.content;
    if (!aiResponseContent) {
      console.warn(
        "[MemoryProcessor] AI returned no content. Skipping memory updates."
      );
      return emptySuggestions;
    }

    // console.log('[MemoryProcessor] AI Raw Response:', aiResponseContent); // For debugging

    let parsedAiResponse: {
      userMemoryUpdates?: { id: string; newValue: string }[];
      chatMemoryUpdates?: { id: string; newValue: string }[];
    };
    try {
      parsedAiResponse = JSON.parse(aiResponseContent);
    } catch (parseError) {
      console.error(
        "[MemoryProcessor] Error parsing AI JSON response:",
        parseError,
        "\nAI Response:",
        aiResponseContent
      );
      return emptySuggestions;
    }

    const finalSuggestions: MemoryUpdateSuggestions = {
      userMemoryUpdates: [],
      chatMemoryUpdates: [],
    };

    // Process and validate user memory updates
    if (Array.isArray(parsedAiResponse.userMemoryUpdates)) {
      for (const update of parsedAiResponse.userMemoryUpdates) {
        if (
          update &&
          typeof update.id === "string" &&
          typeof update.newValue === "string"
        ) {
          const fieldDefinition = enabledUserMemoryFields.find(
            (f: CustomMemoryField) => f.id === update.id
          );
          if (fieldDefinition) {
            finalSuggestions.userMemoryUpdates.push({
              id: update.id,
              title: fieldDefinition.title,
              newValue: update.newValue,
            });
            // Persist to Supabase if adapter is available
            if (adapter) {
              try {
                const { error: upsertUserMemoryError } =
                  await adapter.upsertUserMemoryValue(
                    userId,
                    update.id,
                    update.newValue
                  );
                if (upsertUserMemoryError) {
                  // The adapter method already logs the specific Supabase error.
                  // This log is for context within memory processing if needed.
                  console.error(
                    `[MemoryProcessor] Adapter reported an error upserting user memory for ${userId}, field ${update.id}.`,
                    upsertUserMemoryError
                  );
                }
              } catch (dbError) {
                // Catching potential errors from the adapter call itself (not Supabase client errors handled within adapter)
                console.error(
                  `[MemoryProcessor] Exception calling adapter to upsert user memory for ${userId}, field ${update.id}:`,
                  dbError
                );
              }
            }
          }
        }
      }
    }

    // Process and validate chat memory updates
    if (Array.isArray(parsedAiResponse.chatMemoryUpdates)) {
      for (const update of parsedAiResponse.chatMemoryUpdates) {
        if (
          update &&
          typeof update.id === "string" &&
          typeof update.newValue === "string"
        ) {
          const fieldDefinition = enabledChatMemoryFields.find(
            (f: CustomMemoryField) => f.id === update.id
          );
          if (fieldDefinition) {
            finalSuggestions.chatMemoryUpdates.push({
              id: update.id,
              title: fieldDefinition.title,
              newValue: update.newValue,
            });
            // Persist to Supabase if adapter is available
            if (adapter) {
              try {
                const { error: upsertChatMemoryError } =
                  await adapter.upsertChatThreadMemoryValue(
                    chatId,
                    update.id,
                    update.newValue
                  );
                if (upsertChatMemoryError) {
                  // The adapter method already logs the specific Supabase error.
                  console.error(
                    `[MemoryProcessor] Adapter reported an error upserting chat memory for ${chatId}, field ${update.id}.`,
                    upsertChatMemoryError
                  );
                }
              } catch (dbError) {
                // Catching potential errors from the adapter call itself
                console.error(
                  `[MemoryProcessor] Exception calling adapter to upsert chat memory for ${chatId}, field ${update.id}:`,
                  dbError
                );
              }
            }
          }
        }
      }
    }

    return finalSuggestions;
  } catch (error) {
    console.error(
      "[MemoryProcessor] Error processing message for memory updates:",
      error
    );
    return emptySuggestions;
  }
}
