import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Define the path to the settings file
const settingsFilePath = path.join(process.cwd(), "data", "message-settings.json");

// Ensure the settings directory exists
function ensureDirectoryExists() {
  const dir = path.dirname(settingsFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Get current settings
function getSettings() {
  ensureDirectoryExists();
  
  if (!fs.existsSync(settingsFilePath)) {
    const defaultSettings = {
      splitParagraphs: false, // Default to not splitting paragraphs
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }

  const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
  return settings;
}

// Save settings
function saveSettings(settings: any) {
  ensureDirectoryExists();
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  
  return settings;
}

// GET handler
export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching message settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch message settings" },
      { status: 500 }
    );
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validate input
    if (data.splitParagraphs === undefined) {
      return NextResponse.json(
        { error: "splitParagraphs is required" },
        { status: 400 }
      );
    }
    
    // Validate type
    if (typeof data.splitParagraphs !== "boolean") {
      return NextResponse.json(
        { error: "splitParagraphs must be a boolean" },
        { status: 400 }
      );
    }
    
    // Save the settings
    const settings = getSettings();
    settings.splitParagraphs = data.splitParagraphs;
    saveSettings(settings);
    
    return NextResponse.json({ 
      success: true, 
      message: `Message chunking ${data.splitParagraphs ? 'enabled' : 'disabled'}`,
      settings 
    });
  } catch (error) {
    console.error("Error updating message settings:", error);
    return NextResponse.json(
      { error: "Failed to update message settings" },
      { status: 500 }
    );
  }
}
