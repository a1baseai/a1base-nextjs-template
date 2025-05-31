import { NextRequest, NextResponse } from 'next/server';
import { resetGroupOnboardingState } from '@/lib/workflows/group-onboarding-workflow';

export const dynamic = 'force-dynamic';

/**
 * POST handler for resetting group onboarding state
 * 
 * Body: { thread_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { thread_id } = body;
    
    if (!thread_id) {
      return NextResponse.json(
        { error: 'thread_id is required' },
        { status: 400 }
      );
    }
    
    console.log(`[API] Resetting group onboarding for thread: ${thread_id}`);
    
    const success = await resetGroupOnboardingState(thread_id);
    
    if (success) {
      return NextResponse.json(
        { 
          success: true, 
          message: `Successfully reset onboarding state for thread ${thread_id}` 
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to reset onboarding state for thread ${thread_id}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Error resetting group onboarding:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to reset group onboarding', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 