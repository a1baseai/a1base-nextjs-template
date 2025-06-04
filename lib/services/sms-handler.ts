/**
 * SMS Handler Service
 * Handles SMS-specific validation, sanitization, and processing
 */

export class SMSHandler {
  private static readonly MAX_SMS_LENGTH = 1200;
  private static readonly GSM7_REGEX = /^[\x00-\x7F\u00A0-\u00FF\u20AC]*$/;
  
  /**
   * Validates if content is suitable for SMS
   * @param content The message content to validate
   * @returns Validation result with error details if invalid
   */
  static validateSMSContent(content: string): {
    valid: boolean;
    error?: string;
    length?: number;
  } {
    const sanitized = this.sanitizeForSMS(content);
    
    if (!this.GSM7_REGEX.test(sanitized)) {
      return {
        valid: false,
        error: 'Message contains characters not supported by SMS',
        length: sanitized.length
      };
    }
    
    if (sanitized.length > this.MAX_SMS_LENGTH) {
      return {
        valid: false,
        error: `Message too long for SMS (${sanitized.length}/${this.MAX_SMS_LENGTH} characters)`,
        length: sanitized.length
      };
    }
    
    return { valid: true, length: sanitized.length };
  }
  
  /**
   * Sanitizes content for SMS by replacing Unicode with GSM-7 equivalents
   * @param content The message content to sanitize
   * @returns Sanitized content suitable for SMS
   */
  static sanitizeForSMS(content: string): string {
    // Replace common Unicode with GSM-7 equivalents
    return content
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/—/g, '-')
      .replace(/…/g, '...')
      .replace(/•/g, '*')
      .replace(/–/g, '-')
      .replace(/™/g, 'TM')
      .replace(/©/g, '(c)')
      .replace(/®/g, '(R)')
      .replace(/°/g, ' degrees')
      .replace(/±/g, '+/-')
      .replace(/×/g, 'x')
      .replace(/÷/g, '/')
      .replace(/→/g, '->')
      .replace(/←/g, '<-')
      .replace(/↑/g, '^')
      .replace(/↓/g, 'v')
      .replace(/♥/g, '<3')
      .replace(/★/g, '*')
      .replace(/☆/g, '*')
      .replace(/✓/g, 'OK')
      .replace(/✗/g, 'X')
      .replace(/✔/g, 'OK')
      .replace(/✘/g, 'X');
  }
  
  /**
   * Checks if a character is in the GSM-7 character set
   * @param char Single character to check
   * @returns True if character is GSM-7 compatible
   */
  static isGSM7Char(char: string): boolean {
    return this.GSM7_REGEX.test(char);
  }
  
  /**
   * Gets a preview of how the message will appear in SMS
   * @param content Original message content
   * @returns Preview object with sanitized text and warnings
   */
  static getSMSPreview(content: string): {
    sanitized: string;
    length: number;
    valid: boolean;
    warnings: string[];
  } {
    const sanitized = this.sanitizeForSMS(content);
    const validation = this.validateSMSContent(content);
    const warnings: string[] = [];
    
    if (sanitized !== content) {
      warnings.push('Some characters were replaced for SMS compatibility');
    }
    
    if (sanitized.length > 160) {
      warnings.push(`Message will be sent as ${Math.ceil(sanitized.length / 153)} parts`);
    }
    
    if (!validation.valid && validation.error) {
      warnings.push(validation.error);
    }
    
    return {
      sanitized,
      length: sanitized.length,
      valid: validation.valid,
      warnings
    };
  }
} 