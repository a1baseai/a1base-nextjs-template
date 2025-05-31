/**
 * Group Chat Onboarding Workflow
 * 
 * Handles the initial onboarding process for group chats
 * 
 * Uses Supabase to track onboarding status in the chat metadata
 * ensuring persistence across server restarts
 */
import { A1BaseAPI } from "a1base-node";
import { loadGroupOnboardingFlow } from "../onboarding-flow/group-onboarding-storage";
import { WebhookPayload } from "@/app/api/a1base/messaging/route";
import { getInitializedAdapter } from "../supabase/config";
import { getOpenAI } from "../services/openai";
import { ThreadMessage } from "../supabase/types"; // Import ThreadMessage type

// Use the existing database types
interface MessageRecord {
  message_id: string;
  content: string;
  sender_number: string;
  sender_name?: string;
  timestamp: string;
  message_type?: string;
  message_content?: any;
}

// Initialize A1Base API client for sending messages
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// No in-memory cache - always check database directly for onboarding status

/**
 * Check if a group chat has been onboarded by checking the database
 * @param chatId Supabase chat ID
 * @returns Promise<{ onboardingComplete: boolean, onboardingInProgress: boolean }> Status of onboarding
 */
async function getGroupOnboardingStatus(chatId: string): Promise<{ onboardingComplete: boolean, onboardingInProgress: boolean }> {
  // Always check database directly - no caching
  
  try {
    // Get the adapter for database operations
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return { onboardingComplete: false, onboardingInProgress: false };
    }
    
    // Get the chat from the database
    const thread = await adapter.getThread(chatId);
    if (!thread) {
      return { onboardingComplete: false, onboardingInProgress: false }; // Chat doesn't exist in database
    }
    
    // Check onboarding status using the new metadata structure
    const onboardingComplete = thread.metadata?.onboarding?.completed === true;
    const onboardingInProgress = thread.metadata?.onboarding?.in_progress === true && !onboardingComplete;
    
    // No caching - always use fresh database state
    
    return { 
      onboardingComplete,
      onboardingInProgress
    };
  } catch (error) {
    return { onboardingComplete: false, onboardingInProgress: false };
  }
}

/**
 * Start onboarding process for a group chat in the database
 * @param chatId Supabase chat ID 
 * @returns Promise<boolean> indicating if the update was successful
 */
async function markGroupOnboardingStarted(supabaseChatId: string): Promise<boolean> {
  try {
    // Get database adapter
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return false;
    }
    
    const thread = await adapter.getThread(supabaseChatId);
    const existingMetadata = thread?.metadata || {};
    
    // Load the group onboarding flow to get field definitions
    const onboardingFlow = await loadGroupOnboardingFlow();
    
    // Create field definitions for all fields (same structure as individual onboarding)
    const fieldDefinitions = onboardingFlow.agenticSettings.userFields.reduce((acc, field) => {
      acc[field.id] = {
        label: field.label,
        description: field.description,
        required: field.required,
        value: null, // Will be populated during onboarding
        collected: false
      };
      return acc;
    }, {} as Record<string, any>);

    // Update the thread metadata to include onboarding status
    const updatedMetadata = {
      ...existingMetadata,
      onboarding: {
        ...existingMetadata.onboarding,
        in_progress: true,  // Mark that onboarding is now in progress
        completed: false,   // Make sure it's not marked as completed
        fields_pending: onboardingFlow.agenticSettings.userFields.map(field => field.id), // Fields waiting to be collected
        fields_collected: {}, // Will store field values as they're collected
        started_at: new Date().toISOString(), // Track when onboarding started
        field_definitions: fieldDefinitions // Store complete field definitions
      }
    };

    // Update chat metadata with a cleaner, more logical structure
    const success = await adapter.updateChatMetadata(supabaseChatId, updatedMetadata);
    
    return success;
  } catch (error) {
    return false;
  }
}

/**
 * Mark a group chat as fully onboarded in the database
 * This should only be called after all required fields are collected
 * @param chatId Supabase chat ID 
 * @param collectedFields Collected fields from onboarding
 * @param fieldDefinitionsFromFlow Field definitions from the onboarding flow
 * @returns Promise<boolean> indicating if the update was successful
 */
