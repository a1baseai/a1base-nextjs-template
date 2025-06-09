const { createClient } = require('@supabase/supabase-js');
const { openai } = require('@ai-sdk/openai');
const { generateText } = require('ai');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Generates a concise summary of a chat thread.
 * @param {string} chatId - The external ID of the chat to summarize
 * @returns {Promise<string>} A string containing the summary
 */
async function generateChatSummary(chatId) {
  try {
    if (!supabase) {
      console.log('[ChatWorkflow] Supabase not configured, returning default summary.');
      return null;
    }

    // First, get the internal chat ID from the external ID
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('external_id', chatId)
      .single();

    if (chatError || !chat) {
      console.log('[ChatWorkflow] Chat not found:', chatError);
      return null;
    }

    // Fetch messages from the chat
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        message_type,
        sender_id,
        conversation_users (
          id,
          name,
          is_agent
        )
      `)
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    if (messagesError || !messages || messages.length < 2) {
      console.log('[ChatWorkflow] Not enough messages to summarize');
      return null;
    }

    // Filter out system messages and prepare for AI
    const conversationHistory = messages
      .filter(msg => msg.message_type !== 'system')
      .map(msg => ({
        role: msg.conversation_users?.is_agent ? 'assistant' : 'user',
        content: msg.content,
      }));

    if (conversationHistory.length < 2) {
      return null;
    }

    console.log(`[ChatWorkflow] Generating summary for ${conversationHistory.length} messages`);

    // Generate summary using AI
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: `You are a helpful assistant. Summarize the following conversation in 2-3 concise bullet points. 
Focus on the main topics discussed and any important decisions or questions. 
Your summary should give a new person enough context to join the conversation naturally.
Format your response as bullet points starting with "•".`,
      messages: conversationHistory,
    });

    return text;

  } catch (error) {
    console.error('[ChatWorkflow] Error generating summary:', error);
    return null;
  }
}

module.exports = {
  generateChatSummary
}; 