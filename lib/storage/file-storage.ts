/**
 * Client-safe file storage utilities
 * 
 * This module provides browser-safe methods for loading and saving agent profile
 * data via API endpoints. These methods can be safely imported by client components
 * unlike direct file system operations that require server components.
 */

import { AgentProfileSettings, InformationSection } from '../agent-profile/types';

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
 * Load agent profile settings via API
 * 
 * @returns Promise that resolves to the settings object or null if not found
 */
export const loadProfileSettings = async (): Promise<AgentProfileSettings | null> => {
  console.log('🔄 Attempting to load profile settings via API...');
  try {
    const response = await fetch(`${getBaseUrl()}/api/profile-settings`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Successfully loaded profile settings via API. Name:', data.settings?.name);
      return data.settings;
    } else {
      console.log('❌ Failed to load profile settings via API. Status:', response.status);
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
 * Load agent base information via API
 * 
 * @returns Promise that resolves to the information array or null if not found
 */
export const loadBaseInformation = async (): Promise<InformationSection[] | null> => {
  console.log('🔄 Attempting to load base information via API...');
  try {
    const response = await fetch(`${getBaseUrl()}/api/base-information`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Successfully loaded base information via API. Sections:', data.information?.length);
      return data.information;
    } else {
      console.log('❌ Failed to load base information via API. Status:', response.status);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error loading base information via API:', error);
    return null;
  }
};
