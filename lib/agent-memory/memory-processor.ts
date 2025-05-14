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
    
    // Fetch existing memory for context if we have an adapter
    let existingUserMemory: Record<string, any> = {};
    let existingChatMemory: Record<string, any> = {};
    
    if (adapter) {
      try {
        existingUserMemory = await adapter.getAllUserMemoryValues(userId);
        console.log(`Retrieved ${Object.keys(existingUserMemory).length} existing user memory items`);
        
        existingChatMemory = await adapter.getAllChatMemoryValues(chatId);
        console.log(`Retrieved ${Object.keys(existingChatMemory).length} existing chat memory items`);
      } catch (memoryError) {
        console.error("[MemoryProcessor] Error fetching existing memory:", memoryError);
        // Continue with empty memories if there was an error
      }
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

IMPORTANT: For each field, I will provide the current stored value if one exists. When suggesting updates:
1. If suggesting an update to a field that already has information, DON'T REPLACE the existing information completely unless the new information contradicts it.
2. For fields that represent preferences, likes, dislikes, or factual knowledge, BUILD UPON the existing information by adding new details.
3. For example, if existing memory says "Likes pizza" and the new message mentions "I also enjoy pasta", your update should be "Likes pizza and pasta".

KEY REQUIREMENTS FOR MEMORY UPDATES:
- Be EXTREMELY CONCISE - use 40 words or fewer whenever possible for one memory
- Feel free to append multiple memories to the same field if they are related
- Use simple, direct statements without unnecessary articles, pronouns, or filler words
- Focus only on key facts, preferences, or information
- For example, write "Dislikes coffee" instead of "The user has mentioned that they do not like coffee"
- When combining information, use commas and conjunctions efficiently
- For example, write "Likes running, swimming, biking" instead of "The user enjoys running. The user also enjoys swimming. The user also enjoys biking."

Respond ONLY with a JSON object. The JSON object must contain two keys: "userMemoryUpdates" and "chatMemoryUpdates". Each key's value should be an array of objects. Each object in the array must have an "id" (the ID of the memory field to update) and a "newValue" (the new string value for that field). 

If no updates are identified for a category, provide an empty array for that key. Only include fields for which a direct and clear update is present in the message. Do not infer values that are not clearly stated. If the message is a question, it's unlikely to update memory unless it explicitly states new information. Focus on factual updates.`;

    // User message for the AI, providing context and the message to analyze
    // Prepare enhanced field descriptions with current values
    const userFieldsWithCurrentValues = enabledUserMemoryFields.map((f: CustomMemoryField) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      current_value: existingUserMemory[f.id] || null
    }));
    
    const chatFieldsWithCurrentValues = enabledChatMemoryFields.map((f: CustomMemoryField) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      current_value: existingChatMemory[f.id] || null
    }));
    
    const aiUserMessage = `User Message (from user ${userId} in chat ${chatId}):
"${messageContent}"

Available User Memory Fields (for user ${userId}):
${JSON.stringify(userFieldsWithCurrentValues, null, 2)}

Available Chat Thread Memory Fields (for chat ${chatId}):
${JSON.stringify(chatFieldsWithCurrentValues, null, 2)}

Instructions:
1. Analyze the user message for new information
2. For fields with existing values, integrate new information rather than replacing
3. Only suggest updates when the message clearly contains relevant information
4. Your updates MUST be extremely concise (aim for 5-10 words max per field)
5. Use simple phrases without articles or unnecessary words (e.g., "Likes pizza, dislikes coffee" not "The user has mentioned they like pizza and dislike coffee")
6. If no updates are needed for a category, return an empty array

Please provide updates in the specified JSON format.`;

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
