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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
      supabaseConnected = !error || error.code === 'PGRST116'; // PGRST116 = table not found, which is fine
      
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
  });
}
