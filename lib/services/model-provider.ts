import fs from 'fs';
import path from 'path';
import { streamText } from "ai";

// Determine if we're in a build context to avoid initializing clients
const isBuildContext = process.env.NODE_ENV === 'production' && 
                      (process.env.NEXT_PHASE === 'phase-production-build' ||
                       !process.env.OPENAI_API_KEY);

// Define the path to the settings file
const settingsFilePath = path.join(process.cwd(), "data", "model-settings.json");

// Get the selected model provider from settings
export function getSelectedModelProvider(): string {
  try {
    if (isBuildContext) return "openai"; // Default during build
    
    // First check if we have a settings file
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
      return settings.selectedModelProvider || process.env.SELECTED_MODEL_PROVIDER || "openai";
    }
    
    // Fall back to environment variable or default
    return process.env.SELECTED_MODEL_PROVIDER || "openai";
  } catch (error) {
    console.error("Error getting selected model provider:", error);
    return "openai"; // Default fallback
  }
}

// Create a text stream with the appropriate model
export function createModelStream(messages: any[]) {
  // During build time, return a dummy object
  if (isBuildContext) {
    console.log("Build context detected, returning dummy stream data");
    return {
      fullStream: null,
    };
  }

  // For normal runtime execution
  try {
    const provider = getSelectedModelProvider();
    console.log(`Using model provider: ${provider}`);
    
    // Create a clean implementation for each provider
    let modelProvider: any;
    
    switch (provider) {
      case "anthropic":
        // Only import and use Anthropic during runtime, not build
        const { anthropic } = require("@ai-sdk/anthropic");
        modelProvider = anthropic("claude-3-opus-20240229");
        break;
        
      case "grok":
        // Grok not supported in AI SDK, fall back to OpenAI
        console.warn("Grok is not yet supported in the AI SDK, falling back to OpenAI");
        const { openai: openaiGrok } = require("@ai-sdk/openai");
        modelProvider = openaiGrok("gpt-4");
        break;
        
      case "openai":
      default:
        const { openai } = require("@ai-sdk/openai");
        modelProvider = openai("gpt-4");
        break;
    }
    
    // Create the stream
    const stream = streamText({
      model: modelProvider,
      messages: messages,
    });
    
    return { fullStream: stream };
  } catch (error: any) {
    console.error('Error creating model stream:', error);
    throw new Error(`Failed to create AI stream: ${error?.message || 'Unknown error'}`);
  }
}
