import fs from 'fs';
import path from 'path';
import { streamText } from "ai";

// Import AI SDK models dynamically to prevent build-time errors
const importOpenAI = async () => {
  const { openai } = await import("@ai-sdk/openai");
  return openai;
};

const importAnthropic = async () => {
  const { anthropic } = await import("@ai-sdk/anthropic");
  return anthropic;
};

// Define the path to the settings file
const settingsFilePath = path.join(process.cwd(), "data", "model-settings.json");

// Get the selected model provider
export function getSelectedModelProvider(): string {
  try {
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

// Get the appropriate model based on the provider
export async function getModelForProvider(provider: string) {
  switch (provider) {
    case "anthropic":
      const anthropicFn = await importAnthropic();
      return anthropicFn("claude-3-opus-20240229");
    case "grok":
      // Grok is currently not supported in the AI SDK
      // For now, we'll fall back to OpenAI
      console.warn("Grok is not yet supported in the AI SDK, falling back to OpenAI");
      const openAiFallback = await importOpenAI();
      return openAiFallback("gpt-4");
    case "openai":
    default:
      const openAiFn = await importOpenAI();
      return openAiFn("gpt-4");
  }
}

// Create a text stream with the appropriate model
export function createModelStream(messages: any[]) {
  const provider = getSelectedModelProvider();
  console.log(`Using model provider: ${provider}`);
  
  // Return an object with the full stream and specific streams separated
  const result = {
    fullStream: null as any,
    async getStream() {
      // Fetch the model asynchronously when actually needed
      const model = await getModelForProvider(provider);
      
      // Create and cache the stream
      if (!this.fullStream) {
        this.fullStream = streamText({
          model: model,
          messages: messages,
        });
      }
      
      return this.fullStream;
    }
  };
  
  // Initialize the stream immediately for backward compatibility
  result.getStream();
  
  return result;
}
