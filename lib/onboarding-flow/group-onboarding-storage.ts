import { GroupOnboardingFlow } from './types';
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

// Import Node.js modules conditionally only on the server side
// This prevents them from being included in client bundles
let serverFS: any;
let serverPath: any;

// Only load these modules on the server side
if (typeof window === 'undefined') {
  try {
    // Use import() instead of require() to better handle Next.js bundling
    serverFS = require('fs');
    serverPath = require('path');
  } catch (e) {
    console.error('Failed to load Node.js modules:', e);
  }
}

/**
 * Direct file system access for server-side contexts
 * Only used as fallback when API and localStorage methods fail
 */
const loadGroupOnboardingFlowFromFileSystem = (): GroupOnboardingFlow => {
  // This runs only in a server context
  if (typeof window !== 'undefined') {
    throw new Error('Cannot load from filesystem in browser context');
  }
  
  // Make sure the modules were properly loaded
  if (!serverFS || !serverPath) {
    console.error('❌ Server filesystem modules not available');
    throw new Error('Server filesystem modules not available');
  }
  
  try {
    console.log('🔄 FALLBACK: Attempting to load group onboarding flow directly from filesystem...');
    
    // Build the path to the file
    const filePath = serverPath.join(process.cwd(), 'data', 'group-onboarding-flow.json');
    console.log(`🔍 DEBUG: Checking for file at ${filePath}`);
    
    // Check if file exists
    if (!serverFS.existsSync(filePath)) {
      console.error('❌ Group onboarding flow file not found');
      throw new Error(`Group onboarding flow file not found at ${filePath}`);
    }
    
    // Read and parse the file
    const fileContent = serverFS.readFileSync(filePath, 'utf8');
    const parsedData = JSON.parse(fileContent) as GroupOnboardingFlow;
    console.log('✅ Successfully loaded group onboarding flow from filesystem');
    
    // Log the complete file contents
    console.log('📃 GROUP ONBOARDING FLOW FILE CONTENTS:');
    console.log(JSON.stringify(parsedData, null, 2));
    
    return parsedData;
  } catch (error) {
    console.error('❌ Error loading group onboarding flow from filesystem:', error);
    throw error;
  }
};

/**
 * Load group onboarding flow settings from storage with timeouts and fallbacks
 * 
 * @returns Promise that resolves with the group flow settings
 */
export const loadGroupOnboardingFlow = async (): Promise<GroupOnboardingFlow> => {

  console.log('🔄 Attempting to load group onboarding flow...');
  
  // Run with timeout protection, but don't race - use a more robust approach
  const loadPromise = loadGroupOnboardingFlowWithFallbacks();
  
  // Setup a simple timeout
  const timeoutId = setTimeout(() => {
    console.log('⚠️ WARNING: Timeout notification while loading group onboarding flow');
    // Note: We're not rejecting, just logging a warning
  }, 3000); // 3 second notification timeout
  
  try {
    // Wait for the loading to complete
    const result = await loadPromise;
    
    // Clear the timeout since we got a result
    clearTimeout(timeoutId);
    
    // No caching - directly return the result
    
    return result;
  } catch (error) {
    // Clear the timeout
    clearTimeout(timeoutId);
    console.error('❌ Error loading group onboarding flow settings:', error);
    
    // Last resort - try loading directly from filesystem in server context
    if (typeof window === 'undefined') {
      try {
        console.log('🔄 Last resort: Trying filesystem directly after error');
        const fileResult = loadGroupOnboardingFlowFromFileSystem();
        
        // No caching - use filesystem result directly
        
        return fileResult;
      } catch (fsError) {
        console.error('❌ Even filesystem fallback failed:', fsError);
        throw error; // Propagate the error since we don't have default values
      }
    }
    
    throw error; // Propagate the error since we don't have default values
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
      const flowFromFile = loadGroupOnboardingFlowFromFileSystem();
      console.log('✅ Successfully loaded group onboarding flow directly from filesystem');
      // Return immediately to avoid unnecessary API calls
      return flowFromFile;
    } catch (fsError) {
      console.error('❌ Error loading directly from filesystem:', fsError);
      // Only continue to other methods if filesystem access fails
    }
  }
  
  // Skip localStorage loading
  // if (typeof window !== 'undefined') {
  //   try {
  //     console.log('🔄 Checking localStorage for group onboarding flow...');
  //     const cachedFlow = loadFromLocalStorage<GroupOnboardingFlow>(GROUP_ONBOARDING_FLOW_KEY);
  //     if (cachedFlow) {
  //       console.log('✅ Successfully loaded group onboarding flow from localStorage');
  //       return cachedFlow;
  //     }
  //   } catch (localStorageError) {
  //     console.error('❌ Error loading from localStorage:', localStorageError);
  //   }
  // }
  
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
        
        // Skip localStorage caching
        if (data.flow) {
          // if (typeof window !== 'undefined') {
          //   saveToLocalStorage(GROUP_ONBOARDING_FLOW_KEY, data.flow);
          // }
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
  
    // No more fallbacks available
    console.error('❌ Failed to load group onboarding flow after all attempts');
    throw apiError; // Propagate the error since we don't have default values
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
