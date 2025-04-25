/**
 * Base Information API Route
 * 
 * Handles saving and loading agent base information to/from server-side files.
 * This allows information to persist across dev environment restarts.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { dynamic, runtime, maxDuration } from '../route-config';

// Export the route configuration to prevent Next.js from trying
// to access file system during build time
export { dynamic, runtime, maxDuration };
import { defaultBaseInformation } from '@/lib/agent-profile/agent-base-information';
import { InformationSection } from '@/lib/agent-profile/types';

// Directory where profile data will be stored
const DATA_DIR = path.join(process.cwd(), 'data');

// File path for base information
const BASE_INFORMATION_FILE = path.join(DATA_DIR, 'base-information.json');

// Log paths to help debug
console.log('[BASE-INFO-API] Current working directory:', process.cwd());
console.log('[BASE-INFO-API] Data directory path:', DATA_DIR);
console.log('[BASE-INFO-API] Base information file path:', BASE_INFORMATION_FILE);

try {
  const fileExists = fs.existsSync(BASE_INFORMATION_FILE);
  console.log('[BASE-INFO-API] File exists?', fileExists);
  
  if (fileExists) {
    // Get file stats
    const stats = fs.statSync(BASE_INFORMATION_FILE);
    console.log('[BASE-INFO-API] File size:', stats.size, 'bytes');
    console.log('[BASE-INFO-API] Last modified:', stats.mtime);
    
    // Try to read the first 100 characters to verify content
    const sampleContent = fs.readFileSync(BASE_INFORMATION_FILE, 'utf8').substring(0, 100);
    console.log('[BASE-INFO-API] File content sample:', sampleContent);
  } else {
    // Check if the data directory exists
    const dataDirExists = fs.existsSync(DATA_DIR);
    console.log('[BASE-INFO-API] Data directory exists?', dataDirExists);
    
    if (dataDirExists) {
      const dirContents = fs.readdirSync(DATA_DIR);
      console.log('[BASE-INFO-API] Data directory contents:', dirContents);
    }
  }
} catch (error) {
  console.error('[BASE-INFO-API] Error checking file:', error);
}

/**
 * Initialize the data directory if it doesn't exist
 */
const initializeDataDirectory = (): void => {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }
};

/**
 * GET /api/base-information
 * Retrieves base information from the server filesystem
 */
export async function GET() {
  console.log('[BASE-INFO-API] GET request received for base information');
  try {
    let information = defaultBaseInformation;
    
    // Try to load from file
    if (fs.existsSync(BASE_INFORMATION_FILE)) {
      try {
        const data = fs.readFileSync(BASE_INFORMATION_FILE, 'utf8');
        information = JSON.parse(data) as InformationSection[];
        console.log('✅ Successfully loaded base information from file');
        // Log first section title to confirm it's loading correctly
        if (information.length > 0) {
          console.log('First section title:', information[0].title);
        }
      } catch (error) {
        console.error('Error reading base information file:', error);
        // Continue with default information
      }
    } else {
      console.log('❌ Base information file not found at:', BASE_INFORMATION_FILE);
    }
    
    return NextResponse.json({ information });
  } catch (error) {
    console.error('Error getting base information:', error);
    return NextResponse.json(
      { error: 'Failed to get base information', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/base-information
 * Saves base information to the server filesystem
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { information } = body;
    
    if (!information) {
      return NextResponse.json(
        { error: 'Missing information in request body' },
        { status: 400 }
      );
    }
    
    // Ensure data directory exists
    initializeDataDirectory();
    
    // Write information to file
    try {
      fs.writeFileSync(
        BASE_INFORMATION_FILE,
        JSON.stringify(information, null, 2)
      );
    } catch (error) {
      console.error('Error writing base information file:', error);
      throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving base information:', error);
    return NextResponse.json(
      { error: 'Failed to save base information', message: (error as Error).message },
      { status: 500 }
    );
  }
}
