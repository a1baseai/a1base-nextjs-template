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
6. Uses double line breaks to separate paragraphs (will be converted to HTML)
7. Uses single line breaks only for list items

Format your response as a complete email body (without subject line unless specifically requested).

FORMATTING RULES:
- Start with a greeting (e.g., "Dear [Name]," or "Hi [Name],")
- Use double line breaks between paragraphs (press Enter twice)
- For lists, use a dash (-) or asterisk (*) at the start of each item
- Put each list item on its own line
- End with a closing (e.g., "Best regards," or "Sincerely,")
- Sign with the agent name on the next line

Example structure:
Dear [Name],

Thank you for your email. [First paragraph content]

[Second paragraph content]

Here are the key points:
- First point
- Second point
- Third point

[Closing paragraph if needed]

Best regards,
[Agent Name]

Note: The email will be automatically formatted as HTML for proper display.`
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