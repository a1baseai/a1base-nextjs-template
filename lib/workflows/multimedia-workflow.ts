/**
 * Multimedia workflow functions for handling media messages through WhatsApp
 * 
 * This module provides workflows for:
 * - Sending images with captions
 * - Sending videos
 * - Sending audio messages
 * - Sending documents
 * - Handling location sharing
 */

import { ThreadMessage } from "@/types/chat";
import { A1BaseAPI } from "a1base-node";
import { sendMultimediaMessage, MediaType, validateMediaUrl } from "../messaging/multimedia-handler";
import { generateAgentResponse } from "../services/openai";

// Initialize A1Base client
const a1BaseClient = new A1BaseAPI({
  credentials: {
    apiKey: process.env.A1BASE_API_KEY!,
    apiSecret: process.env.A1BASE_API_SECRET!,
  },
});

const A1BASE_ACCOUNT_ID = process.env.A1BASE_ACCOUNT_ID!;
const A1BASE_AGENT_NUMBER = process.env.A1BASE_AGENT_NUMBER!;

/**
 * Send a product image with description
 */
export async function SendProductImage(
  threadMessages: ThreadMessage[],
  productImageUrl: string,
  productName: string,
  productDescription: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  console.log(`[SendProductImage] Sending product image: ${productName}`);
  
  try {
    // Validate the image URL
    const isValid = await validateMediaUrl(productImageUrl);
    if (!isValid) {
      throw new Error("Product image URL is not accessible");
    }

    // Create caption
    const caption = `${productName}\n\n${productDescription}`;
    
    // Determine recipient
    const recipientId = thread_type === "group" ? thread_id : sender_number;
    if (!recipientId) {
      throw new Error("No recipient ID available");
    }

    // Send the image
    await sendMultimediaMessage(
      a1BaseClient,
      A1BASE_ACCOUNT_ID,
      thread_type,
      recipientId,
      productImageUrl,
      'image',
      caption
    );

    return `Product image for ${productName} has been sent successfully.`;
  } catch (error) {
    console.error("[SendProductImage] Error:", error);
    throw error;
  }
}

/**
 * Send a video tutorial or demo
 */
export async function SendVideoTutorial(
  threadMessages: ThreadMessage[],
  videoUrl: string,
  tutorialTitle: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  console.log(`[SendVideoTutorial] Sending video: ${tutorialTitle}`);
  
  try {
    // Validate the video URL
    const isValid = await validateMediaUrl(videoUrl);
    if (!isValid) {
      throw new Error("Video URL is not accessible");
    }

    // Determine recipient
    const recipientId = thread_type === "group" ? thread_id : sender_number;
    if (!recipientId) {
      throw new Error("No recipient ID available");
    }

    // Send the video
    await sendMultimediaMessage(
      a1BaseClient,
      A1BASE_ACCOUNT_ID,
      thread_type,
      recipientId,
      videoUrl,
      'video',
      `Tutorial: ${tutorialTitle}`
    );

    return `Video tutorial "${tutorialTitle}" has been sent successfully.`;
  } catch (error) {
    console.error("[SendVideoTutorial] Error:", error);
    throw error;
  }
}

/**
 * Send a document (PDF, DOC, etc.)
 */
export async function SendDocument(
  threadMessages: ThreadMessage[],
  documentUrl: string,
  documentName: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  documentDescription?: string,
  service?: string
): Promise<string> {
  console.log(`[SendDocument] Sending document: ${documentName}`);
  
  try {
    // Validate the document URL
    const isValid = await validateMediaUrl(documentUrl);
    if (!isValid) {
      throw new Error("Document URL is not accessible");
    }

    // Determine recipient
    const recipientId = thread_type === "group" ? thread_id : sender_number;
    if (!recipientId) {
      throw new Error("No recipient ID available");
    }

    // Create caption
    const caption = documentDescription 
      ? `${documentName}\n${documentDescription}`
      : documentName;

    // Send the document
    await sendMultimediaMessage(
      a1BaseClient,
      A1BASE_ACCOUNT_ID,
      thread_type,
      recipientId,
      documentUrl,
      'document',
      caption
    );

    return `Document "${documentName}" has been sent successfully.`;
  } catch (error) {
    console.error("[SendDocument] Error:", error);
    throw error;
  }
}

/**
 * Send an audio message or voice note
 */
