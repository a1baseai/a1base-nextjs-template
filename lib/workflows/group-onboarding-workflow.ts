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
import { WebhookPayload } from "@/app/api/messaging/incoming/route";
import { getInitializedAdapter } from "../supabase/config";

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

/**
 * In-memory cache of onboarded groups to reduce database lookups
 * The source of truth is the Supabase database in the chat metadata
 */
const onboardedGroupChatsCache = new Set<string>();

/**
 * Check if a group chat has been onboarded by checking the database
 * @param chatId Supabase chat ID
 * @returns Promise<{ onboardingComplete: boolean, onboardingInProgress: boolean }> Status of onboarding
 */
async function getGroupOnboardingStatus(chatId: string): Promise<{ onboardingComplete: boolean, onboardingInProgress: boolean }> {
  // Check in-memory cache first for complete onboarding
  if (onboardedGroupChatsCache.has(chatId)) {
    return { onboardingComplete: true, onboardingInProgress: false };
  }
  
  try {
    // Get the adapter for database operations
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error('[Group Onboarding] Database adapter not initialized');
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
    
    // If onboarding is complete, add to cache for future checks
    if (onboardingComplete) {
      onboardedGroupChatsCache.add(chatId);
    }
    
    return { 
      onboardingComplete,
      onboardingInProgress
    };
  } catch (error) {
    console.error('[Group Onboarding] Error checking onboarding status:', error);
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
      console.error('[Group Onboarding] Database adapter not initialized');
      return false;
    }
    
    const thread = await adapter.getThread(supabaseChatId);
    const existingMetadata = thread?.metadata || {};
    
    // Get the onboarding flow config to determine which fields to collect
    const groupOnboardingFlow = await loadGroupOnboardingFlow();
    
    // Extract the required and optional fields from the configuration
    const requiredFields = groupOnboardingFlow.agenticSettings.userFields
      .filter(field => field.required)
      .map(field => field.id);
      
    const optionalFields = groupOnboardingFlow.agenticSettings.userFields
      .filter(field => !field.required)
      .map(field => field.id);
    
    // All fields that need to be processed during onboarding  
    const allPendingFields = [...requiredFields, ...optionalFields];
    
    console.log(`[Group Onboarding] Starting onboarding with fields:`, { 
      requiredFields, 
      optionalFields,
      allPendingFields
    });
      
    // Update chat metadata with a cleaner, more logical structure
    const success = await adapter.updateChatMetadata(supabaseChatId, {
      ...existingMetadata,
      // Group info will contain all the collected data
      group_info: {
        ...existingMetadata.group_info || {},
        // Each field will be populated as users respond
      },
      // Onboarding status for tracking progress
      onboarding: {
        in_progress: true,
        start_time: new Date().toISOString(),
        completed: false,
        // Track which fields have been collected
        fields_pending: allPendingFields,
        fields_collected: [],
      }
    });
    
    return success;
  } catch (error) {
    console.error('[Group Onboarding] Error marking group onboarding as started:', error);
    return false;
  }
}

/**
 * Mark a group chat as fully onboarded in the database
 * This should only be called after all required fields are collected
 * @param chatId Supabase chat ID 
 * @returns Promise<boolean> indicating if the update was successful
 */
