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
6. Includes appropriate spacing between paragraphs

Format your response as a complete email body (without subject line unless specifically requested).

Email context:
- You are writing on behalf of the agent/assistant
- Maintain professionalism while being helpful
- If the email requires specific information you don't have, politely indicate what information is needed
- Sign off appropriately based on the relationship and context

Remember: This is an EMAIL, not a chat message. Write it as you would a professional business email.`
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