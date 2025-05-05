/**
 * Client-safe file storage utilities
 * 
 * This module provides browser-safe methods for loading and saving agent profile
 * data via API endpoints. These methods can be safely imported by client components
 * unlike direct file system operations that require server components.
 * 
 * When running server-side in API routes, this module will directly access the files
 * instead of making HTTP requests to avoid circular API calls.
 */

import { AgentProfileSettings, InformationSection } from '../agent-profile/types';
import { defaultAgentProfileSettings } from '../agent-profile/agent-profile-settings';
import { defaultBaseInformation } from '../agent-profile/agent-base-information';

// Import fs and path modules dynamically to avoid issues with client-side code
// that doesn't have access to Node.js modules
let fs: any;
let path: any;

// Only load these modules when running on the server
if (typeof window === 'undefined') {
  // We're on the server
  fs = require('fs');
  path = require('path');
}

/**
 * Helper function to get the base URL for API requests
 * Works in both client and server contexts
 */
const getBaseUrl = () => {
  // Browser context: use relative URLs (they resolve against the current origin)
  if (typeof window !== 'undefined') {
    return '';
  }
  
  // Server context: we need absolute URLs
  // First check for NEXTAUTH_URL which is commonly set in Next.js apps
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) return nextAuthUrl;
  
  // Then check for VERCEL_URL which is set in Vercel deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  
  // Finally, default to localhost if no environment variables are set
  return 'http://localhost:3000';
};

/**
 * Save agent profile settings via API
 * 
 * @param settings AgentProfileSettings object to save
 * @returns Promise that resolves to true if successfully saved, false otherwise
 */
export const saveProfileSettings = async (settings: AgentProfileSettings): Promise<boolean> => {
  try {
    const response = await fetch(`${getBaseUrl()}/api/profile-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error saving profile settings via API:', error);
    return false;
  }
};

/**
 * Load agent profile settings
 * 
 * @returns Promise that resolves to the settings object or null if not found
 */
export const loadProfileSettings = async (): Promise<AgentProfileSettings | null> => {
  // If we're running on the server side in an API route, access the file directly
  if (typeof window === 'undefined') {
    // Console log removed - [SERVER] Loading profile settings directly from file
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const filePath = path.join(dataDir, 'profile-settings.json');
      
      // Console log removed - [SERVER] Profile settings file path
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // Console log removed - [SERVER] Profile settings file not found
        return null;
      }
      
      // Read and parse file
      const data = fs.readFileSync(filePath, 'utf8');
      const settings = JSON.parse(data);
      // Console log removed - [SERVER] Successfully loaded profile settings from file
      
      // Add source information to help with debugging
      return {
        ...settings,
        _source: 'server_direct_file'
      };
    } catch (error) {
      console.error('❌ [SERVER] Error loading profile settings from file:', error);
      return null;
    }
  }
  
  // Client-side or non-API server code: use API endpoint
  // Console log removed - Attempting to load profile settings via API
  try {
    const response = await fetch(`${getBaseUrl()}/api/profile-settings`);
    
    if (response.ok) {
      const data = await response.json();
      // Console log removed - Successfully loaded profile settings via API
      return data.settings;
    } else {
      // Console log removed - Failed to load profile settings via API
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error loading profile settings via API:', error);
    return null;
  }
};

/**
 * Save agent base information via API
 * 
 * @param information Array of InformationSection objects to save
 * @returns Promise that resolves to true if successfully saved, false otherwise
 */
export const saveBaseInformation = async (information: InformationSection[]): Promise<boolean> => {
  try {
    const response = await fetch(`${getBaseUrl()}/api/base-information`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ information }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error saving base information via API:', error);
    return false;
  }
};

/**
 * Load agent base information
 * 
 * @returns Promise that resolves to the information array or null if not found
 */
export const loadBaseInformation = async (): Promise<InformationSection[] | null> => {
  // If we're running on the server side in an API route, access the file directly
  if (typeof window === 'undefined') {
    // Console log removed - [SERVER] Loading base information directly from file
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const filePath = path.join(dataDir, 'base-information.json');
      
      // Console log removed - [SERVER] Base information file path
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // Console log removed - [SERVER] Base information file not found
        return null;
      }
      
      // Read and parse file
      const data = fs.readFileSync(filePath, 'utf8');
      const information = JSON.parse(data);
      // Console log removed - [SERVER] Successfully loaded base information from file
      return information;
    } catch (error) {
      console.error('❌ [SERVER] Error loading base information from file:', error);
      return null;
    }
  }
  
  // Client-side or non-API server code: use API endpoint
  // Console log removed - Attempting to load base information via API
  try {
    const response = await fetch(`${getBaseUrl()}/api/base-information`);
    
    if (response.ok) {
      const data = await response.json();
      // Console log removed - Successfully loaded base information via API
      return data.information;
    } else {
      // Console log removed - Failed to load base information via API
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error loading base information via API:', error);
    return null;
  }
};
