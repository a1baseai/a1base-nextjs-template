/**
 * Base Information API Route
 * 
 * Handles saving and loading agent base information to/from server-side files.
 * This allows information to persist across dev environment restarts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveBaseInformationToFile, loadBaseInformationFromFile } from '@/lib/storage/server-file-storage';
import { defaultBaseInformation } from '@/lib/agent-profile/agent-base-information';

/**
 * GET /api/base-information
 * Retrieves base information from the server filesystem
 */
export async function GET() {
  try {
    const information = await loadBaseInformationFromFile();
    return NextResponse.json({ 
      information: information || defaultBaseInformation,
      source: information ? 'file' : 'default'
    });
  } catch (error) {
    console.error('Error in GET /api/base-information:', error);
    return NextResponse.json(
      { error: 'Failed to load base information', message: String(error) }, 
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
    const { information } = await request.json();
    
    if (!information) {
      return NextResponse.json(
        { error: 'No information provided' }, 
        { status: 400 }
      );
    }
    
    await saveBaseInformationToFile(information);
    
    return NextResponse.json({ success: true, message: 'Base information saved successfully' });
  } catch (error) {
    console.error('Error in POST /api/base-information:', error);
    return NextResponse.json(
      { error: 'Failed to save base information', message: String(error) }, 
      { status: 500 }
    );
  }
}
