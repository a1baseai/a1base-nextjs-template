/**
 * Prompt Builder Service
 * Builds service-aware system prompts for AI responses
 */

/**
 * Builds a system prompt with service-specific context
 * @param basePrompt The base system prompt
 * @param service The messaging service (whatsapp, sms, etc.)
 * @returns The enhanced system prompt
 */
export function buildSystemPrompt(basePrompt: string, service: string): string {
  let prompt = basePrompt;
  
  if (service === 'sms') {
    prompt += `

IMPORTANT SMS LIMITATIONS:
- You are responding via SMS, which has strict limitations.
- Keep your responses under 1200 characters (ideally under 160 for single SMS).
- Use only basic ASCII characters - avoid emojis, special symbols, or Unicode.
- Be extremely concise while remaining helpful.
- If a detailed response is needed, offer to continue via WhatsApp or another channel.
- Common replacements: use * for bullets, ... for ellipsis, - for em dash.
- Current message service: SMS`;
  } else if (service === 'whatsapp') {
    prompt += `

MESSAGE SERVICE INFO:
- You are responding via WhatsApp.
- You can use rich formatting, emojis, and longer messages.
- Media sharing is supported if needed.
- Current message service: WhatsApp`;
  }
  
  return prompt;
}

/**
 * Gets service-specific constraints for the AI
 * @param service The messaging service
 * @returns Constraints object
 */
export function getServiceConstraints(service: string): {
  maxLength: number;
  allowsUnicode: boolean;
  allowsMedia: boolean;
  supportsFormatting: boolean;
} {
  switch (service) {
    case 'sms':
      return {
        maxLength: 1200,
        allowsUnicode: false,
        allowsMedia: false,
        supportsFormatting: false
      };
    case 'whatsapp':
      return {
        maxLength: 65536, // WhatsApp's practical limit
        allowsUnicode: true,
        allowsMedia: true,
        supportsFormatting: true
      };
    default:
      return {
        maxLength: 65536,
        allowsUnicode: true,
        allowsMedia: true,
        supportsFormatting: true
      };
  }
}

/**
 * Adds a service context message to the conversation
 * @param service The messaging service
 * @returns A system message about the service context
 */
export function getServiceContextMessage(service: string): {
  role: 'system';
  content: string;
} {
  let content = '';
  
  if (service === 'sms') {
    content = 'Remember: This is an SMS conversation. Keep responses short and use only basic characters.';
  } else if (service === 'whatsapp') {
    content = 'This is a WhatsApp conversation. You can use rich formatting and longer messages if needed.';
  } else {
    content = 'This is a web conversation. Standard formatting applies.';
  }
  
  return {
    role: 'system',
    content
  };
}

/**
 * Validates if a response is appropriate for the service
 * @param response The AI response
 * @param service The messaging service
 * @returns Validation result
 */
export function validateResponseForService(
  response: string,
  service: string
): {
  valid: boolean;
  reason?: string;
} {
  const constraints = getServiceConstraints(service);
  
  if (response.length > constraints.maxLength) {
    return {
      valid: false,
      reason: `Response exceeds ${service.toUpperCase()} character limit of ${constraints.maxLength}`
    };
  }
  
  if (service === 'sms' && !constraints.allowsUnicode) {
    // Check for common Unicode characters
    const hasUnicode = /[^\x00-\x7F\u00A0-\u00FF\u20AC]/.test(response);
    if (hasUnicode) {
      return {
        valid: false,
        reason: 'Response contains characters not supported by SMS'
      };
    }
  }
  
  return { valid: true };
} 