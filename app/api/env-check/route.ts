import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasA1BaseKey: !!process.env.A1BASE_API_KEY,
  });
}