export async function SendAudioMessage(
  threadMessages: ThreadMessage[],
  audioUrl: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  audioDescription?: string,
  service?: string
): Promise<string> {
  console.log(`[SendAudioMessage] Sending audio message`);
  
  try {
    // Validate the audio URL
    const isValid = await validateMediaUrl(audioUrl);
    if (!isValid) {
      throw new Error("Audio URL is not accessible");
    }

    // Determine recipient
    const recipientId = thread_type === "group" ? thread_id : sender_number;
    if (!recipientId) {
      throw new Error("No recipient ID available");
    }

    // Send the audio
    await sendMultimediaMessage(
      a1BaseClient,
      A1BASE_ACCOUNT_ID,
      thread_type,
      recipientId,
      audioUrl,
      'audio',
      audioDescription
    );

    return "Audio message has been sent successfully.";
  } catch (error) {
    console.error("[SendAudioMessage] Error:", error);
    throw error;
  }
}

/**
 * Handle incoming media and respond appropriately
 */
export async function HandleIncomingMedia(
  threadMessages: ThreadMessage[],
  mediaType: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  mediaData?: string,
  caption?: string,
  service?: string
): Promise<string> {
  console.log(`[HandleIncomingMedia] Processing ${mediaType} media`);
  
  try {
    // Generate a contextual response based on the media type
    const latestMessage = threadMessages[threadMessages.length - 1];
    let prompt = "";
    
    switch (mediaType) {
      case 'image':
        prompt = `The user has sent an image${caption ? ` with caption: "${caption}"` : ''}. Acknowledge receipt and ask if they need any help with it.`;
        break;
      case 'video':
        prompt = `The user has sent a video${caption ? ` with caption: "${caption}"` : ''}. Acknowledge receipt and ask if they'd like to discuss it.`;
        break;
      case 'audio':
        prompt = `The user has sent an audio message. Acknowledge receipt and mention you've received their voice message.`;
        break;
      case 'document':
        prompt = `The user has sent a document${caption ? ` titled: "${caption}"` : ''}. Acknowledge receipt and ask if they need help reviewing it.`;
        break;
      case 'location':
        prompt = `The user has shared their location. Acknowledge receipt and ask how you can help them with location-based services.`;
        break;
      default:
        prompt = `The user has sent a ${mediaType} message. Acknowledge receipt appropriately.`;
    }

    const response = await generateAgentResponse(
      threadMessages,
      prompt,
      thread_type
    );

    return response;
  } catch (error) {
    console.error("[HandleIncomingMedia] Error:", error);
    return "I've received your media message. How can I help you with it?";
  }
}

/**
 * Send a gallery of images (multiple images in sequence)
 */
export async function SendImageGallery(
  threadMessages: ThreadMessage[],
  images: Array<{ url: string; caption?: string }>,
  galleryTitle: string,
  thread_type: "individual" | "group",
  thread_id?: string,
  sender_number?: string,
  service?: string
): Promise<string> {
  console.log(`[SendImageGallery] Sending gallery: ${galleryTitle}`);
  
  try {
    // Determine recipient
    const recipientId = thread_type === "group" ? thread_id : sender_number;
    if (!recipientId) {
      throw new Error("No recipient ID available");
    }

    // Send intro message
    const introMessage = {
      content: `📸 ${galleryTitle} (${images.length} images)`,
      from: A1BASE_AGENT_NUMBER,
      service: "whatsapp" as const,
    };

    if (thread_type === "group") {
      await a1BaseClient.sendGroupMessage(A1BASE_ACCOUNT_ID, {
        ...introMessage,
        thread_id: recipientId,
      });
    } else {
      await a1BaseClient.sendIndividualMessage(A1BASE_ACCOUNT_ID, {
        ...introMessage,
        to: recipientId,
      });
    }

    // Send each image with a small delay
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // Validate image URL
      const isValid = await validateMediaUrl(image.url);
      if (!isValid) {
        console.warn(`[SendImageGallery] Skipping invalid image URL: ${image.url}`);
        continue;
      }

      const imageCaption = image.caption || `Image ${i + 1} of ${images.length}`;
      
      await sendMultimediaMessage(
        a1BaseClient,
        A1BASE_ACCOUNT_ID,
        thread_type,
        recipientId,
        image.url,
        'image',
        imageCaption
      );

      // Add a small delay between images to avoid overwhelming the recipient
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return `Gallery "${galleryTitle}" with ${images.length} images has been sent successfully.`;
  } catch (error) {
    console.error("[SendImageGallery] Error:", error);
    throw error;
  }
} 