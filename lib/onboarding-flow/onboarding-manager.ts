import { OnboardingFlow } from './types';
import { loadOnboardingFlow } from './onboarding-storage';
import { getInitializedAdapter } from '../supabase/config';
import { ThreadMessage } from '@/types/chat';
import { generateAgentResponse } from '../services/openai';

interface OnboardingUserMetadata {
  onboarding_questions?: Record<string, string>;
  current_onboarding_question?: string;
  onboarding_complete?: boolean;
}

/**
 * Checks if onboarding is needed for a user based on their phone number
 * 
 * @param phone_number The user's phone number to check (from webhook sender_number)
 * @param thread_id Optional thread_id for context (external id from webhook)
 * @returns Object with user_id, need_onboarding flag, and metadata
 */
export async function checkOnboardingStatus(phone_number: string, thread_id?: string): Promise<{
  user_id: string | null;
  need_onboarding: boolean;
  metadata: OnboardingUserMetadata | null;
  is_individual_chat: boolean;
}> {
  // Normalize phone number by removing '+' if present
  const normalizedPhoneNumber = phone_number.startsWith('+') ? phone_number.substring(1) : phone_number;
  
  console.log(`[Onboarding] Checking onboarding status for phone number ${normalizedPhoneNumber}`);
  
  // Default response
  const defaultResponse = {
    user_id: null,
    need_onboarding: true, // Default to needing onboarding for new users
    metadata: null,
    is_individual_chat: true // Assume individual chat when looking up by phone number
  };
  
  try {
    const adapter = await getInitializedAdapter();
    // Log more detailed adapter information
    console.log(`[Onboarding] Adapter initialized: ${!!adapter}`, {
      adapterType: adapter ? 'SupabaseAdapter' : 'None',
      phoneNumber: normalizedPhoneNumber,
      threadId: thread_id || 'none'
    });
    
    if (!adapter) {
      console.log('[Onboarding] No database adapter, skipping onboarding check');
      return defaultResponse;
    }
    
    // Explicitly initialize the database to ensure adapter is ready
    const { initializeDatabase } = require('../supabase/config');
    await initializeDatabase();

    try {
      // Look up the user based on phone number
      console.log(`[Onboarding] Searching for user with phone number: ${normalizedPhoneNumber}`);
      
      // Get all users to find the one with matching phone number
      const users = await adapter.getUsers();
      
      if (!users || users.length === 0) {
        console.log('[Onboarding] No users found in database');
        return defaultResponse; // New user needs onboarding
      }
      
      // Find the user with matching phone number - handle different formats (+1234 vs 1234)
      const matchingUser = users.find((user: any) => {
        if (!user || !user.phone_number) return false;
        
        const userPhone = user.phone_number.toString();
        const normalizedUserPhone = userPhone.startsWith('+') ? userPhone.substring(1) : userPhone;
        const phoneWithPlus = '+' + normalizedPhoneNumber;
        
        return normalizedUserPhone === normalizedPhoneNumber || 
               userPhone === normalizedPhoneNumber || 
               userPhone === phoneWithPlus;
      });
      
      if (!matchingUser) {
        console.log(`[Onboarding] No user found with phone number ${normalizedPhoneNumber}`);
        return defaultResponse; // New user needs onboarding
      }
      
      // We found the user - now check if they need onboarding
      const user_id = matchingUser.id;
      console.log(`[Onboarding] Found user with ID ${user_id} for phone number ${normalizedPhoneNumber}`);
      
      // Get user metadata to see if onboarding is needed
      let metadata = matchingUser.metadata || {};
      
      // Check if onboarding is needed - if metadata exists and onboarding_complete is true, they don't need onboarding
      const needOnboarding = !metadata || !metadata.onboarding_complete;
      
      return {
        user_id,
        need_onboarding: needOnboarding,
        metadata: metadata as OnboardingUserMetadata || null,
        is_individual_chat: true // Assume individual chat since we're looking up by phone number
      };
      
    } catch (error) {
      console.error(`[Onboarding] Error checking onboarding status:`, error);
      return defaultResponse;
    }
  } catch (error) {
    console.error(`[Onboarding] Unexpected error:`, error);
    return defaultResponse;
  }
}

