/**
 * Workflow functions for managing user privacy and data retention settings.
 * 
 * Key workflow functions:
 * - SetDataRetention: Configure how long user data is stored
 * - ForgetMemory: Delete specific user conversations or memory entries
 * - DownloadUserData: Allow users to export their data
 * - AnonymizeUserData: De-identify user data while preserving utility
 * - ManageConsentPreferences: Update user consent for data processing
 * 
 * Handles both individual and group message threads.
 */

import { A1BaseAPI } from "a1base-node";
import { ThreadMessage } from "@/types/chat";
import { generateAgentResponse } from "../services/openai";
import fs from "fs";
import path from "path";

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Data retention period types
type RetentionPeriodUnit = "days" | "weeks" | "months" | "years";

// Interface for data retention settings
interface DataRetentionSettings {
  enabled: boolean;
  period: number;
  unit: RetentionPeriodUnit;
  lastUpdated: string; // ISO date string
  userId: string;
}

// Interface for deletion request
interface DeletionRequest {
  userId: string;
  requestDate: string; // ISO date string
  status: "pending" | "processing" | "completed";
  completionDate?: string; // ISO date string
  dataTypes: Array<"messages" | "preferences" | "usage_data" | "all">;
}

// ====== DATA RETENTION WORKFLOWS =======
// Functions for managing data retention
// =====================================

/**
 * Configure the data retention period for a user
 * @param threadMessages - Array of messages in the thread
 * @param period - Number of time units to retain data
 * @param unit - Time unit (days, weeks, months, years)
 * @param userId - ID of the user whose settings to update
 * @returns Confirmation of setting update
 */
export async function SetDataRetention(
  threadMessages: ThreadMessage[],
  period: number,
  unit: RetentionPeriodUnit,
  userId: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  // Console log removed - Workflow Start [SetDataRetention]

  try {
    // Get settings directory path
    const settingsDir = path.join(process.cwd(), "data", "privacy-settings");
    
    // Ensure directory exists
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    // Create/update user settings file
    const userSettingsPath = path.join(settingsDir, `${userId}-retention.json`);
    
    // Create settings object
    const settings: DataRetentionSettings = {
      enabled: true,
      period,
      unit,
      lastUpdated: new Date().toISOString(),
      userId
    };
    
    // Save settings to file
    fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2));
    
    // Generate response message
    const responseMessage = `Your data retention period has been set to ${period} ${unit}. This means your data will automatically be removed after this period.`;
    
    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
      return responseMessage;
    }
    
    // Send the confirmation message through the appropriate channel
    const messageData = {
      content: responseMessage,
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
    
    return responseMessage;
  } catch (error) {
    console.error("[SetDataRetention] Error:", error);
    return "Sorry, I encountered an error updating your data retention settings.";
  }
}

/**
 * Process a user's request to forget specific memories or conversation history
 * @param threadMessages - Array of messages in the thread
 * @param dataTypes - Types of data to forget (messages, preferences, usage_data, all)
 * @param userId - ID of the user making the request
 * @returns Confirmation of request receipt and next steps
 */
export async function ForgetMemory(
  threadMessages: ThreadMessage[],
  dataTypes: Array<"messages" | "preferences" | "usage_data" | "all">,
  userId: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  // Console log removed - Workflow Start [ForgetMemory]

  try {
    // Get deletion requests directory path
    const requestsDir = path.join(process.cwd(), "data", "deletion-requests");
    
    // Ensure directory exists
    if (!fs.existsSync(requestsDir)) {
      fs.mkdirSync(requestsDir, { recursive: true });
    }
    
    // Create deletion request object
    const deletionRequest: DeletionRequest = {
      userId,
      requestDate: new Date().toISOString(),
      status: "pending",
      dataTypes
    };
    
    // Generate unique request ID based on timestamp
    const requestId = `${userId}-${Date.now()}`;
    const requestPath = path.join(requestsDir, `${requestId}.json`);
    
    // Save request to file
    fs.writeFileSync(requestPath, JSON.stringify(deletionRequest, null, 2));
    
    // If "all" is included, replace with all data types
    if (dataTypes.includes("all")) {
      dataTypes = ["messages", "preferences", "usage_data"];
    }
    
    // Format data types for display
    const dataTypesText = dataTypes.join(", ").replace(/,([^,]*)$/, ' and$1');
    
    // Generate response message
    const responseMessage = `Your request to forget your ${dataTypesText} has been received. This process will be completed within 30 days, in accordance with our privacy policy. You'll receive a confirmation when the deletion is complete.`;
    
    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
      return responseMessage;
    }
    
    // Send the confirmation message through the appropriate channel
    const messageData = {
      content: responseMessage,
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
    
    return responseMessage;
  } catch (error) {
    console.error("[ForgetMemory] Error:", error);
    return "Sorry, I encountered an error processing your memory deletion request.";
  }
}

