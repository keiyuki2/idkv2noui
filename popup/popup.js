// Popup script for Live Subtitles extension
class PopupController {
  constructor() {
    this.settings = {};
    this.currentTab = null;
    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    try {
      await this.getCurrentTab();
      await this.loadSettings();
      this.setupEventListeners();
      this.updateUI();
      this.checkApiKeyStatus();
      this.updateVideoStatus();
      
      // Update status every 2 seconds
      setInterval(() => {
        this.updateVideoStatus();
      }, 2000);

    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize extension popup');
    }
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tabs[0];
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const response = await this.sendToBackground({ action: 'getSettings' });
      if (response.success) {
        this.settings = response.settings;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showError('Failed to load settings');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Enable toggle
    const enableToggle = document.getElementById('enableToggle');
    enableToggle.addEventListener('change', (e) => {
      this.updateSetting('extension_enabled', e.target.checked);
    });

    // API selection
    const apiSelect = document.getElementById('apiSelect');
    apiSelect.addEventListener('change', (e) => {
      this.updateSetting('preferred_api', e.target.value);
    });

    // Source language
    const sourceLanguage = document.getElementById('sourceLanguage');
    sourceLanguage.addEventListener('change', (e) => {
      this.updateSetting('source_language', e.target.value);
    });

    // Translation toggle
    const translationToggle = document.getElementById('translationToggle');
    translationToggle.addEventListener('change', (e) => {
      this.updateSetting('translation_enabled', e.target.checked);
      this.toggleTranslationSettings(e.target.checked);
    });

    // Target language
    const targetLanguage = document.getElementById('targetLanguage');
    targetLanguage.addEventListener('change', (e) => {
      this.updateSetting('target_language', e.target.value);
    });

    // Subtitle position
    const subtitlePosition = document.getElementById('subtitlePosition');
    subtitlePosition.addEventListener('change', (e) => {
      this.updateSetting('subtitle_position', e.target.value);
    });

    // Test subtitles button
    const testButton = document.getElementById('testSubtitles');
    testButton.addEventListener('click', () => {
      this.testSubtitles();
    });

    // Open options button
    const optionsButton = document.getElementById('openOptions');
    optionsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  /**
   * Update UI elements with current settings
   */
  updateUI() {
    // Extension enabled
    const enableToggle = document.getElementById('enableToggle');
    enableToggle.checked = this.settings.extension_enabled;

    // API selection
    const apiSelect = document.getElementById('apiSelect');
    apiSelect.value = this.settings.preferred_api;

    // Source language
    const sourceLanguage = document.getElementById('sourceLanguage');
    sourceLanguage.value = this.settings.source_language;

    // Translation settings
    const translationToggle = document.getElementById('translationToggle');
    translationToggle.checked = this.settings.translation_enabled;
    this.toggleTranslationSettings(this.settings.translation_enabled);

    // Target language
    const targetLanguage = document.getElementById('targetLanguage');
    targetLanguage.value = this.settings.target_language;

    // Subtitle position
    const subtitlePosition = document.getElementById('subtitlePosition');
    subtitlePosition.value = this.settings.subtitle_position;
  }

  /**
   * Toggle translation settings visibility
   * @param {boolean} enabled 
   */
  toggleTranslationSettings(enabled) {
    const targetLanguageRow = document.getElementById('targetLanguageRow');
    targetLanguageRow.style.display = enabled ? 'flex' : 'none';
  }

  /**
   * Update a single setting
   * @param {string} key 
   * @param {any} value 
   */
  async updateSetting(key, value) {
    try {
      this.settings[key] = value;
      
      const response = await this.sendToBackground({
        action: 'updateSettings',
        settings: { [key]: value }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      // Update status indicator if extension was toggled
      if (key === 'extension_enabled') {
        this.updateStatusIndicator();
      }

    } catch (error) {
      console.error('Failed to update setting:', error);
      this.showError('Failed to save setting');
    }
  }

  /**
   * Check API key status
   */
  async checkApiKeyStatus() {
    const openaiStatus = document.getElementById('openaiStatus');
    const googleStatus = document.getElementById('googleStatus');

    // Check if API keys are configured
    const hasOpenAI = !!(this.settings.openai_api_key);
    const hasGoogle = !!(this.settings.google_api_key);

    openaiStatus.textContent = hasOpenAI ? 'Configured' : 'Not configured';
    openaiStatus.className = 'api-status ' + (hasOpenAI ? 'configured' : '');

    googleStatus.textContent = hasGoogle ? 'Configured' : 'Not configured';
    googleStatus.className = 'api-status ' + (hasGoogle ? 'configured' : '');

    // Show warning if no API keys are configured
    if (!hasOpenAI && !hasGoogle) {
      this.showError('No API keys configured. Please configure API keys in Advanced Settings.');
    }
  }

  /**
   * Update video status information
   */
  async updateVideoStatus() {
    try {
      if (!this.currentTab) return;

      const response = await chrome.tabs.sendMessage(this.currentTab.id, { 
        action: 'getStatus' 
      });

      if (response && response.success) {
        const status = response.status;
        this.updateVideoInfo(status);
        this.updateStatusIndicator(status);
      } else {
        this.updateVideoInfo(null);
        this.updateStatusIndicator(null);
      }

    } catch (error) {
      // Content script might not be loaded
      this.updateVideoInfo(null);
      this.updateStatusIndicator(null);
    }
  }

  /**
   * Update video information display
   * @param {Object|null} status 
   */
  updateVideoInfo(status) {
    const videoInfoSection = document.getElementById('videoInfoSection');
    const videoStatus = document.getElementById('videoStatus');
    const audioStatus = document.getElementById('audioStatus');

    if (status && status.hasVideo) {
      videoInfoSection.style.display = 'block';
      
      videoStatus.textContent = status.isEnabled ? 'Active' : 'Detected (disabled)';
      videoStatus.className = 'info-value ' + (status.isEnabled ? 'active' : '');

      audioStatus.textContent = status.isCapturingAudio ? 'Active' : 'Inactive';
      audioStatus.className = 'info-value ' + (status.isCapturingAudio ? 'active' : '');
    } else {
      videoInfoSection.style.display = 'none';
    }
  }

  /**
   * Update status indicator
   * @param {Object|null} status 
   */
  updateStatusIndicator(status = null) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    if (!this.settings.extension_enabled) {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Disabled';
      return;
    }

    if (status) {
      if (status.hasVideo && status.isCapturingAudio) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Active';
      } else if (status.hasVideo) {
        statusDot.className = 'status-dot warning';
        statusText.textContent = 'Video detected';
      } else {
        statusDot.className = 'status-dot inactive';
        statusText.textContent = 'No video';
      }
    } else {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Ready';
    }
  }

  /**
   * Test subtitles with sample text
   */
  async testSubtitles() {
    try {
      if (!this.currentTab) return;

      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'testSubtitles'
      });

    } catch (error) {
      console.error('Failed to test subtitles:', error);
      this.showError('Failed to test subtitles. Make sure you are on a webpage with videos.');
    }
  }

  /**
   * Send message to background script
   * @param {Object} message 
   * @returns {Promise<Object>}
   */
  sendToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  /**
   * Show error message
   * @param {string} message 
   */
  showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorElement = document.getElementById('errorMessage');
    errorElement.style.display = 'none';
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});