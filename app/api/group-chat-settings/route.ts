/**
 * Group Chat Settings API Route
 *
 * Provides endpoints for managing group chat specific settings
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
// Define route configuration
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { AgentProfileSettings } from "@/lib/agent-profile/types";

// Directory where profile data is stored
const DATA_DIR = path.join(process.cwd(), "data");
// File path for profile settings
const PROFILE_SETTINGS_FILE = path.join(DATA_DIR, "profile-settings.json");

/**
 * Initialize the data directory if it doesn't exist
 */
const initializeDataDirectory = (): void => {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log("[GROUP-CHAT-API] Created data directory");
    } catch (error) {
      console.error("[GROUP-CHAT-API] Error creating data directory:", error);
    }
  }
};

/**
 * Load current profile settings from file
 */
const loadProfileSettings = (): AgentProfileSettings => {
  if (fs.existsSync(PROFILE_SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(PROFILE_SETTINGS_FILE, "utf8");
      return JSON.parse(data) as AgentProfileSettings;
    } catch (error) {
      console.error("[GROUP-CHAT-API] Error reading profile settings:", error);
    }
  }
  return { ...defaultAgentProfileSettings };
};

/**
 * Save profile settings to file
 */
const saveProfileSettings = (settings: AgentProfileSettings): boolean => {
  initializeDataDirectory();
  try {
    fs.writeFileSync(PROFILE_SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error("[GROUP-CHAT-API] Error saving profile settings:", error);
    return false;
  }
};

/**
 * GET /api/group-chat-settings
 * Returns the current group chat settings
 */
export async function GET() {
  try {
    console.log("[GROUP-CHAT-API] Getting group chat settings");
    const profileSettings = loadProfileSettings();
    
    // Extract just the group chat settings
    const requireMentionInGroupChats = 
      profileSettings?.agentSettings?.requireMentionInGroupChats || false;
    
    return NextResponse.json({ 
      requireMentionInGroupChats,
      success: true 
    });
  } catch (error) {
    console.error("[GROUP-CHAT-API] Error getting group chat settings:", error);
    return NextResponse.json(
      {
        error: "Failed to get group chat settings",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/group-chat-settings
 * Updates the group chat settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate that requireMentionInGroupChats is present and is a boolean
    if (typeof body.requireMentionInGroupChats !== 'boolean') {
      return NextResponse.json(
        { 
          error: "Invalid request: requireMentionInGroupChats must be a boolean",
          success: false 
        },
        { status: 400 }
      );
    }
    
    // Load current settings
    const profileSettings = loadProfileSettings();
    
    // Update just the group chat setting
    profileSettings.agentSettings = {
      ...profileSettings.agentSettings,
      requireMentionInGroupChats: body.requireMentionInGroupChats
    };
    
    console.log(
      `[GROUP-CHAT-API] Updating requireMentionInGroupChats to: ${body.requireMentionInGroupChats ? 'enabled' : 'disabled'}`
    );
    
    // Save updated settings
    const success = saveProfileSettings(profileSettings);
    
    if (success) {
      return NextResponse.json({ 
        success: true,
        message: "Group chat settings updated successfully" 
      });
    } else {
      return NextResponse.json(
        { 
          error: "Failed to save group chat settings",
          success: false 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[GROUP-CHAT-API] Error updating group chat settings:", error);
    return NextResponse.json(
      {
        error: "Failed to update group chat settings",
        message: (error as Error).message,
        success: false
      },
      { status: 500 }
    );
  }
}
