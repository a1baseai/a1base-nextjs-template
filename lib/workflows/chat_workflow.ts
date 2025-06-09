import { getAdapter } from '../supabase/adapter';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Define a type for the message object to resolve implicit 'any'
interface ChatMessage {
  message_type: string;
  sender_number?: string;
  content: string;
}

/**
 * Generates a concise summary of a chat thread.
 * @param {string} chatId The ID of the chat to summarize.
 * @returns {Promise<string>} A string containing the summary.
 */
export async function generateChatSummary(chatId: string): Promise<string> {
  try {
    const adapter = await getAdapter();
    if (!adapter) {
      console.log('[ChatWorkflow] No adapter found, returning default summary.');
      return 'No chat history available.';
    }

    const thread = await adapter.getThread(chatId);
    
    // If no thread exists or no messages at all, return empty/no history message
    if (!thread || !thread.messages || thread.messages.length === 0) {
      console.log('[ChatWorkflow] No messages in chat, skipping summary generation.');
      return 'No chat history yet.';
    }
    
    // Filter out system messages to see if there's actual conversation
    const conversationMessages = thread.messages.filter((msg: ChatMessage) => msg.message_type !== 'system');
    
    // If there are only system messages or less than 2 real messages, don't summarize
    if (conversationMessages.length < 2) {
      console.log('[ChatWorkflow] Not enough conversation messages to summarize.');
      return 'Chat just started.';
    }

    // Prepare messages for the AI, excluding system messages
    const history = conversationMessages
      .map((msg: ChatMessage) => ({
        role: (msg.sender_number === process.env.A1BASE_AGENT_NUMBER ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.content,
      }));

    const systemPrompt = `You are a helpful assistant. Summarize the following conversation in 3 concise bullet points or less. If the conversation is very short, just provide a one-sentence summary. Your summary should give a new person enough context to join the conversation.`;
    
    const { text } = await streamText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      messages: history,
    });
    
    return text;

  } catch (error) {
    console.error('[ChatWorkflow] Error generating summary:', error);
    return "Unable to generate chat summary.";
  }
} 