import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  // Check if environment variables are available (don't expose actual values)
  const openaiKeyAvailable = !!process.env.OPENAI_API_KEY;
  const anthropicKeyAvailable = !!process.env.ANTHROPIC_API_KEY;
  const grokKeyAvailable = !!process.env.GROK_API_KEY || !!process.env.GROK_API_TOKEN;
  const a1baseKeyAvailable = !!process.env.A1BASE_API_KEY;
  const a1baseAgentName = process.env.A1BASE_AGENT_NAME || null;
  const a1baseAgentNumber = process.env.A1BASE_AGENT_NUMBER || null;
  
  // Check Supabase configuration
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  console.log("Supabase URL:", supabaseUrl)
  console.log("Supabase Key:", supabaseKey)
  const supabaseUrlAvailable = !!supabaseUrl;
  const supabaseKeyAvailable = !!supabaseKey;
  let supabaseConnected = false;
  
  // Test Supabase connection if credentials are available
  if (supabaseUrlAvailable && supabaseKeyAvailable) {
    try {
      const supabase = createClient(supabaseUrl!, supabaseKey!);
      // Try a simple query to check if connection works
      const { data, error } = await supabase.from('health_check').select('*').limit(1).maybeSingle();
      
      // If there's no error, connection is working - even if the table doesn't exist
      // We're checking if we can establish a connection, not if specific tables exist
      supabaseConnected = !error || error.code === 'PGRST116' || Boolean(error && error.message && error.message.includes("relation \"public.health_check\" does not exist")); // Accept both error code or specific message
      
      console.log('Supabase connection test:', error ? `Error: ${error.message}` : 'Success');
    } catch (e) {
      console.error('Error testing Supabase connection:', e);
      supabaseConnected = false;
    }
  }
  
  // Get the currently selected model provider (default to OpenAI if not set)
  let selectedModelProvider = process.env.SELECTED_MODEL_PROVIDER || "openai";
  
  // If the selected provider doesn't have a key, fallback to one that does
  if (
    (selectedModelProvider === "openai" && !openaiKeyAvailable) ||
    (selectedModelProvider === "anthropic" && !anthropicKeyAvailable) ||
    (selectedModelProvider === "grok" && !grokKeyAvailable)
  ) {
    if (openaiKeyAvailable) selectedModelProvider = "openai";
    else if (anthropicKeyAvailable) selectedModelProvider = "anthropic";
    else if (grokKeyAvailable) selectedModelProvider = "grok";
    else selectedModelProvider = "openai"; // Default even if not available
  }
  
  console.log(`A1BASE_AGENT_NAME: ${a1baseAgentName}`);
  console.log(`A1BASE_AGENT_NUMBER: ${a1baseAgentNumber}`);
  console.log(`Selected model provider: ${selectedModelProvider}`);
  console.log(`Supabase URL available: ${supabaseUrlAvailable}`);
  console.log(`Supabase Key available: ${supabaseKeyAvailable}`);
  console.log(`Supabase connected: ${supabaseConnected}`);
  
  // Get the list of tables if connected to Supabase
  let requiredTables = [
    'conversation_users',
    'chats',
    'chat_participants',
    'messages',
    'cron_jobs',
    'user_preferences',
    'projects',
    'project_history'
  ];
  
  let existingTables: string[] = [];
  let otherTables: string[] = [];
  
  if (supabaseConnected && supabaseUrlAvailable && supabaseKeyAvailable) {
    try {
      const supabase = createClient(supabaseUrl!, supabaseKey!);
      
      // Create a custom RPC function to check if tables exist
      // Use individual queries to check if each table exists
      for (const tableName of requiredTables) {
        try {
          // Attempt to get a single row from the table (will error if table doesn't exist)
          const { error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          // If no error or error is just about permissions but table exists
          if (!error || error.code === 'PGRST301') { // PGRST301 = permission denied
            existingTables.push(tableName);
          }
        } catch (tableError) {
          console.log(`Table check for ${tableName}:`, tableError);
        }
      }
      
      // In production with a real setup, we'd also query for other tables,
      // but for simplicity and to avoid permissions issues, we'll skip checking for
      // tables beyond the required ones in this implementation
      
    } catch (e) {
      console.error('Error checking table existence:', e);
    }
  }

  return NextResponse.json({
    openaiKeyAvailable,
    anthropicKeyAvailable,
    grokKeyAvailable,
    a1baseKeyAvailable,
    a1baseAgentName,
    a1baseAgentNumber,
    selectedModelProvider,
    supabaseUrlAvailable,
    supabaseKeyAvailable,
    supabaseConnected,
    requiredTables,
    existingTables,
    otherTables,
  });
}
