import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Define the path to the settings file
const settingsFilePath = path.join(process.cwd(), "data", "model-settings.json");

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
      selectedModelProvider: process.env.SELECTED_MODEL_PROVIDER || "openai",
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
  
  // Update process.env for the current session
  process.env.SELECTED_MODEL_PROVIDER = settings.selectedModelProvider;
  
  return settings;
}

// GET handler
export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching model settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch model settings" },
      { status: 500 }
    );
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validate input
    if (!data.selectedModelProvider) {
      return NextResponse.json(
        { error: "selectedModelProvider is required" },
        { status: 400 }
      );
    }
    
    // Validate provider type
    const validProviders = ["openai", "anthropic", "grok"];
    if (!validProviders.includes(data.selectedModelProvider)) {
      return NextResponse.json(
        { error: "Invalid model provider. Must be one of: openai, anthropic, grok" },
        { status: 400 }
      );
    }
    
    // Save the settings
    const settings = getSettings();
    settings.selectedModelProvider = data.selectedModelProvider;
    saveSettings(settings);
    
    return NextResponse.json({ 
      success: true, 
      message: `Model provider updated to ${data.selectedModelProvider}`,
      settings 
    });
  } catch (error) {
    console.error("Error updating model settings:", error);
    return NextResponse.json(
      { error: "Failed to update model settings" },
      { status: 500 }
    );
  }
}
