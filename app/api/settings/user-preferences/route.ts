import { NextRequest, NextResponse } from "next/server";
import { getInitializedAdapter } from "@/lib/supabase/config";
import { UserPreferences } from "@/types/chat";

/**
 * GET /api/settings/user-preferences
 * Retrieves user preferences by phone number
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get('phone_number');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Normalize phone number (remove + and spaces)
    const normalizedPhone = phoneNumber.replace(/\+|\s/g, "");
    
    // Get user by phone number
    const user = await adapter.getUserByPhone(normalizedPhone);
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Extract preferences from metadata
    const preferences: UserPreferences = user.metadata?.preferences || {};
    
    return NextResponse.json({
      success: true,
      preferences
    });

  } catch (error) {
    console.error('[USER_PREFERENCES_GET] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/user-preferences
 * Updates user preferences by phone number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number, preferences } = body;

    if (!phone_number || !preferences) {
      return NextResponse.json(
        { error: "Phone number and preferences are required" },
        { status: 400 }
      );
    }

    const adapter = await getInitializedAdapter();
    if (!adapter) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone_number.replace(/\+|\s/g, "");
    
    // Get current user to preserve existing metadata
    const currentUser = await adapter.getUserByPhone(normalizedPhone);
    
    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Merge new preferences with existing metadata
    const updatedMetadata = {
      ...currentUser.metadata,
      preferences: {
        ...currentUser.metadata?.preferences,
        ...preferences
      }
    };

    // Update user metadata
    const success = await adapter.updateUser(normalizedPhone, {
      metadata: updatedMetadata
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Preferences updated successfully",
      preferences: updatedMetadata.preferences
    });

  } catch (error) {
    console.error('[USER_PREFERENCES_POST] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 