import { NextResponse } from "next/server";
import { A1BaseAPI } from "a1base-node";

const client = new A1BaseAPI({
    credentials: {
      apiKey: process.env.A1BASE_API_KEY!,
      apiSecret: process.env.A1BASE_API_SECRET!,
    }
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, to, thread_id, thread_type = "individual" } = body;

    const messageData = {
      content,
      from: process.env.A1BASE_AGENT_NUMBER!,
      service: "whatsapp" as const,
    };

    if (thread_type === "individual") {
      await client.sendIndividualMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...messageData,
        to,
      });
    } else {
      await client.sendGroupMessage(process.env.A1BASE_ACCOUNT_ID!, {
        ...messageData,
        thread_id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Send] Error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