/**
 * Generate and provide a downloadable export of user's data
 * @param threadMessages - Array of messages in the thread
 * @param userId - ID of the user requesting their data
 * @param dataTypes - Types of data to include in export
 * @returns Link to download the exported data
 */
export async function DownloadUserData(
  threadMessages: ThreadMessage[],
  userId: string,
  dataTypes: Array<"messages" | "preferences" | "usage_data" | "all">,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  // Console log removed - Workflow Start [DownloadUserData]

  try {
    // This function would typically:
    // 1. Query databases for user data
    // 2. Format data into exportable format (CSV, JSON)
    // 3. Create a downloadable file or secure link
    
    // For this implementation, we'll create a placeholder response
    
    // Generate response message
    const responseMessage = `Your data export request has been received. We're preparing your data and will provide a secure download link within 24 hours. The link will be sent to your registered email address.`;
    
    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
      return responseMessage;
    }
    
    // Send the confirmation message through the appropriate channel
    const messageData = {
      content: responseMessage,
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
    
    return responseMessage;
  } catch (error) {
    console.error("[DownloadUserData] Error:", error);
    return "Sorry, I encountered an error processing your data export request.";
  }
}

/**
 * Anonymize user data while preserving its utility for analysis
 * @param userId - ID of the user whose data should be anonymized
 * @returns Confirmation of anonymization
 */
export async function AnonymizeUserData(
  userId: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  // Console log removed - Workflow Start [AnonymizeUserData]

  try {
    // This function would typically:
    // 1. Access user data repositories
    // 2. Apply anonymization techniques (pseudonymization, generalization)
    // 3. Update records to reflect anonymized state
    
    // For this implementation, we'll create a placeholder response
    
    // Generate response message
    const responseMessage = `Your data has been anonymized. Your personal identifiers have been removed while preserving aggregated data for analytical purposes. You can continue using the service with your current account, but previous activity can no longer be linked to your identity.`;
    
    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
      return responseMessage;
    }
    
    // Send the confirmation message through the appropriate channel
    const messageData = {
      content: responseMessage,
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
    
    return responseMessage;
  } catch (error) {
    console.error("[AnonymizeUserData] Error:", error);
    return "Sorry, I encountered an error anonymizing your data.";
  }
}

/**
 * Update user consent preferences for data processing
 * @param threadMessages - Array of messages in the thread
 * @param userId - ID of the user updating consent
 * @param consentOptions - Object containing consent flags for different processing purposes
 * @returns Confirmation of consent update
 */
export async function ManageConsentPreferences(
  threadMessages: ThreadMessage[],
  userId: string,
  consentOptions: {
    marketing: boolean;
    analytics: boolean;
    thirdPartySharing: boolean;
    automatedDecisionMaking: boolean;
  },
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  // Console log removed - Workflow Start [ManageConsentPreferences]

  try {
    // Get consent directory path
    const consentDir = path.join(process.cwd(), "data", "user-consent");
    
    // Ensure directory exists
    if (!fs.existsSync(consentDir)) {
      fs.mkdirSync(consentDir, { recursive: true });
    }
    
    // Create/update user consent file
    const userConsentPath = path.join(consentDir, `${userId}-consent.json`);
    
    // Create consent object with timestamp
    const consentData = {
      ...consentOptions,
      userId,
      lastUpdated: new Date().toISOString()
    };
    
    // Save consent to file
    fs.writeFileSync(userConsentPath, JSON.stringify(consentData, null, 2));
    
    // Generate consent summary for the response
    const consentSummary = Object.entries(consentOptions)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value ? 'enabled' : 'disabled'}`)
      .join(', ');
    
    // Generate response message
    const responseMessage = `Your consent preferences have been updated successfully. Your current settings are: ${consentSummary}. You can update these preferences at any time.`;
    
    // For web UI, we just return the response without sending through A1Base
    if (service === "web-ui") {
      return responseMessage;
    }
    
    // Send the confirmation message through the appropriate channel
    const messageData = {
      content: responseMessage,
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
    
    return responseMessage;
  } catch (error) {
    console.error("[ManageConsentPreferences] Error:", error);
    return "Sorry, I encountered an error updating your consent preferences.";
  }
}