async function markGroupAsOnboarded(supabaseChatId: string): Promise<boolean> {
  try {
    // Add to in-memory cache
    onboardedGroupChatsCache.add(supabaseChatId);
    
    // Update database
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error('[Group Onboarding] Database adapter not initialized');
      return false;
    }
    
    // Get existing metadata to preserve all values
    const thread = await adapter.getThread(supabaseChatId);
    const existingMetadata = thread?.metadata || {};
    const existingGroupInfo = existingMetadata.group_info || {};
    const existingOnboarding = existingMetadata.onboarding || {};
    
    // Update chat metadata to mark onboarding as complete while preserving collected data
    const success = await adapter.updateChatMetadata(supabaseChatId, {
      ...existingMetadata,
      group_info: existingGroupInfo,
      onboarding: {
        ...existingOnboarding,
        in_progress: false,
        completed: true,
        completion_time: new Date().toISOString(),
      }
    });
    
    return success;
  } catch (error) {
    console.error('[Group Onboarding] Error marking group as onboarded:', error);
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
/**
 * Data type for tracking field status during onboarding
 */
interface OnboardingField {
  id: string;
  required: boolean;
  prompt: string;
  collected: boolean;
  value?: string;
}

/**
 * Check if a group chat is currently in the onboarding state
 * @param thread_id The thread ID to check
 * @returns Promise<boolean> indicating if the chat is in onboarding state
 */
export async function isGroupInOnboardingState(thread_id: string): Promise<boolean> {
  try {
    // Skip if this is not a thread ID
    if (!thread_id) {
      return false;
    }
    
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return false;
    }
    
    // Get thread from database to check its onboarding status
    const thread = await adapter.getThread(thread_id);
    if (!thread) {
      return false;
    }
    
    // Check if onboarding is in progress but not completed
    return !!thread.metadata?.onboarding?.in_progress && !thread.metadata?.onboarding?.completed;
  } catch (error) {
    console.error('[Group Onboarding] Error checking if group is in onboarding state:', error);
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
    // Skip if this is from the agent (to prevent loops)
    if (payload.sender_number === process.env.A1BASE_AGENT_NUMBER) {
      return false;
    }
    
    console.log(`[Group Onboarding] Processing potential onboarding response from ${payload.sender_number}`);
    
    // Get database adapter
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error('[Group Onboarding] Database adapter not initialized');
      return false;
    }
    
    // Get thread details
    const thread = await adapter.getThread(payload.thread_id);
    if (!thread || !thread.id) {
      console.error(`[Group Onboarding] Could not find thread in database: ${payload.thread_id}`);
      return false;
    }
    
    // Check if this thread is currently in onboarding
    if (!thread.metadata?.onboarding?.in_progress || thread.metadata?.onboarding?.completed) {
      console.log(`[Group Onboarding] Thread is not in active onboarding state: ${payload.thread_id}`);
      return false;
    }
    
    // Get latest user message text
    const messageText = typeof payload.message_content === 'string' 
      ? payload.message_content 
      : payload.message_content?.text || '';
    
    if (!messageText.trim()) {
      console.log(`[Group Onboarding] Empty message, skipping onboarding processing`);
      return false;
    }
    
    // Get pending fields
    const pendingFields = thread.metadata.onboarding.fields_pending || [];
    const collectedFields = thread.metadata.onboarding.fields_collected || [];
    const groupInfo = thread.metadata.group_info || {};
    
    // Get the onboarding flow config to determine which field to process next
    const groupOnboardingFlow = await loadGroupOnboardingFlow();
    
    if (!pendingFields.length) {
      console.log(`[Group Onboarding] No pending fields, considering onboarding complete`);
      // Finish onboarding
      await completeGroupOnboarding(thread.id, payload.thread_id, groupOnboardingFlow.agenticSettings.finalMessage);
      return true;
    }
    
    // Process the most recent message as a response to the current pending field
    const currentFieldId = pendingFields[0];
    console.log(`[Group Onboarding] Processing response for field: ${currentFieldId}`);
    
    // Find the field definition from the configuration
    const fieldConfig = groupOnboardingFlow.agenticSettings.userFields.find(f => f.id === currentFieldId);
    if (!fieldConfig) {
      console.error(`[Group Onboarding] Could not find field configuration for: ${currentFieldId}`);
      return false;
    }
    
    // Update metadata with the collected field value
    const updatedGroupInfo = { ...groupInfo };
    updatedGroupInfo[currentFieldId] = messageText;
    
    // Move the field from pending to collected
    const updatedPendingFields = pendingFields.filter((id: string) => id !== currentFieldId);
    const updatedCollectedFields = [...collectedFields, currentFieldId];
    
    // Update the database with the collected value
    await adapter.updateChatMetadata(thread.id, {
      ...thread.metadata,
      group_info: updatedGroupInfo,
      onboarding: {
        ...thread.metadata.onboarding,
        fields_pending: updatedPendingFields,
        fields_collected: updatedCollectedFields,
      }
    });
    
    console.log(`[Group Onboarding] Updated field ${currentFieldId} with value: "${messageText}"`);
    
    // Check if we have more fields to collect
    if (updatedPendingFields.length > 0) {
      // Get the next field to collect
      const nextFieldId = updatedPendingFields[0];
      const nextField = groupOnboardingFlow.agenticSettings.userFields.find(f => f.id === nextFieldId);
      
      if (nextField) {
        // Send message asking for the next field
        await sendGroupOnboardingPrompt(payload.thread_id, nextField.description, nextFieldId);
        console.log(`[Group Onboarding] Sent prompt for next field: ${nextFieldId}`);
        return true;
      }
    } else {
      // All fields collected, send final message
      console.log(`[Group Onboarding] All fields collected, completing onboarding`);
      await completeGroupOnboarding(thread.id, payload.thread_id, groupOnboardingFlow.agenticSettings.finalMessage);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Group Onboarding] Error processing onboarding message:', error);
    return false;
  }
}

