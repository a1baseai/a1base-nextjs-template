import { NextRequest, NextResponse } from 'next/server';
import { 
  loadGroupOnboardingFlowFromFile, 
  saveGroupOnboardingFlowToFile,
  initializeDataDirectory
} from '@/lib/storage/server-file-storage';
import { GroupOnboardingFlow } from '@/lib/onboarding-flow/types';
// Define route configuration directly in this file
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET handler for retrieving group onboarding flow
 */
export async function GET() {
  try {
    console.log('🔄 [API] Loading group onboarding flow...');
    
    // Make sure the data directory exists before attempting to read
    await initializeDataDirectory();
    
    // Set a reasonable timeout for file operations
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('File operation timed out')), 5000);
    });
    
    // Load group onboarding flow from file with timeout
    const flow = await Promise.race([
      loadGroupOnboardingFlowFromFile(),
      timeoutPromise
    ]).catch(error => {
      console.error('⚠️ [API] Timed out or error loading group onboarding flow:', error);
      return null;
    });
    
    if (flow) {
      console.log('✅ [API] Successfully loaded group onboarding flow');
      return NextResponse.json({ flow }, { status: 200 });
    } else {
      console.error('❌ [API] Group onboarding flow not found');
      return NextResponse.json(
        { error: 'Group onboarding flow not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('❌ [API] Error loading group onboarding flow:', error);
    // Return an error response when flow cannot be loaded
    return NextResponse.json(
      { error: 'Failed to load group onboarding flow', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}

/**
 * POST handler for saving group onboarding flow
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [API] Saving group onboarding flow...');
    
    // Make sure the data directory exists before attempting to write
    await initializeDataDirectory();
    
    // Parse request body with extra error handling
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('✅ [API] Successfully parsed request JSON');
    } catch (parseError) {
      console.error('❌ [API] Failed to parse request JSON:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse request JSON', details: parseError instanceof Error ? parseError.message : 'Unknown error' }, 
        { status: 400 }
      );
    }
    
    const { flow } = requestBody;
    
    if (!flow) {
      console.error('❌ [API] No flow data provided');
      return NextResponse.json(
        { error: 'No flow data provided' }, 
        { status: 400 }
      );
    }
    
    // Log a sample of the flow to help with debugging
    console.log('✅ [API] Flow structure validation:', {
      hasEnabled: 'enabled' in flow,
      hasMode: 'mode' in flow,
      hasAgenticSettings: 'agenticSettings' in flow,
    });
    
    // Set a reasonable timeout for file operations
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('File save operation timed out')), 5000);
    });
    
    // Save flow to file with timeout
    await Promise.race([
      saveGroupOnboardingFlowToFile(flow),
      timeoutPromise
    ]).catch(error => {
      console.error('⚠️ [API] Timed out or error saving group onboarding flow:', error);
      throw error; // Re-throw to be caught by outer try/catch
    });
    
    console.log('✅ [API] Successfully saved group onboarding flow');
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ [API] Error saving group onboarding flow:', error);
    return NextResponse.json(
      { error: 'Failed to save group onboarding flow', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
