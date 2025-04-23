import { NextResponse } from "next/server";

export async function GET() {
  // Check if environment variables are available (don't expose actual values)
  const openaiKeyAvailable = !!process.env.OPENAI_API_KEY;
  const a1baseKeyAvailable = !!process.env.A1BASE_API_KEY;
  const a1baseAgentName = process.env.A1BASE_AGENT_NAME || null;

  console.log("Debug environment variables:");
  console.log(`OPENAI_API_KEY available: ${openaiKeyAvailable}`);
  console.log(`A1BASE_API_KEY available: ${a1baseKeyAvailable}`);
  console.log(`A1BASE_AGENT_NAME: ${a1baseAgentName}`);
  
  return NextResponse.json({
    openaiKeyAvailable,
    a1baseKeyAvailable,
    a1baseAgentName,
  });
}
