import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import * as path from "path"

// Whitelist of allowed files to export for security
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get("file")

    if (!fileName) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      )
    }

    // Security check: ensure the file is in our whitelist
    if (!ALLOWED_FILES.includes(fileName)) {
      return NextResponse.json(
        { error: "File not allowed for export" },
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

    const filePath = path.join(process.cwd(), "data", fileName)

    try {
      // Check if file exists
      await fs.access(filePath)
      
      // Read the file
      const fileContent = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(fileContent)

      return NextResponse.json(data)
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: "Failed to export file" },
      { status: 500 }
    )
  }
} 