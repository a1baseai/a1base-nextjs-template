import { NextRequest, NextResponse } from "next/server";
import { A1BaseAPI } from "a1base-node";
import { sendMultimediaMessage, validateMediaUrl, MediaType } from "@/lib/messaging/multimedia-handler";

const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { 
      threadType, 
      recipientId, 
      mediaUrl, 
      mediaType, 
      caption 
    } = await request.json();

    // Validate required fields
    if (!process.env.A1BASE_ACCOUNT_ID) {
      return NextResponse.json(
        { success: false, message: "A1BASE_ACCOUNT_ID is not configured" },
        { status: 500 }
      );
    }

    if (!process.env.A1BASE_AGENT_NUMBER) {
      return NextResponse.json(
        { success: false, message: "A1BASE_AGENT_NUMBER is not configured" },
        { status: 400 }
      );
    }

    if (!threadType || !recipientId || !mediaUrl || !mediaType) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Missing required fields: threadType, recipientId, mediaUrl, and mediaType are required" 
        },
        { status: 400 }
      );
    }

    // Validate thread type
    if (threadType !== 'individual' && threadType !== 'group') {
      return NextResponse.json(
        { 
          success: false, 
          message: "Invalid threadType. Must be 'individual' or 'group'" 
        },
        { status: 400 }
      );
    }

    // Validate media type
    const validMediaTypes: MediaType[] = ['image', 'video', 'audio', 'document'];
    if (!validMediaTypes.includes(mediaType as MediaType)) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Invalid mediaType. Must be one of: image, video, audio, document" 
        },
        { status: 400 }
      );
    }

    // Validate media URL is accessible
    const isValidUrl = await validateMediaUrl(mediaUrl);
    if (!isValidUrl) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Media URL is not accessible. Please ensure the URL is publicly accessible." 
        },
        { status: 400 }
      );
    }

    // Send the multimedia message
    await sendMultimediaMessage(
      client,
      process.env.A1BASE_ACCOUNT_ID,
      threadType,
      recipientId,
      mediaUrl,
      mediaType as MediaType,
      caption
    );

    return NextResponse.json({
      success: true,
      message: "Multimedia message sent successfully",
      data: {
        threadType,
        recipientId,
        mediaType,
        mediaUrl,
        caption
      }
    });
  } catch (error) {
    console.error("Error sending multimedia message:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error occurred" 
      },
      { status: 500 }
    );
  }
} 