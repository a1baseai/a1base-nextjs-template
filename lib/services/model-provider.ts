import fs from 'fs';
import path from 'path';
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

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
export function getModelForProvider(provider: string) {
  switch (provider) {
    case "anthropic":
      return anthropic("claude-3-opus-20240229");
    case "grok":
      // Grok is currently not supported in the AI SDK
      // For now, we'll fall back to OpenAI
      console.warn("Grok is not yet supported in the AI SDK, falling back to OpenAI");
      return openai("gpt-4");
    case "openai":
    default:
      return openai("gpt-4");
  }
}

// Create a text stream with the appropriate model
export function createModelStream(messages: any[]) {
  const provider = getSelectedModelProvider();
  const model = getModelForProvider(provider);

  console.log(`Using model provider: ${provider}`);

  return streamText({
    model: model,
    messages: messages,
  });
}
