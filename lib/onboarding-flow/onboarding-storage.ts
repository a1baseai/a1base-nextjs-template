import { OnboardingFlow, defaultOnboardingFlow } from './types';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/storage/local-storage';
import { toast } from 'sonner';

const ONBOARDING_FLOW_KEY = 'onboarding_flow_settings';

/**
 * Load onboarding flow settings from storage
 */
export const loadOnboardingFlow = async (): Promise<OnboardingFlow> => {
  try {
    // For a real implementation, you would load from server API here
    // For now, we'll use localStorage
    const savedSettings = loadFromLocalStorage<OnboardingFlow>(ONBOARDING_FLOW_KEY);
    
    if (savedSettings) {
      return savedSettings;
    }
    
    return { ...defaultOnboardingFlow };
  } catch (error) {
    console.error('Failed to load onboarding flow settings:', error);
    toast.error('Failed to load onboarding flow settings');
    return { ...defaultOnboardingFlow };
  }
};

/**
 * Save onboarding flow settings to storage
 */
export const saveOnboardingFlow = async (settings: OnboardingFlow): Promise<boolean> => {
  try {
    // For a real implementation, you would save to server API here
    // For now, we'll use localStorage
    saveToLocalStorage(ONBOARDING_FLOW_KEY, settings);
    
    // Add server API call here if needed
    // const response = await fetch('/api/onboarding-flow', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(settings)
    // });
    
    // if (!response.ok) {
    //   throw new Error(`Failed to save: ${response.status}`);
    // }
    
    return true;
  } catch (error) {
    console.error('Failed to save onboarding flow settings:', error);
    toast.error('Failed to save onboarding flow settings');
    return false;
  }
};
