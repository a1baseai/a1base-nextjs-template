import { NextRequest, NextResponse } from 'next/server';
import { 
  loadGroupOnboardingFlowFromFile, 
  saveGroupOnboardingFlowToFile 
} from '@/lib/storage/server-file-storage';
import { defaultGroupOnboardingFlow } from '@/lib/onboarding-flow/types';
import { dynamic, runtime, maxDuration } from '@/app/api/route-config';

// Export the route configuration
export { dynamic, runtime, maxDuration };

/**
 * GET handler for retrieving group onboarding flow
 */
export async function GET() {
  try {
    console.log('🔄 [API] Loading group onboarding flow...');
    
    // Load group onboarding flow from file
    const flow = await loadGroupOnboardingFlowFromFile();
    
    if (flow) {
      console.log('✅ [API] Successfully loaded group onboarding flow');
      return NextResponse.json({ flow }, { status: 200 });
    } else {
      console.log('⚠️ [API] Group onboarding flow not found, returning default');
      return NextResponse.json({ flow: defaultGroupOnboardingFlow }, { status: 200 });
    }
  } catch (error) {
    console.error('❌ [API] Error loading group onboarding flow:', error);
    return NextResponse.json(
      { error: 'Failed to load group onboarding flow' }, 
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
    
    // Save flow to file
    await saveGroupOnboardingFlowToFile(flow);
    
    console.log('✅ [API] Successfully saved group onboarding flow');
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ [API] Error saving group onboarding flow:', error);
    return NextResponse.json(
      { error: 'Failed to save group onboarding flow' }, 
      { status: 500 }
    );
  }
}
