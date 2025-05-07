import { NextResponse } from 'next/server';

/**
 * This endpoint previously cleared the onboarding cache
 * It's now a placeholder since we've removed all caching from the system
 */
export async function GET() {
  // Cache has been completely removed from the system
  // No action needed - the system now always uses fresh database state
  return NextResponse.json({ 
    success: true, 
    message: 'Cache system has been removed - all database lookups are now performed directly' 
  });
}
