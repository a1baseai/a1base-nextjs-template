/**
 * Client-safe file storage utilities
 * 
 * This module provides browser-safe methods for loading and saving agent profile
 * data via API endpoints. These methods can be safely imported by client components
 * unlike direct file system operations that require server components.
 */

import { AgentProfileSettings, InformationSection } from '../agent-profile/types';

/**
 * Save agent profile settings via API
 * 
 * @param settings AgentProfileSettings object to save
 * @returns Promise that resolves to true if successfully saved, false otherwise
 */
export const saveProfileSettings = async (settings: AgentProfileSettings): Promise<boolean> => {
  try {
    const response = await fetch('/api/profile-settings', {
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
  try {
    const response = await fetch('/api/profile-settings');
    
    if (response.ok) {
      const data = await response.json();
      return data.settings;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading profile settings via API:', error);
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
    const response = await fetch('/api/base-information', {
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
  try {
    const response = await fetch('/api/base-information');
    
    if (response.ok) {
      const data = await response.json();
      return data.information;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading base information via API:', error);
    return null;
  }
};
