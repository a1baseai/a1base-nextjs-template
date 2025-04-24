/**
 * Profile Settings API Route
 *
 * Handles saving and loading agent profile settings to/from server-side files.
 * This allows settings to persist across dev environment restarts.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { AgentProfileSettings } from "@/lib/agent-profile/types";

// Directory where profile data will be stored
const DATA_DIR = path.join(process.cwd(), "data");

// File path for profile settings
const PROFILE_SETTINGS_FILE = path.join(DATA_DIR, "profile-settings.json");

// Log paths to help debug
console.log("Current working directory:", process.cwd());
console.log("Data directory path:", DATA_DIR);
console.log("Profile settings file path:", PROFILE_SETTINGS_FILE);
console.log("File exists?", fs.existsSync(PROFILE_SETTINGS_FILE));

/**
 * Initialize the data directory if it doesn't exist
 */
const initializeDataDirectory = (): void => {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (error) {
      console.error("Error creating data directory:", error);
    }
  }
};

/**
 * GET /api/profile-settings
 * Retrieves profile settings from the server filesystem
 */
export async function GET() {
  try {
    let settings = defaultAgentProfileSettings;

    // Try to load from file
    if (fs.existsSync(PROFILE_SETTINGS_FILE)) {
      try {
        const data = fs.readFileSync(PROFILE_SETTINGS_FILE, "utf8");
        settings = JSON.parse(data) as AgentProfileSettings;
      } catch (error) {
        console.error("Error reading profile settings file:", error);
        // Continue with default settings
      }
    } else {
      console.log(
        "❌ Profile settings file not found at:",
        PROFILE_SETTINGS_FILE
      );
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error getting profile settings:", error);
    return NextResponse.json(
      {
        error: "Failed to get profile settings",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile-settings
 * Saves profile settings to the server filesystem
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { error: "Missing settings in request body" },
        { status: 400 }
      );
    }

    // Ensure data directory exists
    initializeDataDirectory();

    // Write settings to file
    try {
      fs.writeFileSync(
        PROFILE_SETTINGS_FILE,
        JSON.stringify(settings, null, 2)
      );
    } catch (error) {
      console.error("Error writing profile settings file:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving profile settings:", error);
    return NextResponse.json(
      {
        error: "Failed to save profile settings",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
