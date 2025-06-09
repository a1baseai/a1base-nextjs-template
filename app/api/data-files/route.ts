import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = await fs.readdir(dataDir);
    
    // Filter for non-backup JSON files
    const jsonFiles = files.filter(
      file => file.endsWith('.json') && !file.startsWith('.')
    );
    
    const fileContents = await Promise.all(
      jsonFiles.map(async (fileName) => {
        const filePath = path.join(dataDir, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          name: fileName,
          content: JSON.parse(content)
        };
      })
    );
    
    return NextResponse.json(fileContents);
  } catch (error) {
    console.error('Error reading data files:', error);
    return NextResponse.json({ error: 'Failed to read data files' }, { status: 500 });
  }
} 