async function markGroupAsOnboarded(
  supabaseChatId: string,
  collectedFields: Record<string, string>,
  fieldDefinitionsFromFlow: Array<Record<string, any>>
): Promise<boolean> {
  try {
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return false;
    }
    
    const thread = await adapter.getThread(supabaseChatId);
    
    let existingMetadata: Record<string, any> = {};
    let existingOnboarding: Record<string, any> = {};
    
    if (!thread || !thread.metadata) {
      existingMetadata = {
        a1_account_id: process.env.A1BASE_ACCOUNT_ID || '',
        onboarding: {}
      };
    } else {
      existingMetadata = {...thread.metadata};
    }

    existingOnboarding = {...existingMetadata.onboarding || {}};

    const fieldDefinitionsMap: Record<string, any> = {};
    if (Array.isArray(fieldDefinitionsFromFlow)) {
      fieldDefinitionsFromFlow.forEach(field => {
        if (field && field.id) {
          fieldDefinitionsMap[field.id] = field;
        }
      });
    }
        
    const groupInfo = {
      ...(existingMetadata.group_info || {}),
      ...collectedFields,  
      onboarding_completed_at: new Date().toISOString(),
    };
        
    const updatedMetadata = {
      ...existingMetadata,
      group_info: groupInfo,
      onboarding: {
        ...existingOnboarding,
        in_progress: false,
        completed: true,
        completion_time: new Date().toISOString(),
        fields_collected: {...collectedFields}, 
        fields_pending: [], 
        field_definitions: fieldDefinitionsMap 
      }
    };
          
    const success = await adapter.updateChatMetadata(supabaseChatId, updatedMetadata);
    
    return success;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a group chat is currently in the onboarding state
 * @param thread_id The thread ID to check
 * @returns Promise<boolean> indicating if the chat is in onboarding state
 */
export async function isGroupInOnboardingState(thread_id: string): Promise<boolean> {
  try {
    if (!thread_id) {
      return false;
    }
    
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return false;
    }
    
    const thread = await adapter.getThread(thread_id);
    if (!thread) {
      return false;
    }
    
    return !!thread.metadata?.onboarding?.in_progress && !thread.metadata?.onboarding?.completed;
  } catch (error) {
    return false;
  }
}

/**
 * Process an incoming message for a group chat that is in the onboarding state
 * This examines the message content and tries to extract answers to pending onboarding fields
 * 
 * @param payload Webhook payload with message information
 * @returns Promise<boolean> indicating if a response was sent
 */
