/**
 * Chat Context Builder
 * 
 * Generates rich context for AI interactions that includes:
 * - Information about the chat type (individual or group)
 * - List of participants with relevant metadata
 * - Any associated projects
 * 
 * This enhances the AI's ability to provide contextually relevant responses,
 * particularly in group chat scenarios.
 */

import { MessageRecord } from "@/types/chat";

/**
 * Generate rich context about the conversation to prepend to the system prompt
 * Including information about the chat type, participants, and any associated projects
 */
export function generateRichChatContext(
  threadType: string,
  threadMessages: MessageRecord[],
  participants: any[] = [],
  projects: any[] = []
): string {
  // Create a descriptive context header
  let contextIntro = `\n<CONVERSATION_CONTEXT>\n`;

  // Add information about the chat type
  contextIntro += `Chat Type: ${threadType}\n`;
  
  // Add total number of messages for context awareness
  contextIntro += `Message History: ${threadMessages.length} messages\n`;

  // Add participants information (only if available)
  if (participants && participants.length > 0) {
    contextIntro += `\nParticipants (${participants.length}):\n`;
    
    // Format each participant's info
    participants.forEach((participant, index) => {
      contextIntro += `${index + 1}. Name: ${participant.name || 'Unknown'}\n`;
      
      // Include phone number if available (masked for privacy)
      if (participant.phone_number) {
        const maskedNumber = maskPhoneNumber(participant.phone_number);
        contextIntro += `   Phone: ${maskedNumber}\n`;
      }
      
      // Include any additional metadata that might be useful
      if (participant.metadata && Object.keys(participant.metadata).length > 0) {
        const metadataStr = Object.entries(participant.metadata)
          .filter(([key]) => !key.startsWith('_')) // Filter out private fields
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        if (metadataStr) {
          contextIntro += `   Metadata: ${metadataStr}\n`;
        }
      }
    });
  }

  // Add project information if available
  if (projects && projects.length > 0) {
    contextIntro += `\nProjects (${projects.length}):\n`;
    
    // Format each project's info
    projects.forEach((project, index) => {
      contextIntro += `${index + 1}. ${project.name || 'Unnamed Project'}\n`;
      
      if (project.description) {
        contextIntro += `   Description: ${project.description}\n`;
      }
      
      if (project.is_live !== undefined) {
        contextIntro += `   Status: ${project.is_live ? 'Live' : 'Draft'}\n`;
      }
      
      if (project.created_at) {
        const created = new Date(project.created_at);
        contextIntro += `   Created: ${created.toLocaleDateString()}\n`;
      }
    });
  }

  contextIntro += `</CONVERSATION_CONTEXT>\n`;
  
  return contextIntro;
}

/**
 * Mask a phone number for privacy while still providing context
 * Only shows last 4 digits, rest are masked with x
 */
function maskPhoneNumber(number: string): string {
  // Remove non-numeric characters
  const cleanNumber = number.replace(/\D/g, '');
  
  // If number is too short, just return masked version
  if (cleanNumber.length <= 4) {
    return 'xxxx' + cleanNumber;
  }
  
  // Mask all but last 4 digits
  const lastFour = cleanNumber.slice(-4);
  const maskedPart = 'x'.repeat(cleanNumber.length - 4);
  
  return maskedPart + lastFour;
}
