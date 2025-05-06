/**
 * Group Chat Onboarding Workflow
 * 
 * Handles the initial onboarding process for group chats
 */
import { A1BaseAPI } from "a1base-node";
import { loadGroupOnboardingFlow } from "../onboarding-flow/group-onboarding-storage";
import { WebhookPayload } from "@/app/api/messaging/incoming/route";

// Initialize A1Base API client for sending messages
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

/**
 * Track which group chats have already been onboarded to prevent duplicate messages
 * This is an in-memory solution, so it will reset if the server restarts
 * In a future implementation, this would be persisted to the database
 */
const onboardedGroupChats = new Set<string>();

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
    return false;
  }

  // Skip if this group has already been onboarded
  if (onboardedGroupChats.has(payload.thread_id)) {
    return false;
  }

  // Only proceed if this is a new chat or we don't have a record of onboarding it
  if (!isNewChat) {
    return false;
  }

  try {
    // Load the group onboarding flow settings
    const groupOnboardingFlow = await loadGroupOnboardingFlow();

    // Check if group onboarding is enabled
    if (!groupOnboardingFlow.enabled) {
      console.log(`[Group Onboarding] Onboarding is disabled, skipping for group ${payload.thread_id}`);
      return false;
    }

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

    // Mark this group as onboarded to prevent duplicate welcome messages
    onboardedGroupChats.add(payload.thread_id);

    console.log(`[Group Onboarding] Successfully sent welcome message to group ${payload.thread_id}`);
    return true;
  } catch (error) {
    console.error("[Group Onboarding] Error in group chat onboarding:", error);
    return false;
  }
}