export async function processGroupOnboardingMessage(
  payload: WebhookPayload
): Promise<boolean> {
  try {
    if (!payload || !payload.thread_id || !payload.message_content) {
      console.log("[PGO] Invalid payload for processing group onboarding message.");
      return false;
    }
    
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.log("[PGO] Supabase adapter not initialized.");
      return false;
    }

    // Store the incoming user message first
    try {
      console.log(`[PGO] Attempting to store user message via processWebhookPayload for thread: ${payload.thread_id}, message: ${payload.message_id}`);
      const storeResult = await adapter.processWebhookPayload(payload);
      if (!storeResult.success) {
        console.error(`[PGO] Failed to store user message via processWebhookPayload for thread: ${payload.thread_id}, message: ${payload.message_id}. Success was false.`);
        // Decide if we should return false or continue. For now, let's log and continue, 
        // as the primary function is onboarding progression.
      } else {
        console.log(`[PGO] Successfully stored user message via processWebhookPayload for thread: ${payload.thread_id}, message: ${payload.message_id}`);
      }
    } catch (error) {
      console.error(`[PGO] Error calling processWebhookPayload for thread: ${payload.thread_id}, message: ${payload.message_id}`, error);
      // Log and continue
    }

    const threadId = payload.thread_id;
    const messageText = typeof payload.message_content === 'string' 
      ? payload.message_content 
      : payload.message_content?.text || '';
    
    const thread = await adapter.getThread(payload.thread_id);
    if (!thread || !thread.id) {
      return false;
    }
    
    if (!thread.metadata?.onboarding?.in_progress) {
      return false;
    }
    
    const pendingFieldId = thread.metadata?.onboarding?.fields_pending?.[0];
    
    const onboardingFlow = await loadGroupOnboardingFlow();
    
    if (!pendingFieldId) {
      const hasCollectedFields = thread.metadata?.onboarding?.fields_collected && 
                               Object.keys(thread.metadata.onboarding.fields_collected).length > 0;
      
      if (!hasCollectedFields) {
        return false;
      }
      
      const finalMessage = onboardingFlow.agenticSettings.finalMessage;
      
      const onboardingCompleted = await completeGroupOnboarding(thread.id, payload.thread_id, finalMessage);
      
      if (!onboardingCompleted) {
        return false;
      }
      
      return true;
    }
    
    const fieldDefinition = thread.metadata?.onboarding?.field_definitions?.[pendingFieldId];
    
    const updatedFieldDefinitions = {
      ...thread.metadata?.onboarding?.field_definitions || {}
    };
    
    if (updatedFieldDefinitions[pendingFieldId]) {
      updatedFieldDefinitions[pendingFieldId] = {
        ...updatedFieldDefinitions[pendingFieldId],
        collected: true,
        value: messageText
      };
    }
    
    try {
      const currentThread = await adapter.getThread(payload.thread_id);
      if (!currentThread || !currentThread.metadata || !currentThread.metadata.onboarding) {
        return false;
      }
      
      const fieldsCollected = {
        ...currentThread.metadata.onboarding.fields_collected,
        [pendingFieldId]: messageText
      };
      
      const updatedPendingFields = currentThread.metadata.onboarding.fields_pending.filter(
        (id: string) => id !== pendingFieldId
      );
      
      const updatedMetadata = {
        ...currentThread.metadata,
        onboarding: {
          ...currentThread.metadata.onboarding,
          fields_collected: fieldsCollected,
          fields_pending: updatedPendingFields,
          field_definitions: updatedFieldDefinitions
        }
      };
      
      await adapter.updateChatMetadata(thread.id, updatedMetadata);
      
      if (updatedPendingFields.length > 0) {
        const nextFieldId = updatedPendingFields[0];
        const nextFieldDefinition = updatedFieldDefinitions[nextFieldId];
        
        if (nextFieldDefinition && nextFieldDefinition.description) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          await sendGroupOnboardingPrompt(payload.thread_id, nextFieldDefinition.description, nextFieldId);
          return true;
        }
      } else {
        const onboardingCompleted = await completeGroupOnboarding(thread.id, payload.thread_id, onboardingFlow.agenticSettings.finalMessage);
        
        if (!onboardingCompleted) {
          return false;
        }
        
        return true;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Send a message to prompt for a specific onboarding field
 * Uses the field descriptions directly from the configuration file
 */
async function sendGroupOnboardingPrompt(threadId: string, fieldDescription: string, fieldId?: string): Promise<void> {
  let messageToSend = fieldDescription; 

  try {
    const adapter = await getInitializedAdapter(); 
    if (!adapter) {
    } else {
      const groupOnboardingFlow = await loadGroupOnboardingFlow();
      const systemPrompt = groupOnboardingFlow?.agenticSettings?.systemPrompt;

      if (systemPrompt) {
        let chatHistoryFormatted: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
        try {
          const threadData = await adapter.getThread(threadId);
          if (threadData && threadData.messages && threadData.messages.length > 0) {
            const recentMessages = threadData.messages.slice(-10);
            
            chatHistoryFormatted = recentMessages.map((msg: ThreadMessage) => ({
              role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER ? 'assistant' as const : 'user' as const,
              content: msg.message_content?.text || msg.content || ""
            })); 
          }
        } catch (historyError) {
        }

        const messagesForAI = [
          { role: "system" as const, content: systemPrompt },
          ...chatHistoryFormatted, 
          { role: "user" as const, content: `You are Felicie, an AI assistant. Your task is to ask the group a question to gather specific information. Considering the preceding conversation history (if any) and your persona defined in the system prompt, ask the group about: "${fieldDescription}". Ensure your question is natural, friendly, conversational, and specifically avoids repeating questions or topics already covered in the history. Ask only the question itself, do not add any preamble.` }
        ];

        console.log("GROUP ONBOARDING MESSAGESFORAI")
        console.log(messagesForAI)

        
        console.log("OpenaAI completion happening at sendGroupOnboardingPrompt function")
        const completion = await getOpenAI().chat.completions.create({
          model: "gpt-4.1", 
          messages: messagesForAI as any, 
          temperature: 0.7,
          max_tokens: 150,
        });

        const aiGeneratedQuestion = completion.choices[0]?.message?.content?.trim();

        if (aiGeneratedQuestion) {
          messageToSend = aiGeneratedQuestion;
        } else {
        }
      }
    } 
  } catch (error) {
  }
  
  await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
    content: messageToSend,
    from: process.env.A1BASE_AGENT_NUMBER!,
    thread_id: threadId,
    service: "whatsapp",
  });
}

/**
 * Mark a chat as having completed onboarding and send the final message
 */
