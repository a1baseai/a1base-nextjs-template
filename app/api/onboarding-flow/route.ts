import { NextRequest, NextResponse } from 'next/server';
import { 
  loadOnboardingFlowFromFile, 
  saveOnboardingFlowToFile 
} from '@/lib/storage/server-file-storage';
import { defaultOnboardingFlow } from '@/lib/onboarding-flow/types';
// Define route configuration directly in this file
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET handler for retrieving onboarding flow
 */
export async function GET() {
  try {
    console.log('🔄 [API] Loading onboarding flow...');
    
    // Load onboarding flow from file
    const flow = await loadOnboardingFlowFromFile();
    
    if (flow) {
      console.log('✅ [API] Successfully loaded onboarding flow');
      return NextResponse.json({ flow }, { status: 200 });
    } else {
      console.log('⚠️ [API] Onboarding flow not found, returning default');
      return NextResponse.json({ flow: defaultOnboardingFlow }, { status: 200 });
    }
  } catch (error) {
    console.error('❌ [API] Error loading onboarding flow:', error);
    return NextResponse.json(
      { error: 'Failed to load onboarding flow' }, 
      { status: 500 }
    );
  }
}

/**
 * POST handler for saving onboarding flow
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [API] Saving onboarding flow...');
    
    // Parse request body
    const { flow } = await request.json();
    
    if (!flow) {
      console.error('❌ [API] No flow data provided');
      return NextResponse.json(
        { error: 'No flow data provided' }, 
        { status: 400 }
      );
    }
    
    // Save flow to file
    await saveOnboardingFlowToFile(flow);
    
    console.log('✅ [API] Successfully saved onboarding flow');
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ [API] Error saving onboarding flow:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding flow' }, 
      { status: 500 }
    );
  }
}
