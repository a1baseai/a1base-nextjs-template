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
 * Load group onboarding flow settings from storage
 * 
 * @returns Promise that resolves with the group flow settings
 */
export const loadGroupOnboardingFlow = async (): Promise<GroupOnboardingFlow> => {
  console.log('🔄 Attempting to load group onboarding flow via API...');
  
  try {
    // Try to load from API first
    const response = await fetch(`${getBaseUrl()}/api/group-onboarding-flow`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Successfully loaded group onboarding flow via API');
      
      // Also save to localStorage as a cache
      if (data.flow) {
        saveToLocalStorage(GROUP_ONBOARDING_FLOW_KEY, data.flow);
        return data.flow;
      }
    } else {
      console.log('❌ Failed to load group onboarding flow via API. Status:', response.status);
    }
    
    // If API fails, try localStorage as fallback
    console.log('🔄 Checking localStorage for group onboarding flow...');
    const savedSettings = loadFromLocalStorage<GroupOnboardingFlow>(GROUP_ONBOARDING_FLOW_KEY);
    
    if (savedSettings) {
      console.log('✅ Found group onboarding flow in localStorage');
      return savedSettings;
    }
    
    // Default to defaults if nothing is found
    console.log('ℹ️ No saved group onboarding flow found, using defaults');
    return { ...defaultGroupOnboardingFlow };
  } catch (error) {
    console.error('❌ Error loading group onboarding flow settings:', error);
    toast.error('Failed to load group onboarding flow settings');
    
    // Try localStorage as a last resort
    const savedSettings = loadFromLocalStorage<GroupOnboardingFlow>(GROUP_ONBOARDING_FLOW_KEY);
    return savedSettings || { ...defaultGroupOnboardingFlow };
  }
};

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
