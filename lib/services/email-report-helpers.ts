/**
 * Email Report Helper Functions
 * 
 * Utilities for handling email addresses and report-related operations
 */

import { getInitializedAdapter } from '../supabase/config';

/**
 * Extract email address from message content
 */
export function extractEmailFromMessage(message: string): string | null {
  // Common email regex pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = message.match(emailRegex);
  return matches && matches.length > 0 ? matches[0].toLowerCase() : null;
}

/**
 * Update user's email address in metadata
 */
export async function updateUserEmail(phoneNumber: string, email: string): Promise<boolean> {
  try {
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.error('[updateUserEmail] Adapter not initialized');
      return false;
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/\+/g, '');

    // First get the current metadata
    const { data: user, error: fetchError } = await adapter.supabase
      .from('conversation_users')
      .select('metadata')
      .eq('phone_number', normalizedPhone)
      .single();

    if (fetchError) {
      console.error('[updateUserEmail] Error fetching user:', fetchError);
      return false;
    }

    // Merge email into existing metadata
    const updatedMetadata = {
      ...(user?.metadata || {}),
      email: email
    };

    // Update user metadata with email
    const { error } = await adapter.supabase
      .from('conversation_users')
      .update({ 
        metadata: updatedMetadata
      })
      .eq('phone_number', normalizedPhone);

    if (error) {
      console.error('[updateUserEmail] Error updating user email:', error);
      return false;
    }

    console.log(`[updateUserEmail] Successfully updated email for user ${normalizedPhone}: ${email}`);
    return true;
  } catch (error) {
    console.error('[updateUserEmail] Error:', error);
    return false;
  }
}

/**
 * Check if a message might be providing an email address
 */
export function isEmailProvisionMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  
  // Check if message contains an email and common email-providing phrases
  return emailRegex.test(message) && (
    lowerMessage.includes('my email') ||
    lowerMessage.includes('email is') ||
    lowerMessage.includes('email address') ||
    lowerMessage.includes('@') // Simple check for email presence
  );
}

/**
 * Format frequency text for user messages
 */
export function formatFrequencyText(frequency: 'daily' | 'weekly' | 'monthly'): string {
  switch (frequency) {
    case 'daily':
      return 'every day';
    case 'weekly':
      return 'every week';
    case 'monthly':
      return 'every month';
    default:
      return frequency;
  }
}

/**
 * Parse time from user input (e.g., "9am", "14:30", "3:00 PM")
 */
export function parseTimeFromInput(input: string): string | null {
  const timeRegex = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/i;
  const match = input.match(timeRegex);
  
  if (!match) return null;
  
  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  
  // Convert to 24-hour format
  if (meridiem === 'pm' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }
  
  // Validate hours and minutes
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  // Format as HH:MM
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
} 