/**
 * Updates onboarding metadata for a user
 * 
 * @param user_id The user ID to update
 * @param metadata The metadata to save
 * @returns Success flag
 */
export async function updateUserOnboardingMetadata(user_id: string, metadata: OnboardingUserMetadata): Promise<boolean> {
          user_id = userInfo.user_id || null;
          console.log(`[Onboarding] Found user from thread participants: ${user_id}`);
        }
      } else {
        console.log(`[Onboarding] No participants found for chat ${chat_id}, will try alternative lookup`);
      }
      
      // If we couldn't get a user from participants, try other methods
      if (!user_id && webhookData.sender_number) {
        try {
          // Try to get user directly from Supabase using sender phone number
          const userResult = await adapter.getUserFromWebhook(
            webhookData.sender_number,
            webhookData.sender_name,
            webhookData.service
          );
          
          if (userResult) {
            user_id = userResult;
            console.log(`[Onboarding] Found user via webhook lookup: ${user_id}`);
          }
        } catch (userLookupError) {
          console.error(`[Onboarding] Error looking up user from webhook:`, userLookupError);
        }
      }
      
      // If we still couldn't get a user, we need to return default with individual chat flag
      if (!user_id) {
        console.log(`[Onboarding] Could not identify user for chat ${chat_id}`);
        return { ...defaultResponse, is_individual_chat: true };
      }
      
      // Try to get user metadata directly from the database
      let userMetadata: OnboardingUserMetadata = { onboarding_complete: false };
      
      try {
        // Try to get user metadata from the database
        try {
          // Try to get user details by phone number if available
          if (webhookData.sender_number) {
            const userDetails = await adapter.getUserByPhone(webhookData.sender_number.replace(/\+/g, ""));
            
            if (userDetails && typeof userDetails === 'object' && userDetails.metadata) {
              userMetadata = userDetails.metadata as OnboardingUserMetadata;
              console.log(`[Onboarding] Got user metadata from getUserByPhone:`, userMetadata);
            }
          }
          
          // If we still don't have metadata and we have the user ID,
          // we unfortunately can't get more metadata without additional methods
          if (!userMetadata.onboarding_complete && user_id) {
            // Set some reasonable defaults if we can't get actual metadata
            console.log(`[Onboarding] Using default metadata for user ${user_id} since no method available to get metadata`);
            userMetadata = {
              onboarding_complete: false,
              onboarding_questions: {},
              current_onboarding_question: ''
            };
          }
        } catch (webhookError) {
          console.error(`[Onboarding] Error retrieving user metadata:`, webhookError);
        }
      } catch (metadataError) {
        console.error(`[Onboarding] Error getting user metadata:`, metadataError);
        // Continue with default metadata
      }
      
      // Step 5: Check if onboarding is enabled in configuration
      const onboardingConfig = await loadOnboardingFlow();
      const onboardingEnabled = onboardingConfig.enabled === true;
      
      // Step 6: Determine if onboarding is needed based on metadata and config
      const onboardingComplete = userMetadata.onboarding_complete === true;
      const needOnboarding = onboardingEnabled && 
        (onboardingComplete === false || userMetadata.onboarding_complete === undefined);
      
      // Debug log
      console.log(`[Onboarding] Status check for ${user_id}:`, {
        onboardingComplete,
        onboardingEnabled,
        userMetadata
      });
      
      return {
        user_id,
        need_onboarding: needOnboarding,
        metadata: userMetadata,
        is_individual_chat: true
      };
    } catch (error) {
      console.error(`[Onboarding] Error checking chat data:`, error);
      return defaultResponse;
    }

    // The outer try-catch is for catching any errors not handled by the inner try-catch
    // This ensures we don't have uncaught exceptions
  } catch (error) {
    console.error('[Onboarding] Error checking onboarding status:', error);
    return defaultResponse;
  }
}

/**
 * Process a user message during onboarding to extract answers and determine next steps
 * 
 * @param user_id The user ID to update
 * @param metadata The current user metadata
 * @param message The message from the user
 * @returns Updated metadata and AI response
 */