/**
 * Send a message to prompt for a specific onboarding field
 * Converts field descriptions into natural conversational messages
 * in an agentic, friendly style
 */
async function sendGroupOnboardingPrompt(threadId: string, fieldDescription: string, fieldId?: string): Promise<void> {
  // Create a natural conversational message based on the field type and description
  let message = '';
  
  // For specific field types, use custom messages regardless of the description
  // This ensures consistent, well-formatted questions
  if (fieldId === 'group_purpose' || fieldDescription.toLowerCase().includes('purpose') || fieldDescription.toLowerCase().includes('goal')) {
    message = "What's the main purpose or goal of this group? This will help me understand how I can best support you all."; 
  } 
  else if (fieldId === 'key_deadlines' || fieldId === 'harshness' || 
          fieldDescription.toLowerCase().includes('harsh') || 
          fieldDescription.toLowerCase().includes('rude')) {
    message = "How direct would you like me to be with the team? Should I be gentle with reminders, or more assertive to keep things on track?"; 
  }
  else if (fieldId === 'group_projects' || fieldDescription.toLowerCase().includes('project') || 
           fieldDescription.toLowerCase().includes('initiative')) {
    message = "What specific projects or initiatives is this group working on together? This will help me track progress and provide relevant assistance."; 
  }
  // Fall back to parsing the description if no specific rule matches
  else if (fieldDescription.toLowerCase().startsWith('ask')) {
    // Extract what we're asking about from the instruction
    const aboutWhat = fieldDescription.replace(/^ask\s+(about\s+|what\s+|how\s+|if\s+)?/i, '').trim();
    message = `Tell me more about ${aboutWhat}?`;
  }
  else if (fieldDescription.toLowerCase().startsWith('the ai should ask')) {
    // Handle descriptions that start with "The AI should ask"
    const aboutWhat = fieldDescription.replace(/^the\s+ai\s+should\s+ask\s+(about\s+|what\s+|how\s+|if\s+)?/i, '').trim();
    message = `${aboutWhat.charAt(0).toUpperCase() + aboutWhat.slice(1)}?`;
  }
  else {
    // If all else fails, make the description conversational
    message = `I'd like to know about ${fieldDescription.trim().toLowerCase()}. Could you share some details?`;
  }
  
  // Log the transformation for debugging
  console.log(`[Group Onboarding] Converting field ${fieldId}: "${fieldDescription}" → "${message}"`); 
  
  // Send the conversational message
  await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
    content: message,
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
): Promise<void> {
  try {
    // Get database adapter
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error('[Group Onboarding] Database adapter not initialized');
      return;
    }
    
    // Mark onboarding as complete
    await markGroupAsOnboarded(supabaseChatId);
    
    // Send final message
    await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
      content: finalMessage,
      from: process.env.A1BASE_AGENT_NUMBER!,
      thread_id: threadId,
      service: "whatsapp",
    });
    
    console.log(`[Group Onboarding] Successfully completed onboarding for group ${threadId}`);
  } catch (error) {
    console.error('[Group Onboarding] Error completing group onboarding:', error);
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
  // Only proceed if this is a group chat
  if (payload.thread_type !== "group") {
    console.log(`[Group Onboarding] Skipping non-group chat type: ${payload.thread_type}`);
    return false;
  }

  // Get database adapter
  const adapter = await getInitializedAdapter();
  if (!adapter) {
    console.error('[Group Onboarding] Database adapter not initialized');
    return false;
  }
  
  // Get the Supabase chat ID for the thread
  const thread = await adapter.getThread(payload.thread_id);
  if (!thread || !thread.id) {
    console.error(`[Group Onboarding] Could not find chat in database: ${payload.thread_id}`);
    return false;
  }
  
  // Check if this group has already been onboarded or is in progress
  const { onboardingComplete, onboardingInProgress } = await getGroupOnboardingStatus(payload.thread_id);
  
  if (onboardingComplete) {
    console.log(`[Group Onboarding] Group has already completed onboarding: ${payload.thread_id}`);
    return false;
  }
  
  if (onboardingInProgress) {
    console.log(`[Group Onboarding] Group has onboarding in progress: ${payload.thread_id}`);
    // We could continue with the next step of onboarding here if needed
    return false;
  }

  // Log whether this is a new chat (for debugging)
  console.log(`[Group Onboarding] Processing chat ${payload.thread_id}, isNewChat=${isNewChat}, Supabase ID=${thread.id}`);
  
  // We now allow onboarding for all group chats, whether new or existing
  // The only requirement is that onboarding is enabled and the group hasn't been onboarded yet

  try {
    console.log(`[Group Onboarding] 🔍 DEBUG: About to load group onboarding flow settings...`);
    
    // Load the group onboarding flow settings
    let groupOnboardingFlow;
    try {
      groupOnboardingFlow = await loadGroupOnboardingFlow();
      console.log(`[Group Onboarding] 🔍 DEBUG: Successfully loaded flow settings:`, {
        enabled: groupOnboardingFlow?.enabled,
        hasAgenticSettings: !!groupOnboardingFlow?.agenticSettings,
        hasInitialMessage: !!groupOnboardingFlow?.agenticSettings?.initialGroupMessage
      });
    } catch (loadError) {
      console.error(`[Group Onboarding] ❌ ERROR: Failed to load group onboarding flow:`, loadError);
      return false;
    }

    // Check if group onboarding is enabled
    if (!groupOnboardingFlow.enabled) {
      console.log(`[Group Onboarding] Onboarding is disabled, skipping for group ${payload.thread_id}`);
      return false;
    }
    
    console.log(`[Group Onboarding] 🔍 DEBUG: Onboarding is enabled, proceeding with onboarding process...`);

    console.log(`[Group Onboarding] Starting onboarding for new group chat: ${payload.thread_id}`);

    // Get the initial welcome message from the settings
    const welcomeMessage = groupOnboardingFlow.agenticSettings.initialGroupMessage;

    // Send the welcome message to the group chat
    await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
      content: welcomeMessage,
      from: process.env.A1BASE_AGENT_NUMBER!,
      thread_id: payload.thread_id,
      service: "whatsapp",
    });

    // Mark this group as having started onboarding in the database
    const thread = await adapter.getThread(payload.thread_id);
    if (thread && thread.id) {
      await markGroupOnboardingStarted(thread.id);
      console.log(`[Group Onboarding] Successfully marked group ${payload.thread_id} as having started onboarding`);
      
      // Get the updated thread with onboarding metadata to send the first field prompt
      const updatedThread = await adapter.getThread(payload.thread_id);
      if (updatedThread && 
          updatedThread.metadata && 
          updatedThread.metadata.onboarding && 
          updatedThread.metadata.onboarding.fields_pending && 
          updatedThread.metadata.onboarding.fields_pending.length > 0) {
        // Get the first field to collect
        const firstFieldId = updatedThread.metadata.onboarding.fields_pending[0];
        const firstField = groupOnboardingFlow.agenticSettings.userFields.find(f => f.id === firstFieldId);
        
        if (firstField) {
          // Wait a moment to let the welcome message be processed
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Send prompt for the first field
          await sendGroupOnboardingPrompt(payload.thread_id, firstField.description, firstFieldId);
          console.log(`[Group Onboarding] Sent prompt for first field: ${firstFieldId}`);
        }
      }
      
      console.log(`[Group Onboarding] Waiting for user responses to onboarding fields...`);
    } else {
      console.warn(`[Group Onboarding] Could not mark group onboarding as started, chat not found in database: ${payload.thread_id}`);
    }

    console.log(`[Group Onboarding] Successfully sent welcome message to group ${payload.thread_id}`);
    return true;
  } catch (error) {
    console.error("[Group Onboarding] Error in group chat onboarding:", error);
    return false;
  }
}
