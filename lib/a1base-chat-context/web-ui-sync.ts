import { MessageRecord } from "@/types/chat";

interface SyncPayload {
    external_thread_id: string;
    content: string;
    service: "web-ui";
    phone_number: string;
    external_message_id: string;
    from_agent: boolean;
    sender_number: string;
    message_type: "text";
    timestamp: number;
}

/**
 * Sends a web UI message to the A1Base sync endpoint.
 * This is used to keep A1Base aware of conversations happening on the web UI.
 */
export async function syncWebUiMessage(message: {
    chatRecordId: string,
    messageRecordId: string,
    content: string,
    /** The sender identifier. Use agent's number for agent, or another string for user. */
    senderIdentifier: string,
    timestamp: number,
}) {
    const A1BASE_ACCOUNT_ID = process.env.A1BASE_ACCOUNT_ID;
    const A1BASE_AGENT_NUMBER = process.env.A1BASE_AGENT_NUMBER;
    const A1BASE_API_KEY = process.env.A1BASE_API_KEY;
    const A1BASE_API_SECRET = process.env.A1BASE_API_SECRET;

    if (!A1BASE_ACCOUNT_ID || !A1BASE_AGENT_NUMBER || !A1BASE_API_KEY || !A1BASE_API_SECRET) {
        console.error("[WebUI-Sync] Missing A1Base configuration in environment variables. Skipping sync.");
        return;
    }

    const isFromAgent = message.senderIdentifier === A1BASE_AGENT_NUMBER;
    // Convert web-ui-user to empty string for consistency with A1Base API
    const senderNumber = message.senderIdentifier === 'web-ui-user' ? '' : message.senderIdentifier;
    
    const payload: SyncPayload = {
        external_thread_id: message.chatRecordId,
        content: message.content,
        service: "web-ui",
        phone_number: A1BASE_AGENT_NUMBER,
        external_message_id: message.messageRecordId,
        from_agent: isFromAgent,
        sender_number: senderNumber, // Use the processed senderNumber instead of raw senderIdentifier
        message_type: "text",
        timestamp: message.timestamp, // Remove multiplication since timestamp is already in ms
    };
    
    const url = `https://api.a1base.com/v1/messages/${A1BASE_ACCOUNT_ID}/save/web-ui`;
    
    try {
        console.log(`[WebUI-Sync] Sending message to A1Base: ${message.messageRecordId}`);
        console.log(`[WebUI-Sync] Payload:`, payload);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': A1BASE_API_KEY,
                'x-api-secret': A1BASE_API_SECRET,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[WebUI-Sync] Error sending message to A1Base. Status: ${response.status}. Body: ${errorBody}`);
        } else {
            const responseData = await response.json();
            console.log(`[WebUI-Sync] Successfully sent message to A1Base: ${message.messageRecordId}`, responseData);
        }
    } catch (error) {
        console.error("[WebUI-Sync] Exception while sending message to A1Base:", error);
    }
} 