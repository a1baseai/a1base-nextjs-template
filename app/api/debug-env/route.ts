import { NextResponse } from "next/server";

export async function GET() {
  // Check if environment variables are available (don't expose actual values)
  const openaiKeyAvailable = !!process.env.OPENAI_API_KEY;
  const anthropicKeyAvailable = !!process.env.ANTHROPIC_API_KEY;
  const grokKeyAvailable = !!process.env.GROK_API_KEY || !!process.env.GROK_API_TOKEN;
  const a1baseKeyAvailable = !!process.env.A1BASE_API_KEY;
  const a1baseAgentName = process.env.A1BASE_AGENT_NAME || null;
  const a1baseAgentNumber = process.env.A1BASE_AGENT_NUMBER || null;
  
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
  
  return NextResponse.json({
    openaiKeyAvailable,
    anthropicKeyAvailable,
    grokKeyAvailable,
    a1baseKeyAvailable,
    a1baseAgentName,
    a1baseAgentNumber,
    selectedModelProvider,
  });
}
