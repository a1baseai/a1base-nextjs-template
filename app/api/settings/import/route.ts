import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import * as path from "path"

// Whitelist of allowed files to import for security
const ALLOWED_FILES = [
  "profile-settings.json",
  "group-onboarding-flow.json",
  "onboarding-flow.json",
  "safety-settings.json",
  "message-settings.json",
  "agent-memory-settings.json",
  "base-information.json",
  "model-settings.json",
]

// Validation schemas for each file type (basic validation)
const FILE_VALIDATIONS: { [key: string]: (data: any) => boolean } = {
  "profile-settings.json": (data) => {
    return typeof data === "object" && 
           (data.name === undefined || typeof data.name === "string") &&
           (data.role === undefined || typeof data.role === "string")
  },
  "group-onboarding-flow.json": (data) => {
    return typeof data === "object" && 
           typeof data.enabled === "boolean"
  },
  "onboarding-flow.json": (data) => {
    return typeof data === "object" && 
           typeof data.enabled === "boolean"
  },
  "safety-settings.json": (data) => {
    return typeof data === "object" && 
           typeof data.enabled === "boolean"
  },
  "message-settings.json": (data) => {
    return typeof data === "object" && 
           typeof data.splitParagraphs === "boolean"
  },
  "agent-memory-settings.json": (data) => {
    return typeof data === "object" && 
           typeof data.userMemoryEnabled === "boolean" &&
           typeof data.chatMemoryEnabled === "boolean"
  },
  "base-information.json": (data) => {
    return typeof data === "object"
  },
  "model-settings.json": (data) => {
    return typeof data === "object" && 
           (data.model === undefined || typeof data.model === "string")
  },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileName, data } = body

    if (!fileName || !data) {
      return NextResponse.json(
        { error: "File name and data are required" },
        { status: 400 }
      )
    }

    // Security check: ensure the file is in our whitelist
    if (!ALLOWED_FILES.includes(fileName)) {
      return NextResponse.json(
        { error: "File not allowed for import" },
        { status: 403 }
      )
    }

    // Security check: prevent path traversal
    if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      return NextResponse.json(
        { error: "Invalid file name" },
        { status: 400 }
      )
    }

    // Validate the data structure
    const validator = FILE_VALIDATIONS[fileName]
    if (validator && !validator(data)) {
      return NextResponse.json(
        { error: "Invalid data structure for this file type" },
        { status: 400 }
      )
    }

    const filePath = path.join(process.cwd(), "data", fileName)

    try {
      // Create backup of existing file
      try {
        const existingContent = await fs.readFile(filePath, "utf-8")
        const backupPath = path.join(process.cwd(), "data", `.${fileName}.backup`)
        await fs.writeFile(backupPath, existingContent, "utf-8")
      } catch (error) {
        // File might not exist, which is okay
        console.log(`No existing file to backup for ${fileName}`)
      }

      // Write the new data
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")

      return NextResponse.json({ 
        success: true,
        message: `Successfully imported ${fileName}`
      })
    } catch (error) {
      console.error(`Error writing file ${fileName}:`, error)
      
      // Try to restore from backup
      try {
        const backupPath = path.join(process.cwd(), "data", `.${fileName}.backup`)
        const backupContent = await fs.readFile(backupPath, "utf-8")
        await fs.writeFile(filePath, backupContent, "utf-8")
        console.log(`Restored ${fileName} from backup`)
      } catch (restoreError) {
        console.error(`Failed to restore backup for ${fileName}:`, restoreError)
      }

      throw error
    }
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      { 
        error: "Failed to import file",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
} 