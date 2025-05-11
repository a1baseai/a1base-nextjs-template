import { NextRequest, NextResponse } from 'next/server';
import { loadAgentMemorySettings, saveAgentMemorySettings } from '@/lib/storage/file-storage';
import { AgentMemorySettingsData } from '@/lib/agent-memory/types';

// Reuse the shared route configuration pattern from other API routes
import { routeConfig } from '../../../lib/route-config';
export const { dynamic, runtime } = routeConfig;

// GET handler to retrieve agent memory settings
export async function GET(request: NextRequest) {
  try {
    console.log('[MEMORY-API] GET request received for agent memory settings');
    
    const settings = await loadAgentMemorySettings();
    
    if (settings) {
      console.log('[MEMORY-API] Successfully loaded agent memory settings');
      return NextResponse.json({ settings });
    } else {
      console.log('[MEMORY-API] No agent memory settings found');
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('[MEMORY-API] Error loading agent memory settings:', error);
    return NextResponse.json(
      { error: 'Failed to load agent memory settings' },
      { status: 500 }
    );
  }
}

// POST handler to save agent memory settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body as { settings: AgentMemorySettingsData };
    
    if (!settings) {
      return NextResponse.json(
        { error: 'No settings provided in request body' },
        { status: 400 }
      );
    }
    
    console.log('[MEMORY-API] Attempting to save agent memory settings');
    
    const success = await saveAgentMemorySettings(settings);
    
    if (success) {
      console.log('[MEMORY-API] Successfully saved agent memory settings');
      return NextResponse.json({ success: true });
    } else {
      throw new Error('Failed to save settings');
    }
  } catch (error) {
    console.error('[MEMORY-API] Error saving agent memory settings:', error);
    return NextResponse.json(
      { error: 'Failed to save agent memory settings' },
      { status: 500 }
    );
  }
}
