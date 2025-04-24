import { NextRequest, NextResponse } from "next/server";
import { A1BaseAPI } from "a1base-node";

const client = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

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

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Profile name is required" },
        { status: 400 }
      );
    }

    // Call the A1BASE API to update the profile name
    const response = await fetch(
      `https://api.a1base.com/v1/profile-settings/${process.env.A1BASE_ACCOUNT_ID}/update-profile-name`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.A1BASE_API_KEY!,
          "x-api-secret": process.env.A1BASE_API_SECRET!,
        },
        body: JSON.stringify({
          agent_number: process.env.A1BASE_AGENT_NUMBER,
          name: name,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Error updating WhatsApp profile name:", data);
      return NextResponse.json(
        { 
          success: false, 
          message: data.message || "Failed to update WhatsApp profile name" 
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "WhatsApp profile name updated successfully",
      data,
    });
  } catch (error) {
    console.error("Error updating WhatsApp profile name:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error occurred" 
      },
      { status: 500 }
    );
  }
}
