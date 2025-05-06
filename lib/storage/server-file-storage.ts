/**
 * Server-only file storage utilities
 * 
 * IMPORTANT: This file should only be imported by server components or API routes.
 * It contains direct file system access which is not supported in client components.
 */

// Mark this file as server-only
'use server';

import fs from 'fs';
import path from 'path';
import { AgentProfileSettings, InformationSection } from '../agent-profile/types';
import { OnboardingFlow, GroupOnboardingFlow } from '../onboarding-flow/types';

// Directory where profile data will be stored
const DATA_DIR = path.join(process.cwd(), 'data');

// File paths for different types of data
const PROFILE_SETTINGS_FILE = path.join(DATA_DIR, 'profile-settings.json');
const BASE_INFORMATION_FILE = path.join(DATA_DIR, 'base-information.json');
const ONBOARDING_FLOW_FILE = path.join(DATA_DIR, 'onboarding-flow.json');
const GROUP_ONBOARDING_FLOW_FILE = path.join(DATA_DIR, 'group-onboarding-flow.json');

/**
 * Initialize the data directory if it doesn't exist
 */
export const initializeDataDirectory = async (): Promise<void> => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating data directory:', error);
    throw error;
  }
};

/**
 * Load onboarding flow data from file
 * 
 * @returns Promise that resolves with the flow data or null if not found
 */
export const loadOnboardingFlowFromFile = async (): Promise<OnboardingFlow | null> => {
  if (!fs.existsSync(ONBOARDING_FLOW_FILE)) {
    return null;
  }
  
  try {
    const data = await fs.promises.readFile(ONBOARDING_FLOW_FILE, 'utf8');
    return JSON.parse(data) as OnboardingFlow;
  } catch (error) {
    console.error('Error loading onboarding flow from file:', error);
    return null;
  }
};

/**
 * Load group onboarding flow data from file
 * 
 * @returns Promise that resolves with the group flow data or null if not found
 */
export const loadGroupOnboardingFlowFromFile = async (): Promise<GroupOnboardingFlow | null> => {
  if (!fs.existsSync(GROUP_ONBOARDING_FLOW_FILE)) {
    return null;
  }
  
  try {
    const data = await fs.promises.readFile(GROUP_ONBOARDING_FLOW_FILE, 'utf8');
    return JSON.parse(data) as GroupOnboardingFlow;
  } catch (error) {
    console.error('Error loading group onboarding flow from file:', error);
    return null;
  }
};

/**
 * Save onboarding flow data to file
 * 
 * @param flow OnboardingFlow object to save
 * @returns Promise that resolves when the file is written
 */
export const saveOnboardingFlowToFile = async (flow: OnboardingFlow): Promise<void> => {
  initializeDataDirectory();
  
  try {
    await fs.promises.writeFile(
      ONBOARDING_FLOW_FILE, 
      JSON.stringify(flow, null, 2)
    );
  } catch (error) {
    console.error('Error saving onboarding flow to file:', error);
    throw error;
  }
};

/**
 * Save group onboarding flow data to file
 * 
 * @param flow GroupOnboardingFlow object to save
 * @returns Promise that resolves when the file is written
 */
export const saveGroupOnboardingFlowToFile = async (flow: GroupOnboardingFlow): Promise<void> => {
  initializeDataDirectory();
  
  try {
    await fs.promises.writeFile(
      GROUP_ONBOARDING_FLOW_FILE, 
      JSON.stringify(flow, null, 2)
    );
  } catch (error) {
    console.error('Error saving group onboarding flow to file:', error);
    throw error;
  }
};

/**
 * Save agent profile settings to file
 * 
 * @param settings AgentProfileSettings object to save
 * @returns Promise that resolves when the file is written
 */
export const saveProfileSettingsToFile = async (settings: AgentProfileSettings): Promise<void> => {
  initializeDataDirectory();
  
  try {
    await fs.promises.writeFile(
      PROFILE_SETTINGS_FILE, 
      JSON.stringify(settings, null, 2)
    );
  } catch (error) {
    console.error('Error saving profile settings to file:', error);
    throw error;
  }
};

/**
 * Load agent profile settings from file
 * 
 * @returns Promise that resolves with the settings or null if not found
 */
export const loadProfileSettingsFromFile = async (): Promise<AgentProfileSettings | null> => {
  if (!fs.existsSync(PROFILE_SETTINGS_FILE)) {
    return null;
  }
  
  try {
    const data = await fs.promises.readFile(PROFILE_SETTINGS_FILE, 'utf8');
    return JSON.parse(data) as AgentProfileSettings;
  } catch (error) {
    console.error('Error loading profile settings from file:', error);
    return null;
  }
};

/**
 * Save agent base information to file
 * 
 * @param information Array of InformationSection objects to save
 * @returns Promise that resolves when the file is written
 */
export const saveBaseInformationToFile = async (information: InformationSection[]): Promise<void> => {
  initializeDataDirectory();
  
  try {
    await fs.promises.writeFile(
      BASE_INFORMATION_FILE, 
      JSON.stringify(information, null, 2)
    );
  } catch (error) {
    console.error('Error saving base information to file:', error);
    throw error;
  }
};

/**
 * Load agent base information from file
 * 
 * @returns Promise that resolves with the information or null if not found
 */
export const loadBaseInformationFromFile = async (): Promise<InformationSection[] | null> => {
  if (!fs.existsSync(BASE_INFORMATION_FILE)) {
    return null;
  }
  
  try {
    const data = await fs.promises.readFile(BASE_INFORMATION_FILE, 'utf8');
    return JSON.parse(data) as InformationSection[];
  } catch (error) {
    console.error('Error loading base information from file:', error);
    return null;
  }
};
