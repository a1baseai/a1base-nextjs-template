import { NextRequest, NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";

function getUserIdFromHeaders(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 401 }
      );
    }

    const { chatId } = await params;
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID required' },
        { status: 400 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const success = await adapter.addUserToChat(chatId, userId);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to join chat' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('[API] Error joining chat:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 