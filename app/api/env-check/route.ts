import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const result = {
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasA1BaseKey: !!process.env.A1BASE_API_KEY,
  };
  
  console.log("Environment check result:", result);
  
  return NextResponse.json(result);
}
