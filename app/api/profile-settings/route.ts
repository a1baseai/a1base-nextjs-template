/**
 * Profile Settings API Route
 * 
 * Handles saving and loading agent profile settings to/from server-side files.
 * This allows settings to persist across dev environment restarts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveProfileSettingsToFile, loadProfileSettingsFromFile } from '@/lib/storage/server-file-storage';
import { defaultAgentProfileSettings } from '@/lib/agent-profile/agent-profile-settings';

/**
 * GET /api/profile-settings
 * Retrieves profile settings from the server filesystem
 */
export async function GET() {
  try {
    const settings = await loadProfileSettingsFromFile();
    return NextResponse.json({ 
      settings: settings || defaultAgentProfileSettings,
      source: settings ? 'file' : 'default'
    });
  } catch (error) {
    console.error('Error in GET /api/profile-settings:', error);
    return NextResponse.json(
      { error: 'Failed to load profile settings', message: String(error) }, 
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
    const { settings } = await request.json();
    
    if (!settings) {
      return NextResponse.json(
        { error: 'No settings provided' }, 
        { status: 400 }
      );
    }
    
    await saveProfileSettingsToFile(settings);
    
    return NextResponse.json({ success: true, message: 'Profile settings saved successfully' });
  } catch (error) {
    console.error('Error in POST /api/profile-settings:', error);
    return NextResponse.json(
      { error: 'Failed to save profile settings', message: String(error) }, 
      { status: 500 }
    );
  }
}
