// Storage management utilities for the Live Subtitles extension
class StorageManager {
  /**
   * Get a setting from chrome storage
   * @param {string} key 
   * @param {any} defaultValue 
   * @returns {Promise<any>}
   */
  static async getSetting(key, defaultValue = null) {
    try {
      const result = await chrome.storage.sync.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Set a setting in chrome storage
   * @param {string} key 
   * @param {any} value 
   * @returns {Promise<boolean>}
   */
  static async setSetting(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
      return true;
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple settings at once
   * @param {string[]} keys 
   * @returns {Promise<Object>}
   */
  static async getSettings(keys) {
    try {
      const result = await chrome.storage.sync.get(keys);
      return result;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  /**
   * Set multiple settings at once
   * @param {Object} settings 
   * @returns {Promise<boolean>}
   */
  static async setSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      return true;
    } catch (error) {
      console.error('Failed to set settings:', error);
      return false;
    }
  }

  /**
   * Get all extension settings with defaults
   * @returns {Promise<Object>}
   */
  static async getAllSettings() {
    try {
      const keys = Object.values(CONSTANTS.STORAGE_KEYS);
      const settings = await this.getSettings(keys);
      
      // Apply defaults for missing settings
      return {
        [CONSTANTS.STORAGE_KEYS.OPENAI_API_KEY]: settings[CONSTANTS.STORAGE_KEYS.OPENAI_API_KEY] || '',
        [CONSTANTS.STORAGE_KEYS.GOOGLE_API_KEY]: settings[CONSTANTS.STORAGE_KEYS.GOOGLE_API_KEY] || '',
        [CONSTANTS.STORAGE_KEYS.PREFERRED_API]: settings[CONSTANTS.STORAGE_KEYS.PREFERRED_API] || CONSTANTS.DEFAULTS.PREFERRED_API,
        [CONSTANTS.STORAGE_KEYS.SOURCE_LANGUAGE]: settings[CONSTANTS.STORAGE_KEYS.SOURCE_LANGUAGE] || CONSTANTS.DEFAULTS.SOURCE_LANGUAGE,
        [CONSTANTS.STORAGE_KEYS.TARGET_LANGUAGE]: settings[CONSTANTS.STORAGE_KEYS.TARGET_LANGUAGE] || CONSTANTS.DEFAULTS.TARGET_LANGUAGE,
        [CONSTANTS.STORAGE_KEYS.SUBTITLE_STYLE]: settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_STYLE] || CONSTANTS.DEFAULTS.SUBTITLE_STYLE,
        [CONSTANTS.STORAGE_KEYS.SUBTITLE_POSITION]: settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_POSITION] || CONSTANTS.DEFAULTS.SUBTITLE_POSITION,
        [CONSTANTS.STORAGE_KEYS.TRANSLATION_ENABLED]: settings[CONSTANTS.STORAGE_KEYS.TRANSLATION_ENABLED] !== undefined ? settings[CONSTANTS.STORAGE_KEYS.TRANSLATION_ENABLED] : CONSTANTS.DEFAULTS.TRANSLATION_ENABLED,
        [CONSTANTS.STORAGE_KEYS.EXTENSION_ENABLED]: settings[CONSTANTS.STORAGE_KEYS.EXTENSION_ENABLED] !== undefined ? settings[CONSTANTS.STORAGE_KEYS.EXTENSION_ENABLED] : CONSTANTS.DEFAULTS.EXTENSION_ENABLED
      };
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return CONSTANTS.DEFAULTS;
    }
  }

  /**
   * Reset all settings to defaults
   * @returns {Promise<boolean>}
   */
  static async resetToDefaults() {
    try {
      const defaultSettings = {
        [CONSTANTS.STORAGE_KEYS.PREFERRED_API]: CONSTANTS.DEFAULTS.PREFERRED_API,
        [CONSTANTS.STORAGE_KEYS.SOURCE_LANGUAGE]: CONSTANTS.DEFAULTS.SOURCE_LANGUAGE,
        [CONSTANTS.STORAGE_KEYS.TARGET_LANGUAGE]: CONSTANTS.DEFAULTS.TARGET_LANGUAGE,
        [CONSTANTS.STORAGE_KEYS.SUBTITLE_STYLE]: CONSTANTS.DEFAULTS.SUBTITLE_STYLE,
        [CONSTANTS.STORAGE_KEYS.SUBTITLE_POSITION]: CONSTANTS.DEFAULTS.SUBTITLE_POSITION,
        [CONSTANTS.STORAGE_KEYS.TRANSLATION_ENABLED]: CONSTANTS.DEFAULTS.TRANSLATION_ENABLED,
        [CONSTANTS.STORAGE_KEYS.EXTENSION_ENABLED]: CONSTANTS.DEFAULTS.EXTENSION_ENABLED
      };
      
      await this.setSettings(defaultSettings);
      return true;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      return false;
    }
  }

  /**
   * Check if API keys are configured
   * @returns {Promise<Object>}
   */
  static async checkApiKeys() {
    const settings = await this.getAllSettings();
    return {
      openai: !!(settings[CONSTANTS.STORAGE_KEYS.OPENAI_API_KEY]),
      google: !!(settings[CONSTANTS.STORAGE_KEYS.GOOGLE_API_KEY]),
      hasAnyKey: !!(settings[CONSTANTS.STORAGE_KEYS.OPENAI_API_KEY] || settings[CONSTANTS.STORAGE_KEYS.GOOGLE_API_KEY])
    };
  }

  /**
   * Listen for storage changes
   * @param {Function} callback 
   */
  static onSettingsChanged(callback) {
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          callback(changes);
        }
      });
    }
  }

  /**
   * Get secure storage for sensitive data (API keys)
   * @param {string} key 
   * @returns {Promise<string>}
   */
  static async getSecureSetting(key) {
    // For now, use the same storage but could be enhanced with encryption
    return await this.getSetting(key, '');
  }

  /**
   * Set secure storage for sensitive data (API keys)
   * @param {string} key 
   * @param {string} value 
   * @returns {Promise<boolean>}
   */
  static async setSecureSetting(key, value) {
    // For now, use the same storage but could be enhanced with encryption
    return await this.setSetting(key, value);
  }
}

// Make StorageManager available globally
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}