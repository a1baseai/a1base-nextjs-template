import fs from "fs";
import path from "path";

/**
 * Get message splitting setting from configuration file
 * This determines if long messages should be split into multiple messages
 */
export async function getSplitMessageSetting(): Promise<boolean> {
  try {
    const settingsFilePath = path.join(
      process.cwd(),
      "data",
      "message-settings.json"
    );
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf-8"));
      return settings.splitParagraphs || false;
    }
  } catch (error) {
    console.error("Error loading message settings:", error);
  }
  return false; // Default to false if settings can't be loaded
}
