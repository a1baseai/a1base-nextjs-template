import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { dynamic, runtime, maxDuration } from "../route-config";

// Export the route configuration to prevent Next.js from trying
// to access file system during build time
export { dynamic, runtime, maxDuration };

// Path to the workflows directory
const WORKFLOWS_DIR = path.join(process.cwd(), "lib", "workflows");

// Check if we're in a build context
const isBuildTime = () => {
  return process.env.NODE_ENV === 'production' && 
         (process.env.NEXT_PHASE === 'phase-production-build' || 
          !process.env.OPENAI_API_KEY);
};

// Get display name from file path
const getDisplayName = (filePath: string): string => {
  const fileName = path.basename(filePath, '.ts');
  return fileName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export async function GET() {
  console.log('[WORKFLOWS-API] GET request received for workflows');
  
  try {
    // Handle build-time context without file system access
    if (isBuildTime()) {
      console.log('[WORKFLOWS-API] Build-time context detected, returning mock data');
      return NextResponse.json({ 
        workflows: [
          { 
            name: "Basic Workflow", 
            path: "/lib/workflows/basic_workflow.ts",
            content: "// This is a placeholder for workflow file during build time."
          }
        ]
      });
    }
    
    // Read the workflows directory
    const files = await fs.readdir(WORKFLOWS_DIR);
    console.log(`[WORKFLOWS-API] Found ${files.length} workflow files`);
    
    // Filter for TypeScript files only
    const workflowFiles = files.filter(file => file.endsWith('.ts'));
    
    // Read each file's content
    const workflows = await Promise.all(
      workflowFiles.map(async (file) => {
        const filePath = path.join(WORKFLOWS_DIR, file);
        const content = await fs.readFile(filePath, "utf8");
        const relativePath = path.relative(process.cwd(), filePath);
        
        return {
          name: getDisplayName(file),
          path: relativePath,
          content
        };
      })
    );
    
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error('[WORKFLOWS-API] Error reading workflow files:', error);
    return NextResponse.json(
      { error: "Failed to read workflow files" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  console.log('[WORKFLOWS-API] PUT request received for updating workflow');
  
  try {
    // Handle build-time context without file system access
    if (isBuildTime()) {
      console.log('[WORKFLOWS-API] Build-time context detected, returning mock response');
      return NextResponse.json({ success: true });
    }
    
    // Parse the request body
    const { path: filePath, content } = await req.json();
    
    if (!filePath || !content) {
      return NextResponse.json(
        { error: "Path and content are required" },
        { status: 400 }
      );
    }
    
    // Ensure the file is within the workflows directory
    const absolutePath = path.join(process.cwd(), filePath);
    if (!absolutePath.startsWith(WORKFLOWS_DIR)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }
    
    // Create a backup of the original file
    const backupPath = `${absolutePath}.bak`;
    const originalContent = await fs.readFile(absolutePath, "utf8");
    await fs.writeFile(backupPath, originalContent);
    console.log(`[WORKFLOWS-API] Created backup: ${backupPath}`);
    
    // Write the new content
    await fs.writeFile(absolutePath, content);
    console.log(`[WORKFLOWS-API] Successfully updated workflow file: ${filePath}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WORKFLOWS-API] Error updating workflow file:', error);
    return NextResponse.json(
      { error: "Failed to update workflow file" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  console.log('[WORKFLOWS-API] POST request received for creating new workflow');
  
  try {
    // Handle build-time context without file system access
    if (isBuildTime()) {
      console.log('[WORKFLOWS-API] Build-time context detected, returning mock response');
      return NextResponse.json({ 
        success: true,
        path: "lib/workflows/new-workflow.ts"
      });
    }
    
    // Parse the request body
    const { name, content } = await req.json();
    
    if (!name || !content) {
      return NextResponse.json(
        { error: "Name and content are required" },
        { status: 400 }
      );
    }
    
    // Sanitize the file name
    const sanitizedName = name.trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');
    
    const fileName = `${sanitizedName}.ts`;
    const filePath = path.join(WORKFLOWS_DIR, fileName);
    
    // Check if file already exists
    try {
      await fs.access(filePath);
      return NextResponse.json(
        { error: "A workflow with this name already exists" },
        { status: 409 }
      );
    } catch {
      // File doesn't exist, we can proceed
    }
    
    // Write the new file
    await fs.writeFile(filePath, content);
    console.log(`[WORKFLOWS-API] Successfully created new workflow file: ${fileName}`);
    
    // Return the relative path
    const relativePath = path.relative(process.cwd(), filePath);
    
    return NextResponse.json({ 
      success: true,
      path: relativePath
    });
  } catch (error) {
    console.error('[WORKFLOWS-API] Error creating workflow file:', error);
    return NextResponse.json(
      { error: "Failed to create workflow file" },
      { status: 500 }
    );
  }
}
