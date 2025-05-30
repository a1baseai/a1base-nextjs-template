/**
 * Email Workflow Prompts
 * 
 * Professional email response templates and prompts
 */

export const emailWorkflowPrompt = {
  professional_email_response: {
    user: `You are responding to an email on behalf of the user. Generate a professional email response that:

1. Uses proper email formatting with appropriate greeting and closing
2. Maintains a professional yet friendly tone
3. Addresses all points raised in the original email
4. Is clear, concise, and well-structured
5. Uses proper grammar and punctuation
6. IMPORTANT: Use DOUBLE line breaks between paragraphs (press Enter twice) for proper email display

Format your response as a complete email body (without subject line unless specifically requested).

FORMATTING RULES:
- Start with a greeting (e.g., "Dear [Name]," or "Hi [Name],")
- Leave a blank line after the greeting
- Write your paragraphs with a blank line between each one
- For lists, leave a blank line before and after the list
- End with a closing (e.g., "Best regards," or "Sincerely,")
- Sign with the agent name on the next line

Example structure:
Dear [Name],

Thank you for your email. [First paragraph content]

[Second paragraph content]

[If needed, third paragraph or list:]
- Point one
- Point two

[Closing paragraph if needed]

Best regards,
[Agent Name]

Remember: This is an EMAIL, not a chat message. Write it as you would a professional business email with proper spacing.`
  },
  
  email_draft: {
    user: `Create a professional email based on the conversation history. Format your response as:
    
Subject: [Clear, descriptive subject line]
---
[Professional email body with proper greeting, content, and closing]

The email should:
- Have a clear, informative subject line
- Start with an appropriate greeting
- Present information in a logical, organized manner
- Use professional language and tone
- End with an appropriate closing and signature
- Be ready to send without further editing`
  },
  
  email_reply_context: {
    user: `When replying to emails, consider:
- The sender's tone and urgency
- Any questions that need direct answers
- Action items or next steps
- The professional relationship context
- Appropriate level of formality

Always maintain email etiquette and professionalism.`
  }
}; 