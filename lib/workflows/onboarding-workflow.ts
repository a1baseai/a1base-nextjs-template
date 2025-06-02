/**
 * Onboarding workflow functionality
 * Handles the process of introducing new users to the system
 * through guided conversation flows.
 */

import { A1BaseAPI } from "a1base-node";
import { ThreadMessage } from "@/types/chat";
import { loadOnboardingFlow } from "../onboarding-flow/onboarding-storage";
import { OnboardingFlow } from "../onboarding-flow/types";
import { SupabaseAdapter } from "../supabase/adapter";
import { getInitializedAdapter } from "../supabase/config";
import { generateAgentResponse } from "../services/openai";
import OpenAI from "openai";
import { formatMessagesForOpenAI } from "../services/openai";

// Initialize A1Base client
const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract already collected onboarding field values from the conversation history
 * @param threadMessages The conversation thread messages
 * @param onboardingFlow The onboarding flow configuration
 * @returns An object containing the collected field values
 */
export function extractCollectedFields(
  threadMessages: ThreadMessage[],
  onboardingFlow: OnboardingFlow
): Record<string, any> {
  const collectedData: Record<string, any> = {};
  
  if (!onboardingFlow.agenticSettings) {
    return collectedData;
  }

  console.log('[extractCollectedFields] Starting extraction from', threadMessages.length, 'messages');
  
  // Debug: Log all messages to see what we're working with
  console.log('[extractCollectedFields] All messages:');
  threadMessages.forEach((msg, index) => {
    console.log(`  [${index}] role: ${msg.role}, sender: ${msg.sender_number}, content: "${msg.content.substring(0, 80)}..."`);
  });
  
  // Go through messages to find what fields have been collected
  const fields = onboardingFlow.agenticSettings.userFields;
  
  // Look for assistant questions followed by user responses
  for (let i = 0; i < threadMessages.length - 1; i++) {
    const currentMsg = threadMessages[i];
    const nextMsg = threadMessages[i + 1];
    
    // Log each message pair for debugging
    if (currentMsg.role === 'assistant' && nextMsg.role === 'user') {
      console.log(`[extractCollectedFields] Found assistant->user pair at index ${i}`);
      console.log(`[extractCollectedFields] Assistant[${i}]: "${currentMsg.content.substring(0, 100)}..."`);
      console.log(`[extractCollectedFields] User[${i+1}]: "${nextMsg.content}"`);
      
      const assistantText = currentMsg.content.toLowerCase();
      const userResponse = nextMsg.content.trim();
      
      // Check if asking for name - be more flexible with patterns
      if (!collectedData.name && 
          (assistantText.includes('full name') || 
           assistantText.includes('your name') ||
           assistantText.includes('tell me your name') ||
           assistantText.includes('share your name') ||
           assistantText.includes('what is your name') ||
           assistantText.includes("what's your name") ||
           assistantText.includes('can i have your'))) {
        collectedData.name = userResponse;
        console.log('[extractCollectedFields] Extracted name:', userResponse);
      }
      // Check if asking for email - only after we have a name
      else if (collectedData.name && !collectedData.email &&
               (assistantText.includes('email') || 
                assistantText.includes('e-mail') ||
                assistantText.includes('email address') ||
                assistantText.includes('your email'))) {
        // Basic email validation
        if (userResponse.includes('@')) {
          collectedData.email = userResponse;
          console.log('[extractCollectedFields] Extracted email:', userResponse);
        }
      }
      // Check if asking for big dream - only after we have name and email
      else if (collectedData.name && collectedData.email && !collectedData.big_dream &&
               (assistantText.includes('dream') || 
                assistantText.includes('goal') || 
                assistantText.includes('vision') ||
                assistantText.includes('aspiration') ||
                assistantText.includes('project') ||
                assistantText.includes('startup'))) {
        collectedData.big_dream = userResponse;
        console.log('[extractCollectedFields] Extracted big dream:', userResponse);
      }
    } else if (i < threadMessages.length - 1) {
      console.log(`[extractCollectedFields] Skipping pair at index ${i}: ${currentMsg.role}->${nextMsg.role}`);
    }
  }
  
  console.log('[extractCollectedFields] Final collected fields:', collectedData);
  return collectedData;
}

/**
 * Creates a system prompt for onboarding based on the onboarding settings
 *
 * @param onboardingFlow The complete onboarding flow configuration
 * @param existingData Optional. An object containing already collected user data.
 * @returns The formatted system prompt for the AI
 */