export async function processOnboardingMessage(
  user_id: string,
  metadata: OnboardingUserMetadata | null,
  message: string,
  threadMessages: ThreadMessage[]
): Promise<{
  metadata: OnboardingUserMetadata;
  response: string;
  onboarding_complete: boolean;
}> {
  console.log(`[Onboarding] Processing onboarding message for user ${user_id}`);
  
  try {
    // Load onboarding flow configuration
    const onboardingFlow = await loadOnboardingFlow();
    const { userFields, systemPrompt, finalMessage } = onboardingFlow.agenticSettings;
    
    // Initialize metadata if it doesn't exist
    if (!metadata) metadata = {};
    if (!metadata.onboarding_questions) metadata.onboarding_questions = {};
    
    // Get the current question or set to the first one if not set
    let currentQuestionId = metadata.current_onboarding_question;
    if (!currentQuestionId) {
      currentQuestionId = userFields[0]?.id;
      metadata.current_onboarding_question = currentQuestionId;
    }
    
    // Find the current field definition
    const currentField = userFields.find(field => field.id === currentQuestionId);
    if (!currentField) {
      console.error(`[Onboarding] Field not found: ${currentQuestionId}`);
      return {
        metadata: {
          ...metadata,
          onboarding_complete: true
        },
        response: "I couldn't process your information properly. Let's continue with our conversation.",
        onboarding_complete: true
      };
    }
    
    // Create a more precise prompt to extract the answer from the user's message
    // with field-specific validation rules
    let validationRules = '';
    
    // Add field-specific validation rules
    switch (currentField.id) {
      case 'email':
        validationRules = 'Make sure it is a valid email format (contains @ and a domain). Extract just the email address without any additional text.';
        break;
      case 'name':
        validationRules = 'Extract the full name. If only a first name is provided, that is acceptable. Remove any salutations or titles.';
        break;
      case 'business_type':
        validationRules = 'Extract the business type or industry. Normalize common industry terms (e.g., "tech" → "Technology"). Be concise.';
        break;
      case 'goals':
        validationRules = 'Extract a concise version of their goals or what they want to achieve. Limit to 1-2 sentences maximum.';
        break;
      default:
        validationRules = 'Extract the specific answer to the question without any additional text.';
    }
    
    const extractionPrompt = `
You are a precise data extraction assistant processing user responses during onboarding.

Field: ${currentField.label} (${currentField.id})
Field Description: ${currentField.description}
Required: ${currentField.required ? 'Yes' : 'No'}
User Response: "${message}"

Your Task: Extract ONLY the specific data requested. ${validationRules}

Rules:
1. Return ONLY the extracted data with no additional text
2. If you cannot extract a valid answer, respond with EXACTLY "INVALID_RESPONSE"
3. Do not add explanations, confirmations, or any other text
4. Be concise and precise
    `.trim();
    
    // Generate a series of messages for extraction
    // Create a properly formatted ThreadMessage for system message
    const systemMessage: ThreadMessage = {
      role: 'system' as 'user' | 'assistant' | 'system',
      content: extractionPrompt,
      message_id: 'system_extraction',
      sender_name: 'System',
      sender_number: 'system',
      timestamp: new Date().toISOString(),
      message_type: 'text',
      message_content: { text: extractionPrompt }
    };
    
    const extractionMessages = [...threadMessages, systemMessage];
    
    // Extract the answer using the AI
    const extractedAnswer = await generateAgentResponse(
      extractionMessages,
      "Extract the answer from the user's message"
    );
    
    let isValidAnswer = extractedAnswer !== 'INVALID_RESPONSE' && extractedAnswer.trim() !== '';
    
    // Update metadata with the answer if valid
    if (isValidAnswer) {
      metadata.onboarding_questions[currentField.id] = extractedAnswer.trim();
      
      // Determine the next field to ask
      const currentIndex = userFields.findIndex(field => field.id === currentQuestionId);
      const nextField = userFields[currentIndex + 1];
      
      if (nextField) {
        // Move to the next question
        metadata.current_onboarding_question = nextField.id;
        
        // Create a more focused prompt to generate the next question
        // Add field-specific guidance based on the field type
        let fieldGuidance = '';
        switch (nextField.id) {
          case 'email':
            fieldGuidance = 'Ask for their email address specifically. Mention it will be used for communication. Be direct.';
            break;
          case 'name':
            fieldGuidance = 'Ask for their full name. Be warm but direct.';
            break;
          case 'business_type':
            fieldGuidance = 'Ask what industry or business type they work in. Provide 2-3 examples if appropriate.';
            break;
          case 'goals':
            fieldGuidance = 'Ask what specific goals they want to achieve with the AI assistant. Be specific and direct.';
            break;
          default:
            fieldGuidance = 'Ask directly for the information needed.';
        }

        const nextQuestionPrompt = `
You are conducting a focused onboarding conversation. Be professional, clear, and direct.

${systemPrompt}

Information collected so far:
${Object.entries(metadata.onboarding_questions)
  .map(([key, value]) => `- ${userFields.find(f => f.id === key)?.label || key}: ${value}`)
  .join('\n')}

Next question: ${nextField.description}
This is ${nextField.required ? 'required' : 'optional'}.

Guidance: ${fieldGuidance}

Instructions:
1. Briefly acknowledge their previous answer in 1 short sentence
2. Ask for the next piece of information directly and clearly
3. Keep your response under 2 sentences total
4. Don't explain why you're asking unless it's part of the field guidance
5. Focus on getting a clear, direct response
        `.trim();
        
        // Generate the next question with proper ThreadMessage format
        const systemMessage: ThreadMessage = {
          role: 'system' as 'user' | 'assistant' | 'system',
          content: nextQuestionPrompt,
          message_id: 'system_question',
          sender_name: 'System',
          sender_number: 'system',
          timestamp: new Date().toISOString(),
          message_type: 'text',
          message_content: { text: nextQuestionPrompt }
        };
        
        const questionMessages = [...threadMessages, systemMessage];
        
        const response = await generateAgentResponse(
          questionMessages,
          "Generate the next onboarding question"
        );
        
        return {
          metadata,
          response,
          onboarding_complete: false
        };
      } else {
        // All fields are completed
        metadata.onboarding_complete = true;
        delete metadata.current_onboarding_question;
        
        // Create a more concise and effective summary prompt for the final message
        const summaryPrompt = `
You are concluding an onboarding conversation. Be professional and direct.

${systemPrompt}

Information collected:
${Object.entries(metadata.onboarding_questions)
  .map(([key, value]) => `- ${userFields.find(f => f.id === key)?.label || key}: ${value}`)
  .join('\n')}

Instructions:
1. Provide a very brief summary (1-2 sentences) of the key information collected
2. End with exactly this message: "${finalMessage}"
3. Keep your entire response under 3 sentences
4. Be friendly but direct and professional
        `.trim();
        
        // Generate the summary message with proper ThreadMessage format
        const systemMessage: ThreadMessage = {
          role: 'system' as 'user' | 'assistant' | 'system',
          content: summaryPrompt,
          message_id: 'system_summary',
          sender_name: 'System',
          sender_number: 'system',
          timestamp: new Date().toISOString(),
          message_type: 'text',
          message_content: { text: summaryPrompt }
        };
        
        const summaryMessages = [...threadMessages, systemMessage];
        
        const response = await generateAgentResponse(
          summaryMessages,
          "Generate the onboarding completion message"
        );
        
        return {
          metadata,
          response,
          onboarding_complete: true
        };
      }
    } else if (currentField.required) {
      // If the answer is invalid and the field is required, ask again
      // Create a more direct retry prompt with field-specific guidance
      let retryGuidance = '';
      switch (currentField.id) {
        case 'email':
          retryGuidance = 'Explain that a valid email address is needed (with @ and domain). Provide a simple example like "you@example.com".';
          break;
        case 'name':
          retryGuidance = 'Ask clearly for their name. Specify you need at least their first name.';
          break;
        case 'business_type':
          retryGuidance = 'Ask specifically what industry they work in. Provide 2-3 examples like "Technology, Healthcare, Education".';
          break;
        case 'goals':
          retryGuidance = 'Ask directly what they want to accomplish with the AI assistant. Suggest they keep it brief.';
          break;
        default:
          retryGuidance = 'Ask more directly for the specific information needed.';
      }

      const retryPrompt = `
You are conducting a focused onboarding conversation. Be direct and helpful.

${systemPrompt}

Previous question: ${currentField.description}
This is required information, but I couldn't extract a clear answer from their response.

Guidance: ${retryGuidance}

Instructions:
1. Briefly acknowledge their response (1 sentence)
2. Ask for the specific information again more directly
3. Be clear about what format or type of answer you need
4. Keep your entire response under 2 sentences
      `.trim();
      
      // Generate a retry message with proper ThreadMessage format
      const systemMessage: ThreadMessage = {
        role: 'system' as 'user' | 'assistant' | 'system',
        content: retryPrompt,
        message_id: 'system_retry',
        sender_name: 'System',
        sender_number: 'system',
        timestamp: new Date().toISOString(),
        message_type: 'text',
        message_content: { text: retryPrompt }
      };
      
      const retryMessages = [...threadMessages, systemMessage];
      
      const response = await generateAgentResponse(
        retryMessages,
        "Generate a retry message for the current onboarding question"
      );
      
      return {
        metadata,
        response,
        onboarding_complete: false
      };
    } else {
      // If the answer is invalid but the field is optional, move to the next question
      const currentIndex = userFields.findIndex(field => field.id === currentQuestionId);
      const nextField = userFields[currentIndex + 1];
      
      if (nextField) {
        // Move to the next question
        metadata.current_onboarding_question = nextField.id;
        
        // Create a prompt to generate the next question
        // Create a more direct transition prompt when skipping an optional field
        let nextFieldGuidance = '';
        switch (nextField.id) {
          case 'email':
            nextFieldGuidance = 'Ask directly for their email address. Mention it is for communication purposes.';
            break;
          case 'name':
            nextFieldGuidance = 'Ask directly for their name. Be warm but direct.';
            break;
          case 'business_type':
            nextFieldGuidance = 'Ask what industry or business they work in. Be direct.';
            break;
          case 'goals':
            nextFieldGuidance = 'Ask what specific goals they want to achieve with the AI assistant.';
            break;
          default:
            nextFieldGuidance = 'Ask directly for the information needed.';
        }

        const nextQuestionPrompt = `
You are conducting a focused onboarding conversation. Be direct and professional.

${systemPrompt}

The user didn't provide a clear answer to the optional question about: ${currentField.description}
We'll move on to the next question: ${nextField.description}
This is ${nextField.required ? 'required' : 'optional'}.

Guidance: ${nextFieldGuidance}

Instructions:
1. Acknowledge that we're moving on (very briefly in half a sentence)
2. Ask for the next piece of information directly and clearly
3. Keep your entire response under 2 sentences
4. Focus on getting a clear, specific response
        `.trim();
        
        // Generate the next question with proper ThreadMessage format
        const systemMessage: ThreadMessage = {
          role: 'system' as 'user' | 'assistant' | 'system',
          content: nextQuestionPrompt,
          message_id: 'system_question',
          sender_name: 'System',
          sender_number: 'system',
          timestamp: new Date().toISOString(),
          message_type: 'text',
          message_content: { text: nextQuestionPrompt }
        };
        
        const questionMessages = [...threadMessages, systemMessage];
        
        const response = await generateAgentResponse(
          questionMessages,
          "Generate the next onboarding question"
        );
        
        return {
          metadata,
          response,
          onboarding_complete: false
        };
      } else {
        // All fields are completed
        metadata.onboarding_complete = true;
        delete metadata.current_onboarding_question;
        
        // Use the final message
        return {
          metadata,
          response: finalMessage,
          onboarding_complete: true
        };
      }
    }
  } catch (error) {
    console.error('[Onboarding] Error processing onboarding message:', error);
    return {
      metadata: metadata || { onboarding_complete: true },
      response: "I had trouble processing your information. Let's continue with our conversation.",
      onboarding_complete: true
    };
  }
}

