import { GroupOnboardingFlow, defaultGroupOnboardingFlow } from './types';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/storage/local-storage';
import { toast } from 'sonner';

const GROUP_ONBOARDING_FLOW_KEY = 'group_onboarding_flow_settings';

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
 * Direct file system access for server-side contexts
 * Only used as fallback when API and localStorage methods fail
 */
const loadGroupOnboardingFlowFromFileSystem = (): GroupOnboardingFlow => {
  // This runs only in a server context
  if (typeof window !== 'undefined') {
    throw new Error('Cannot load from filesystem in browser context');
  }
  
  try {
    console.log('🔄 FALLBACK: Attempting to load group onboarding flow directly from filesystem...');
    
    // Import path and fs modules dynamically to avoid client-side issues
    const path = require('path');
    const fs = require('fs');
    
    // Build the path to the file
    const filePath = path.join(process.cwd(), 'data', 'group-onboarding-flow.json');
    console.log(`🔍 DEBUG: Checking for file at ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('⚠️ Group onboarding flow file not found, using defaults');
      return { ...defaultGroupOnboardingFlow };
    }
    
    // Read and parse the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedData = JSON.parse(fileContent) as GroupOnboardingFlow;
    console.log('✅ Successfully loaded group onboarding flow from filesystem');
    
    return parsedData;
  } catch (error) {
    console.error('❌ Error loading group onboarding flow from filesystem:', error);
    return { ...defaultGroupOnboardingFlow };
  }
};

/**
 * Load group onboarding flow settings from storage with timeouts and fallbacks
 * 
 * @returns Promise that resolves with the group flow settings
 */
export const loadGroupOnboardingFlow = async (): Promise<GroupOnboardingFlow> => {
  console.log('🔄 Attempting to load group onboarding flow...');
  
  // Set a timeout to prevent the operation from hanging indefinitely
  const timeoutPromise = new Promise<GroupOnboardingFlow>((_, reject) => {
    setTimeout(() => {
      console.log('⚠️ WARNING: Timeout while loading group onboarding flow, falling back to defaults');
      reject(new Error('Timeout while loading group onboarding flow'));
    }, 5000); // 5 second timeout
  });
  
  try {
    // Race the loading operation against the timeout
    return await Promise.race([
      loadGroupOnboardingFlowWithFallbacks(),
      timeoutPromise
    ]);
  } catch (error) {
    console.error('❌ Final error loading group onboarding flow settings:', error);
    
    // Last resort - try loading directly from filesystem in server context
    if (typeof window === 'undefined') {
      try {
        return loadGroupOnboardingFlowFromFileSystem();
      } catch (fsError) {
        console.error('❌ Even filesystem fallback failed:', fsError);
      }
    }
    
    return { ...defaultGroupOnboardingFlow };
  }
};

/**
 * Implementation of loading flow with multiple fallback mechanisms
 */
async function loadGroupOnboardingFlowWithFallbacks(): Promise<GroupOnboardingFlow> {
  // In server context, try filesystem first as it's more reliable and faster
  if (typeof window === 'undefined') {
    try {
      console.log('🔍 DEBUG: Server context detected, trying filesystem first');
      return loadGroupOnboardingFlowFromFileSystem();
    } catch (fsError) {
      console.error('❌ Error loading from filesystem:', fsError);
      // Continue to API fallback if filesystem fails
    }
  }
  
  // Try to load from localStorage in client context
  if (typeof window !== 'undefined') {
    try {
      console.log('🔄 Checking localStorage for group onboarding flow...');
      const cachedFlow = loadFromLocalStorage<GroupOnboardingFlow>(GROUP_ONBOARDING_FLOW_KEY);
      if (cachedFlow) {
        console.log('✅ Successfully loaded group onboarding flow from localStorage');
        return cachedFlow;
      }
    } catch (localStorageError) {
      console.error('❌ Error loading from localStorage:', localStorageError);
    }
  }
  
  // Try to load from API as fallback
  console.log("🔍 DEBUG: Trying to load group onboarding flow via API...");
  console.log("🔍 DEBUG: Base URL:", getBaseUrl());
  
  try {
    // Add a shorter timeout to the fetch operation itself
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('⚠️ Fetch operation timed out, aborting');
    }, 2000); // 2 second timeout for fetch (shorter to fail faster)
    
    try {
      const response = await fetch(`${getBaseUrl()}/api/group-onboarding-flow`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log("🔍 DEBUG: API Response:", { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Successfully loaded group onboarding flow via API');
        
        // Also save to localStorage as a cache
        if (data.flow) {
          if (typeof window !== 'undefined') {
            saveToLocalStorage(GROUP_ONBOARDING_FLOW_KEY, data.flow);
          }
          return data.flow;
        } else {
          throw new Error('API returned success but no flow data');
        }
      } else {
        throw new Error(`API returned non-OK status: ${response.status}`);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('❌ ERROR: Fetch operation failed:', fetchError instanceof Error ? fetchError.message : 'Unknown error');
      throw fetchError;
    }
  } catch (apiError) {
    console.error('❌ Error fetching from API:', apiError instanceof Error ? apiError.message : 'Unknown error');
    
    // Final fallback - try filesystem again if we're in server context
    if (typeof window === 'undefined') {
      try {
        return loadGroupOnboardingFlowFromFileSystem();
      } catch (finalFsError) {
        console.error('❌ Final filesystem fallback failed');
      }
    }
  
    // Default to defaults if nothing else works
    console.log('ℹ️ No saved group onboarding flow found, using defaults');
    return { ...defaultGroupOnboardingFlow };
  }
}

/**
 * Save group onboarding flow settings to storage
 * 
 * @param settings GroupOnboardingFlow object to save
 * @returns Promise that resolves to true if successfully saved
 */
export const saveGroupOnboardingFlow = async (settings: GroupOnboardingFlow): Promise<boolean> => {
  console.log('🔄 Saving group onboarding flow settings...');
  
  try {
    // Always save to localStorage first as a backup
    saveToLocalStorage(GROUP_ONBOARDING_FLOW_KEY, settings);
    
    // Then save to the server via API
    const response = await fetch(`${getBaseUrl()}/api/group-onboarding-flow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flow: settings }),
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to save group onboarding flow to API: ${response.status}`);
      throw new Error(`API error: ${response.status}`);
    }
    
    console.log('✅ Successfully saved group onboarding flow to API');
    return true;
  } catch (error) {
    console.error('❌ Error saving group onboarding flow settings:', error);
    toast.error('Failed to save to server, but saved locally');
    
    // Return true anyway if we at least saved to localStorage
    return true;
  }
};