async function completeGroupOnboarding(
  supabaseChatId: string, 
  threadId: string,
  finalMessage: string
): Promise<boolean> {
  try {
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return false;
    }
    
    let thread = await adapter.getThread(supabaseChatId);
    
    if (!thread) {
      thread = await adapter.getThread(threadId);
      
      if (thread) {
        supabaseChatId = thread.id; 
      } else {
        return false;
      }
    }
    
    if (!thread.metadata?.onboarding) {
      return false;
    }
    
    const collectedFields = thread.metadata.onboarding.fields_collected;
    if (!collectedFields || Object.keys(collectedFields).length === 0) {
      return false;
    }

    // Load group onboarding flow to get field definitions
    const groupOnboardingFlow = await loadGroupOnboardingFlow();
    if (!groupOnboardingFlow || !groupOnboardingFlow.agenticSettings || !groupOnboardingFlow.agenticSettings.userFields) {
        return false;
    }
    const fieldDefinitionsFromFlow = groupOnboardingFlow.agenticSettings.userFields;
        
    const markedComplete = await markGroupAsOnboarded(supabaseChatId, collectedFields, fieldDefinitionsFromFlow);
    
    if (!markedComplete) {
      return false;
    }
    
    try {
      await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
        content: finalMessage,
        from: process.env.A1BASE_AGENT_NUMBER!,
        thread_id: threadId,
        service: "whatsapp",
      });
    } catch (sendError) {
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Handle the initial onboarding for a new group chat
 * 
 * @param payload The webhook payload containing information about the message
 * @param isNewChat Boolean indicating if this is a newly created chat
 * @returns Promise<boolean> indicating whether the onboarding welcome message was sent
 */
export async function handleGroupChatOnboarding(
  payload: WebhookPayload, 
  isNewChat: boolean
): Promise<boolean> {
  if (payload.thread_type !== "group") {
    return false;
  }

  const adapter = await getInitializedAdapter();
  if (!adapter) {
    return false;
  }
  
  const thread = await adapter.getThread(payload.thread_id);
  if (!thread || !thread.id) {
    return false;
  }
  
  const { onboardingComplete, onboardingInProgress } = await getGroupOnboardingStatus(payload.thread_id);
  
  if (onboardingComplete) {
    return false;
  }
  
  if (onboardingInProgress) {
    return false;
  }

  try {
    const groupOnboardingFlow = await loadGroupOnboardingFlow();

    if (!groupOnboardingFlow.enabled) {
      return false;
    }
    
    const welcomeMessage = groupOnboardingFlow.agenticSettings.initialGroupMessage;

    await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
      content: welcomeMessage,
      from: process.env.A1BASE_AGENT_NUMBER!,
      thread_id: payload.thread_id,
      service: "whatsapp",
    });

    const onboardingStartedSuccessfully = await markGroupOnboardingStarted(thread.id);
    if (!onboardingStartedSuccessfully) {
      return false; 
    }
    
    const updatedThread = await adapter.getThread(payload.thread_id);
    if (updatedThread && 
        updatedThread.metadata && 
        updatedThread.metadata.onboarding && 
        updatedThread.metadata.onboarding.fields_pending && 
        updatedThread.metadata.onboarding.fields_pending.length > 0) {
      const firstFieldId = updatedThread.metadata.onboarding.fields_pending[0];
      const firstField = updatedThread.metadata.onboarding.field_definitions[firstFieldId];
      
      if (firstField) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await sendGroupOnboardingPrompt(payload.thread_id, firstField.description, firstFieldId);
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Reset group onboarding state for a chat (for troubleshooting)
 * This will clear the onboarding in_progress flag and allow normal message processing
 * 
 * @param thread_id The thread ID to reset
 * @returns Promise<boolean> indicating if the reset was successful
 */
export async function resetGroupOnboardingState(thread_id: string): Promise<boolean> {
  try {
    console.log(`[ResetOnboarding] Attempting to reset onboarding state for thread: ${thread_id}`);
    
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error("[ResetOnboarding] Supabase adapter not initialized");
      return false;
    }
    
    const thread = await adapter.getThread(thread_id);
    if (!thread) {
      console.error(`[ResetOnboarding] Thread not found: ${thread_id}`);
      return false;
    }
    
    const existingMetadata = thread.metadata || {};
    
    // Reset onboarding state while preserving other metadata
    const updatedMetadata = {
      ...existingMetadata,
      onboarding: {
        ...existingMetadata.onboarding,
        in_progress: false,
        completed: false,
        // Clear fields but keep definitions for history
        fields_pending: [],
        reset_at: new Date().toISOString(),
        reset_reason: "Manual reset via resetGroupOnboardingState function"
      }
    };
    
    const success = await adapter.updateChatMetadata(thread.id, updatedMetadata);
    
    if (success) {
      console.log(`[ResetOnboarding] Successfully reset onboarding state for thread: ${thread_id}`);
    } else {
      console.error(`[ResetOnboarding] Failed to reset onboarding state for thread: ${thread_id}`);
    }
    
    return success;
  } catch (error) {
    console.error(`[ResetOnboarding] Error resetting onboarding state for thread ${thread_id}:`, error);
    return false;
  }
}
