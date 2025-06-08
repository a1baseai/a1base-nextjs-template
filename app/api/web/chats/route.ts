import { NextRequest, NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";

function getUserIdFromHeaders(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 401 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const chats = await adapter.getChatsForUser(userId);
    
    return NextResponse.json({
      success: true,
      chats: chats
    });
  } catch (error) {
    console.error('[API] Error fetching user chats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 401 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    const chat = await adapter.createChat(userId);
    if (!chat) {
      return NextResponse.json(
        { success: false, error: 'Failed to create chat' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chat: chat
    });
  } catch (error) {
    console.error('[API] Error creating chat:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 