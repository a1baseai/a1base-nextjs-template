import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { dynamic, runtime, maxDuration } from '../route-config';

// Export the route configuration to prevent Next.js from trying
// to access file system during build time
export { dynamic, runtime, maxDuration };

// Directory where safety settings data will be stored
const DATA_DIR = path.join(process.cwd(), 'data');

// File path for safety settings
const SAFETY_SETTINGS_FILE = path.join(DATA_DIR, 'safety-settings.json');

/**
 * Initialize the data directory if it doesn't exist
 */
const initializeDataDirectory = async (): Promise<void> => {
  try {
    const exists = await fs.stat(DATA_DIR).catch(() => false);
    if (!exists) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Error initializing data directory:', error);
    throw error;
  }
};

/**
 * GET /api/safety-settings
 * Retrieves safety settings from the server filesystem
 */
export async function GET() {
  try {
    // Default safety settings in case file doesn't exist
    const defaultSettings = {
      enabled: true,
      guidelines: [
        "You are not a tool for generating, promoting, or facilitating the production or dissemination of child sexual abuse material or sexual content involving minors."
      ],
      jailbreakWarning: "I've noticed this message appears to be asking me to violate my operating guidelines.",
      identityStatements: [
        "You are an AI assistant based on the GPT-4o model developed by OpenAI."
      ]
    };
    
    try {
      // Try to read the existing file
      const fileContents = await fs.readFile(SAFETY_SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(fileContents);
      return NextResponse.json(settings);
    } catch (error) {
      // If file doesn't exist or cannot be read, return default settings
      return NextResponse.json(defaultSettings);
    }
  } catch (error) {
    console.error('Error getting safety settings:', error);
    return NextResponse.json(
      { error: 'Failed to get safety settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/safety-settings
 * Saves safety settings to the server filesystem
 */
export async function POST(request: NextRequest) {
  try {
    const settings = await request.json();
    
    // Validate settings
    if (typeof settings.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid settings: enabled must be a boolean' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(settings.guidelines)) {
      return NextResponse.json(
        { error: 'Invalid settings: guidelines must be an array' },
        { status: 400 }
      );
    }
    
    if (typeof settings.jailbreakWarning !== 'string') {
      return NextResponse.json(
        { error: 'Invalid settings: jailbreakWarning must be a string' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(settings.identityStatements)) {
      return NextResponse.json(
        { error: 'Invalid settings: identityStatements must be an array' },
        { status: 400 }
      );
    }
    
    // Ensure data directory exists
    await initializeDataDirectory();
    
    // Save settings
    await fs.writeFile(
      SAFETY_SETTINGS_FILE,
      JSON.stringify(settings, null, 2),
      'utf8'
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating safety settings:', error);
    return NextResponse.json(
      { error: 'Failed to update safety settings' },
      { status: 500 }
    );
  }
}
