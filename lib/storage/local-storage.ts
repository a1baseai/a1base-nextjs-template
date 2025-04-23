/**
 * Utility functions for browser localStorage management
 * These functions handle saving and retrieving data from localStorage, with
 * appropriate safeguards for server-side rendering.
 */

const LOCAL_STORAGE_KEYS = {
  AGENT_PROFILE: 'a1framework_agent_profile',
  AGENT_INFORMATION: 'a1framework_agent_information'
};

/**
 * Save data to localStorage
 * 
 * @param key The localStorage key
 * @param data The data to save (will be JSON stringified)
 * @returns boolean indicating success
 */
export const saveToLocalStorage = <T>(key: string, data: T): boolean => {
  // Guard against server-side rendering
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    return false;
  }
};

/**
 * Load data from localStorage
 * 
 * @param key The localStorage key
 * @returns The parsed data or null if not found
 */
export const loadFromLocalStorage = <T>(key: string): T | null => {
  // Guard against server-side rendering
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const serialized = localStorage.getItem(key);
    if (serialized === null) {
      return null;
    }
    return JSON.parse(serialized) as T;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

/**
 * Remove data from localStorage
 * 
 * @param key The localStorage key to remove
 * @returns boolean indicating success
 */
export const removeFromLocalStorage = (key: string): boolean => {
  // Guard against server-side rendering
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing from localStorage:', error);
    return false;
  }
};

export { LOCAL_STORAGE_KEYS };