/**
 * Update user metadata with onboarding information
 * 
 * @param user_id The user ID to update
 * @param metadata The metadata to save
 * @returns Success boolean
 */
export async function updateUserOnboardingMetadata(
  user_id: string,
  metadata: OnboardingUserMetadata
): Promise<boolean> {
  console.log(`[Onboarding] Updating metadata for user ${user_id}`);
  
  try {
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error('[Onboarding] No database adapter, could not update metadata');
      return false;
    }

    // First try the direct updateUser method which is the most likely to work
    try {
      // Basic structure that all adapter implementations should support
      // We know the user_id, so we can use it directly
      // Use a type assertion to allow adding metadata to the object
      const result = await adapter.updateUser(user_id, { metadata } as any);
      
      console.log(`[Onboarding] Updated user metadata for ${user_id}:`, result);
      return true;
    } catch (error) {
      console.error(`[Onboarding] Primary update method failed:`, error);
      
      // Fallback 1: Try updating with SQL format
      try {
        // Create an object matching the expected shape for SQL update
        const updateData = {
          metadata: metadata
        };
        
        // Pass it to updateUser with flag to indicate this is raw update data
        // This is a custom extension we're assuming might exist
        // @ts-ignore
        const result = await adapter.updateUserRaw(user_id, updateData);
        
        if (result) {
          console.log(`[Onboarding] Updated user metadata using fallback 1 for ${user_id}`);
          return true;
        }
      } catch (fallback1Error) {
        console.error(`[Onboarding] Fallback 1 failed:`, fallback1Error);
      }

      // If all else fails, we may not be able to update the user metadata
      console.error(`[Onboarding] Unable to update metadata for user ${user_id}`);
      return false;
    }
  } catch (error) {
    console.error('[Onboarding] Error updating user metadata:', error);
    return false;
  }
}

