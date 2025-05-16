import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
// Define route configuration directly in this file
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Path to the triage logic file
const TRIAGE_LOGIC_PATH = path.join(process.cwd(), "lib", "ai-triage", "triage-logic.ts");

// Check if we're in a build context
const isBuildTime = () => {
  return process.env.NODE_ENV === 'production' && 
         (process.env.NEXT_PHASE === 'phase-production-build' || 
          !process.env.OPENAI_API_KEY);
};

export async function GET() {
  // Console log removed - [TRIAGE-API] GET request received for triage logic
  
  try {
    // Handle build-time context without file system access
    if (isBuildTime()) {
      // Console log removed - [TRIAGE-API] Build-time context detected
      return NextResponse.json({ 
        content: "// This is a placeholder for the triage logic file during build time."
      });
    }
    
    // Read the triage logic file
    const fileContent = await fs.readFile(TRIAGE_LOGIC_PATH, "utf8");
    // Console log removed - [TRIAGE-API] Successfully read triage logic file
    
    return NextResponse.json({ content: fileContent });
  } catch (error) {
    console.error('Error getting triage configuration:', error);
    return NextResponse.json(
      { error: "Failed to read triage logic file" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // Console log removed - [TRIAGE-API] POST request received for updating triage logic
  
  try {
    // Handle build-time context without file system access
    if (isBuildTime()) {
      // Console log removed - [TRIAGE-API] Build-time context detected
      return NextResponse.json({ success: true });
    }
    
    // Parse the request body
    const { content } = await req.json();
    
    if (!content) {
      return NextResponse.json(
        { error: "No content provided" },
        { status: 400 }
      );
    }
    
    // Create a backup of the original file
    const backupPath = `${TRIAGE_LOGIC_PATH}.bak`;
    const originalContent = await fs.readFile(TRIAGE_LOGIC_PATH, "utf8");
    await fs.writeFile(backupPath, originalContent);
    // Console log removed - [TRIAGE-API] Created backup
    
    // Write the new content
    await fs.writeFile(TRIAGE_LOGIC_PATH, content);
    // Console log removed - [TRIAGE-API] Successfully updated triage logic file
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TRIAGE-API] Error updating triage logic file:', error);
    return NextResponse.json(
      { error: "Failed to update triage logic file" },
      { status: 500 }
    );
  }
}