export function createAgenticOnboardingPrompt(
  onboardingFlow: OnboardingFlow,
  existingData?: Record<string, any>
): string {
  if (!onboardingFlow.agenticSettings) {
    throw new Error("Agentic settings not available in the onboarding flow");
  }

  // Use the configured system prompt for onboarding
  const systemPrompt = onboardingFlow.agenticSettings.systemPrompt;

  // Filter userFields to only include those not yet collected or empty
  const fieldsToCollect = onboardingFlow.agenticSettings.userFields.filter(
    (field) => {
      return (
        !existingData ||
        !existingData[field.id] ||
        existingData[field.id] === ""
      );
    }
  );

  // If all required fields are collected (or no fields were defined to be collected),
  // instruct AI to use the final message.
  if (fieldsToCollect.length === 0) {
    return `${systemPrompt}\n\nAll required information has been collected. Now, respond with: ${onboardingFlow.agenticSettings.finalMessage}`;
  }

  console.log("[Onboarding] Fields to collect:", fieldsToCollect);
  console.log("[Onboarding] Existing data:", existingData);

  // Get only the first field to collect for a more natural conversation
  const nextField = fieldsToCollect[0];
  const fieldInstruction = `${nextField.description}${nextField.required ? " (this is required)" : ""}`;

  // Add context about what we've already collected
  let contextInfo = "";
  if (existingData && Object.keys(existingData).length > 0) {
    contextInfo = "\n\nYou have already collected the following information:";
    if (existingData.name) contextInfo += `\n- Name: ${existingData.name}`;
    if (existingData.email) contextInfo += `\n- Email: ${existingData.email}`;
    if (existingData.big_dream) contextInfo += `\n- Big Dream: ${existingData.big_dream}`;
  }

  // Determine what specific question to ask based on the field
  let specificQuestion = "";
  if (nextField.id === "name") {
    specificQuestion = "What is your full name?";
  } else if (nextField.id === "email") {
    specificQuestion = "What is your email address?";
  } else if (nextField.id === "big_dream") {
    specificQuestion = "What's your biggest dream for your project or startup?";
  } else {
    specificQuestion = `Please provide your ${nextField.label || nextField.id}.`;
  }

  // Combine system prompt with instruction to ask for just the next field
  const aiPrompt = `${systemPrompt}

You are currently onboarding a new user. ${contextInfo}

Your task now is to ask for the following information in a natural, conversational way:
${fieldInstruction}

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ask for the ${nextField.label || nextField.id} specifically
2. Your response MUST include a question asking for their ${nextField.label || nextField.id}
3. Ask for ONLY this one piece of information
4. Be friendly and acknowledge the user's previous response if applicable
5. Do NOT skip ahead or ask about anything else
6. Do NOT provide generic statements about "getting started" or "diving in" or "next steps"
7. Do NOT say things like "Let's continue" or "Let's proceed" without asking the specific question

REQUIRED: Your response MUST end with this exact question (you can add friendly context before it):
"${specificQuestion}"

Example good responses:
- "Thanks for that! ${specificQuestion}"
- "Great to hear from you! ${specificQuestion}"
- "I appreciate you sharing that. ${specificQuestion}"

${fieldsToCollect.length === 1 ? `\nAfter collecting this last piece of information, respond with: ${onboardingFlow.agenticSettings.finalMessage}` : ''}`;

  console.log("[Onboarding] Generated agentic onboarding prompt for field:", nextField.id);
  console.log("[Onboarding] Specific question to ask:", specificQuestion);

  return aiPrompt;
}

/**
 * Generate a conversational onboarding message using OpenAI
 * @param systemPrompt The system prompt containing onboarding instructions
 * @param threadMessages The conversation thread messages for context
 * @param userMessage The user's actual message
 * @param service The service being used
 * @returns A conversational, user-friendly onboarding message
 */