/**
 * Create a prompt for agentic onboarding based on the current user's onboarding state
 * 
 * @param flow The onboarding flow configuration
 * @param metadata The user's current metadata
 * @returns A prompt for the AI to use for onboarding
 */
export function createOnboardingPrompt(
  flow: OnboardingFlow,
  metadata: OnboardingUserMetadata | null
): string {
  const { systemPrompt, userFields } = flow.agenticSettings;
  
  // Initialize metadata if needed
  if (!metadata) metadata = {};
  if (!metadata.onboarding_questions) metadata.onboarding_questions = {};
  
  // Get the current question ID or set to first question
  const currentQuestionId = metadata.current_onboarding_question || userFields[0]?.id;
  
  // Find the current field definition
  const currentField = userFields.find(field => field.id === currentQuestionId);
  
  if (!currentField) {
    return `${systemPrompt}\n\nYou're starting the onboarding process. Ask the user about themselves to get to know them better.`;
  }
  
  // Create a more focused prompt that directs the AI to ask specific questions
  // Add field-specific guidance based on the field type
  let fieldGuidance = '';
  switch (currentField.id) {
    case 'email':
      fieldGuidance = 'Ask for their email address directly. Mention it will be used for communication.';
      break;
    case 'name':
      fieldGuidance = 'Ask for their full name directly. Be warm but direct.';
      break;
    case 'business_type':
      fieldGuidance = 'Ask what industry or business type they work in. Provide 2-3 brief examples if appropriate.';
      break;
    case 'goals':
      fieldGuidance = 'Ask what specific goals they want to achieve with the AI assistant. Be direct.';
      break;
    default:
      fieldGuidance = 'Ask directly for the specific information needed.';
  }

  const isFirstQuestion = !metadata.onboarding_questions || Object.keys(metadata.onboarding_questions).length === 0;
  
  const prompt = `
${systemPrompt}

You're conducting a focused onboarding process to collect specific information.

${isFirstQuestion ? 'This is the first question in the onboarding process.' : `Information collected so far:
${Object.entries(metadata.onboarding_questions || {})
  .map(([key, value]) => `- ${userFields.find(f => f.id === key)?.label || key}: ${value}`)
  .join('\n')}`}

Current question: ${currentField.description}
This is ${currentField.required ? 'required' : 'optional'} information.

Guidance: ${fieldGuidance}

Instructions:
1. ${isFirstQuestion ? 'Start with a brief welcome (1 sentence)' : 'Acknowledge previous information very briefly (half a sentence)'}
2. Ask for the current information directly and clearly
3. Keep your entire response under 2 sentences
4. Be friendly but direct and focused
5. Don't explain why you're asking unless it's part of the field guidance
`.trim();
  
  return prompt;
}
