const fs = require('fs');
const path = require('path');

// Directory where profile data will be stored
const DATA_DIR = path.join(process.cwd(), 'data');

// File paths for different types of data
const PROFILE_SETTINGS_FILE = path.join(DATA_DIR, 'profile-settings.json');

/**
 * Load agent profile settings from file
 * 
 * @returns {Promise<object|null>} Promise that resolves with the settings or null if not found
 */
async function loadProfileSettingsFromFile() {
  if (!fs.existsSync(PROFILE_SETTINGS_FILE)) {
    return null;
  }
  
  try {
    const data = await fs.promises.readFile(PROFILE_SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading profile settings from file:', error);
    return null;
  }
}

module.exports = {
  loadProfileSettingsFromFile,
}; 