async function generateOnboardingMessage(
  systemPrompt: string,
  threadMessages: ThreadMessage[],
  userMessage: string,
  service?: string
): Promise<string> {
  console.log("[generateOnboardingMessage] Function started");
  console.log("[generateOnboardingMessage] System prompt preview (first 500 chars):", systemPrompt.substring(0, 500) + "...");
  console.log("[generateOnboardingMessage] User message:", userMessage);
  console.log("[generateOnboardingMessage] Thread messages count:", threadMessages.length);
  
  try {
    console.log("[generateOnboardingMessage] Preparing to call OpenAI directly for onboarding");
    
    // Format messages for OpenAI
    const formattedMessages = formatMessagesForOpenAI(threadMessages, "individual");
    
    // Add a more explicit user message to reinforce the onboarding context
    const messages = [
      {
        role: "system" as const,
        content: systemPrompt, // This contains the onboarding instructions
      },
      ...formattedMessages,
    ];
    
    // If this is continuing onboarding, add an assistant message to reinforce the context
    if (formattedMessages.length > 0) {
      // Add a system reminder about the onboarding task
      messages.push({
        role: "system" as const,
        content: "REMINDER: You are in the middle of onboarding. Follow the instructions above and ask the specific question required. Do not give generic responses."
      });
    }
    
    console.log("[generateOnboardingMessage] Calling OpenAI with", messages.length, "messages");
    
    // Call OpenAI directly with the onboarding system prompt
    // This ensures the onboarding instructions take priority
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3, // Lower temperature for more consistent responses
    });

    const generatedMessage = response.choices[0]?.message?.content;
    
    console.log("[generateOnboardingMessage] Response received from OpenAI");
    console.log("[generateOnboardingMessage] Generated onboarding message:", generatedMessage);
    
    if (!generatedMessage) {
      console.log("[generateOnboardingMessage] No message generated, using fallback");
      return "Hello! I'm your assistant. To get started, could you please tell me your name?";
    }
    
    // Validate that the response contains a question if we're expecting one
    const lowerMessage = generatedMessage.toLowerCase();
    const containsQuestion = generatedMessage.includes('?');
    const containsExpectedTerms = lowerMessage.includes('name') || lowerMessage.includes('email') || lowerMessage.includes('dream');
    
    if (!containsQuestion || !containsExpectedTerms) {
      console.warn("[generateOnboardingMessage] Generated message may not contain expected question. Adding explicit question.");
      // Extract what field we're asking for from the system prompt
      if (systemPrompt.includes('"What is your full name?"')) {
        return generatedMessage + "\n\nWhat is your full name?";
      } else if (systemPrompt.includes('"What is your email address?"')) {
        return generatedMessage + "\n\nWhat is your email address?";
      } else if (systemPrompt.includes('"What\'s your biggest dream')) {
        return generatedMessage + "\n\nWhat's your biggest dream for your project or startup?";
      }
    }
    
    return generatedMessage;
  } catch (error) {
    console.error('[generateOnboardingMessage] Error generating onboarding message:', error);
    console.log('[generateOnboardingMessage] Using fallback message due to error');
    return "Hello! I'm your assistant. To help you get set up, could you please tell me your name?";
  }
}

/**
 * Handles the onboarding flow when triggered by "Start onboarding"
 * Creates an AI-powered onboarding experience where the AI guides the conversation
 * @returns A structured onboarding response with a user-friendly message
 */
export async function StartOnboarding(
  threadMessages: ThreadMessage[],
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string,
  chatId?: string
): Promise<{ messages: { text: string; waitForResponse: boolean }[] }> {
  console.log(`[StartOnboarding] Called with thread_id: ${thread_id}, chat_id: ${chatId}, thread_type: ${thread_type}, messages count: ${threadMessages.length}`);

  try {
    // Safely load the onboarding flow
    const onboardingFlow = await loadOnboardingFlow();
    console.log(`[StartOnboarding] Onboarding flow loaded. Enabled: ${onboardingFlow.enabled}`);

    // If onboarding is disabled, just skip
    if (!onboardingFlow.enabled) {
      console.log(`[StartOnboarding] Onboarding is disabled in configuration`);
      return { messages: [] };
    }

    console.log(`[StartOnboarding] Onboarding is enabled, proceeding...`);

    // Extract already collected data from the conversation
    const collectedData = extractCollectedFields(threadMessages, onboardingFlow);
    console.log(`[StartOnboarding] Already collected data:`, collectedData);

    // Create the system prompt for onboarding with existing data
    const systemPrompt = createAgenticOnboardingPrompt(onboardingFlow, collectedData);
    console.log(`[StartOnboarding] System prompt created`);

    // Extract the user's actual message if available
    const userMessage = threadMessages.length > 0 && threadMessages[threadMessages.length - 1].role === "user"
      ? threadMessages[threadMessages.length - 1].content
      : "Hello!";

    // Generate a conversational message using the system prompt and user's actual message
    const conversationalMessageText = await generateOnboardingMessage(
      systemPrompt,
      threadMessages,
      userMessage,
      service
    );

    // Create a single message with the conversational prompt
    const onboardingMessage = {
      text: conversationalMessageText,
      waitForResponse: true,
    };

    // Return the conversational message for the web UI or other channels
    return { messages: [onboardingMessage] };
  } catch (error) {
    console.error("Error in onboarding workflow:", error);
    const errorMessage =
      "Sorry, I encountered an error starting the onboarding process.";

    // Handle error similarly to DefaultReplyToMessage
    if (service !== "web-ui" && service !== "__skip_send") {
      const errorMessageData = {
        content: errorMessage,
        from: process.env.A1BASE_AGENT_NUMBER!,
        service: "whatsapp" as const,
      };

      if (thread_type === "group" && thread_id) {
        await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...errorMessageData,
          thread_id,
        });
      } else if (thread_type === "individual" && sender_number) {
        await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
          ...errorMessageData,
          to: sender_number,
        });
      }
    }

    return { messages: [{ text: errorMessage, waitForResponse: false }] };
  }
}
