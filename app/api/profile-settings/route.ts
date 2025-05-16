/**
 * Profile Settings API Route
 *
 * Handles saving and loading agent profile settings to/from server-side files.
 * This allows settings to persist across dev environment restarts.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
// Define route configuration directly in this file
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { AgentProfileSettings } from "@/lib/agent-profile/types";

// Directory where profile data will be stored
const DATA_DIR = path.join(process.cwd(), "data");

// File path for profile settings
const PROFILE_SETTINGS_FILE = path.join(DATA_DIR, "profile-settings.json");

// Log paths to help debug
console.log("[PROFILE-API] Current working directory:", process.cwd());
console.log("[PROFILE-API] Data directory path:", DATA_DIR);
console.log("[PROFILE-API] Profile settings file path:", PROFILE_SETTINGS_FILE);

// Check if the file exists and log detailed info
try {
  const fileExists = fs.existsSync(PROFILE_SETTINGS_FILE);
  console.log("[PROFILE-API] File exists?", fileExists);
  
  if (fileExists) {
    // Get file stats
    const stats = fs.statSync(PROFILE_SETTINGS_FILE);
    console.log("[PROFILE-API] File size:", stats.size, "bytes");
    console.log("[PROFILE-API] Last modified:", stats.mtime);
    
    // Try to read the first 100 characters to verify content
    const sampleContent = fs.readFileSync(PROFILE_SETTINGS_FILE, "utf8").substring(0, 100);
    console.log("[PROFILE-API] File content sample:", sampleContent);
  } else {
    // Check if the data directory exists
    const dataDirExists = fs.existsSync(DATA_DIR);
    console.log("[PROFILE-API] Data directory exists?", dataDirExists);
    
    // List contents of the parent directory to debug
    if (dataDirExists) {
      const dirContents = fs.readdirSync(DATA_DIR);
      console.log("[PROFILE-API] Data directory contents:", dirContents);
    }
    
    // Check permissions on the data directory
    try {
      fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
      console.log("[PROFILE-API] Data directory is readable/writable");
    } catch (e) {
      console.error("[PROFILE-API] Data directory permission error:", e);
    }
  }
} catch (error) {
  console.error("[PROFILE-API] Error checking file:", error);
}

/**
 * Initialize the data directory if it doesn't exist
 */
const initializeDataDirectory = (): void => {
  console.log("[PROFILE-API] Initializing data directory");
  if (!fs.existsSync(DATA_DIR)) {
    console.log("[PROFILE-API] Data directory doesn't exist, creating it");
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log("[PROFILE-API] Successfully created data directory");
      
      // Verify the directory was created
      const dirExists = fs.existsSync(DATA_DIR);
      console.log("[PROFILE-API] Verified directory exists:", dirExists);
      
      // Check permissions
      try {
        fs.accessSync(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
        console.log("[PROFILE-API] New directory is readable/writable");
      } catch (e) {
        console.error("[PROFILE-API] New directory permission error:", e);
      }
    } catch (error) {
      console.error("[PROFILE-API] Error creating data directory:", error);
    }
  } else {
    console.log("[PROFILE-API] Data directory already exists");
  }
};

/**
 * GET /api/profile-settings
 * Retrieves profile settings from the server filesystem
 */
export async function GET() {
  try {
    console.log("[PROFILE-API] GET request received for profile settings");
    let settings = defaultAgentProfileSettings;
    console.log("[PROFILE-API] Default settings name:", settings.name);

    // Try to load from file
    if (fs.existsSync(PROFILE_SETTINGS_FILE)) {
      console.log("[PROFILE-API] Found profile settings file");
      try {
        const data = fs.readFileSync(PROFILE_SETTINGS_FILE, "utf8");
        console.log("[PROFILE-API] File read successful, content length:", data.length);
        settings = JSON.parse(data) as AgentProfileSettings;
        console.log("[PROFILE-API] Successfully parsed profile settings for", settings.name);
        console.log("[PROFILE-API] Company name:", settings.companyName);
        
        // Add a source marker to track where settings came from
        (settings as any)._source = 'file_via_api';
      } catch (error) {
        console.error("[PROFILE-API] Error reading/parsing profile settings file:", error);
        // Continue with default settings with error marker
        (settings as any)._source = 'default_after_file_error';
      }
    } else {
      console.log(
        "[PROFILE-API] ❌ Profile settings file not found at:",
        PROFILE_SETTINGS_FILE
      );
      (settings as any)._source = 'default_no_file';
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
      console.log("[PROFILE-API] Writing settings to file for", settings.name);
      fs.writeFileSync(
        PROFILE_SETTINGS_FILE,
        JSON.stringify(settings, null, 2)
      );
      
      // Verify the file was written
      const fileExists = fs.existsSync(PROFILE_SETTINGS_FILE);
      console.log("[PROFILE-API] Verified file exists after writing:", fileExists);
      
      if (fileExists) {
        const stats = fs.statSync(PROFILE_SETTINGS_FILE);
        console.log("[PROFILE-API] Written file size:", stats.size, "bytes");
        
        // Double check the file is readable
        const verifyContent = fs.readFileSync(PROFILE_SETTINGS_FILE, "utf8").substring(0, 50);
        console.log("[PROFILE-API] Written file starts with:", verifyContent);
      }
    } catch (error) {
      console.error("[PROFILE-API] Error writing profile settings file:", error);
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
