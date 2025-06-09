import { getInitializedAdapter } from '@/lib/supabase/config';
import { openai } from '@ai-sdk/openai';
import { streamText, type CoreMessage } from 'ai';

/**
 * Generates a concise summary of a chat thread.
 * @param chatId The ID of the chat to summarize.
 * @returns A string containing the summary.
 */
export async function generateChatSummary(chatId: string): Promise<string> {
  try {
    const adapter = await getInitializedAdapter();
    if (!adapter) {
      console.log('[ChatWorkflow] No adapter found, returning default summary.');
      return 'No chat history found.';
    }

    const thread = await adapter.getThread(chatId);
    if (!thread || thread.messages.length < 2) { // Only summarize if there's some conversation
      console.log('[ChatWorkflow] Not enough messages to summarize, returning welcome message.');
      return 'Welcome! Be the first to start the conversation.';
    }

    // Prepare messages for the AI, excluding system messages
    const history: CoreMessage[] = thread.messages
      .filter(msg => msg.message_type !== 'system')
      .map(msg => ({
        role: msg.sender_number === process.env.A1BASE_AGENT_NUMBER ? 'assistant' : 'user',
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
    return "I couldn't get a summary of the chat for you, but welcome to the conversation!";
  }
} 