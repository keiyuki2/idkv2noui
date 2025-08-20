// Options page script for Live Subtitles extension
class OptionsController {
  constructor() {
    this.settings = {};
    this.originalSettings = {};
    this.unsavedChanges = false;
    this.init();
  }

  /**
   * Initialize the options page
   */
  async init() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.updateUI();
      this.updatePreview();
      
      console.log('Options page initialized');
    } catch (error) {
      console.error('Failed to initialize options page:', error);
      this.showSaveStatus('Failed to load settings', 'error');
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const response = await this.sendToBackground({ action: 'getSettings' });
      if (response.success) {
        this.settings = { ...response.settings };
        this.originalSettings = { ...response.settings };
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // API Key inputs and testing
    this.setupApiKeyListeners();
    
    // Speech recognition settings
    this.setupSpeechRecognitionListeners();
    
    // Translation settings
    this.setupTranslationListeners();
    
    // Appearance settings
    this.setupAppearanceListeners();
    
    // Advanced options
    this.setupAdvancedOptionsListeners();
    
    // Action buttons
    this.setupActionButtonListeners();
    
    // Prevent data loss
    window.addEventListener('beforeunload', (e) => {
      if (this.unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /**
   * Setup API key related listeners
   */
  setupApiKeyListeners() {
    // OpenAI API Key
    const openaiInput = document.getElementById('openaiApiKey');
    openaiInput.addEventListener('input', (e) => {
      this.updateSetting('openai_api_key', e.target.value);
      this.clearKeyStatus('openaiKeyStatus');
    });

    const testOpenaiButton = document.getElementById('testOpenaiKey');
    testOpenaiButton.addEventListener('click', () => {
      this.testApiKey('openai', openaiInput.value, 'openaiKeyStatus');
    });

    // Google API Key
    const googleInput = document.getElementById('googleApiKey');
    googleInput.addEventListener('input', (e) => {
      this.updateSetting('google_api_key', e.target.value);
      this.clearKeyStatus('googleKeyStatus');
    });

    const testGoogleButton = document.getElementById('testGoogleKey');
    testGoogleButton.addEventListener('click', () => {
      this.testApiKey('google', googleInput.value, 'googleKeyStatus');
    });
  }

  /**
   * Setup speech recognition listeners
   */
  setupSpeechRecognitionListeners() {
    const preferredApi = document.getElementById('preferredApiSelect');
    preferredApi.addEventListener('change', (e) => {
      this.updateSetting('preferred_api', e.target.value);
    });

    const sourceLanguage = document.getElementById('sourceLanguageSelect');
    sourceLanguage.addEventListener('change', (e) => {
      this.updateSetting('source_language', e.target.value);
    });

    const audioQuality = document.getElementById('audioQuality');
    audioQuality.addEventListener('change', (e) => {
      this.updateSetting('audio_quality', e.target.value);
    });

    const chunkSize = document.getElementById('chunkSize');
    chunkSize.addEventListener('change', (e) => {
      this.updateSetting('chunk_size', parseInt(e.target.value));
    });
  }

  /**
   * Setup translation listeners
   */
  setupTranslationListeners() {
    const enableTranslation = document.getElementById('enableTranslation');
    enableTranslation.addEventListener('change', (e) => {
      this.updateSetting('translation_enabled', e.target.checked);
      this.toggleTranslationSettings(e.target.checked);
    });

    const targetLanguage = document.getElementById('targetLanguageSelect');
    targetLanguage.addEventListener('change', (e) => {
      this.updateSetting('target_language', e.target.value);
    });

    const showOriginal = document.getElementById('showOriginal');
    showOriginal.addEventListener('change', (e) => {
      this.updateSetting('show_original', e.target.checked);
    });
  }

  /**
   * Setup appearance listeners
   */
  setupAppearanceListeners() {
    const subtitlePosition = document.getElementById('subtitlePosition');
    subtitlePosition.addEventListener('change', (e) => {
      this.updateSetting('subtitle_position', e.target.value);
      this.updatePreview();
    });

    const fontSize = document.getElementById('fontSize');
    fontSize.addEventListener('change', (e) => {
      this.updateSubtitleStyle('fontSize', e.target.value);
      this.updatePreview();
    });

    const fontFamily = document.getElementById('fontFamily');
    fontFamily.addEventListener('change', (e) => {
      this.updateSubtitleStyle('fontFamily', e.target.value);
      this.updatePreview();
    });

    const textColor = document.getElementById('textColor');
    textColor.addEventListener('input', (e) => {
      this.updateSubtitleStyle('color', e.target.value);
      this.updatePreview();
    });

    const backgroundColor = document.getElementById('backgroundColor');
    backgroundColor.addEventListener('input', (e) => {
      this.updateBackgroundColor(e.target.value);
      this.updatePreview();
    });

    const backgroundOpacity = document.getElementById('backgroundOpacity');
    backgroundOpacity.addEventListener('input', (e) => {
      document.getElementById('opacityValue').textContent = e.target.value + '%';
      this.updateBackgroundOpacity(e.target.value);
      this.updatePreview();
    });
  }

  /**
   * Setup advanced options listeners
   */
  setupAdvancedOptionsListeners() {
    const enableLogging = document.getElementById('enableLogging');
    enableLogging.addEventListener('change', (e) => {
      this.updateSetting('enable_logging', e.target.checked);
    });

    const autoEnable = document.getElementById('autoEnable');
    autoEnable.addEventListener('change', (e) => {
      this.updateSetting('auto_enable', e.target.checked);
    });

    const maxDisplayTime = document.getElementById('maxDisplayTime');
    maxDisplayTime.addEventListener('change', (e) => {
      this.updateSetting('max_display_time', parseInt(e.target.value));
    });
  }

  /**
   * Setup action button listeners
   */
  setupActionButtonListeners() {
    const saveButton = document.getElementById('saveSettings');
    saveButton.addEventListener('click', () => {
      this.saveSettings();
    });

    const resetButton = document.getElementById('resetSettings');
    resetButton.addEventListener('click', () => {
      this.resetToDefaults();
    });

    const exportButton = document.getElementById('exportSettings');
    exportButton.addEventListener('click', () => {
      this.exportSettings();
    });

    const importButton = document.getElementById('importSettings');
    importButton.addEventListener('click', () => {
      this.importSettings();
    });

    // Modal handlers
    const cancelModal = document.getElementById('cancelModal');
    cancelModal.addEventListener('click', () => {
      this.hideModal();
    });

    const confirmModal = document.getElementById('confirmModal');
    confirmModal.addEventListener('click', () => {
      this.confirmModal();
    });
  }

  /**
   * Update UI elements with current settings
   */
  updateUI() {
    // API Keys (masked for security)
    document.getElementById('openaiApiKey').value = this.settings.openai_api_key ? '••••••••••••••••' : '';
    document.getElementById('googleApiKey').value = this.settings.google_api_key ? '••••••••••••••••' : '';

    // Speech recognition
    document.getElementById('preferredApiSelect').value = this.settings.preferred_api || 'openai';
    document.getElementById('sourceLanguageSelect').value = this.settings.source_language || 'auto';
    document.getElementById('audioQuality').value = this.settings.audio_quality || 'medium';
    document.getElementById('chunkSize').value = this.settings.chunk_size || 3000;

    // Translation
    document.getElementById('enableTranslation').checked = this.settings.translation_enabled || false;
    document.getElementById('targetLanguageSelect').value = this.settings.target_language || 'mn';
    document.getElementById('showOriginal').checked = this.settings.show_original || false;
    this.toggleTranslationSettings(this.settings.translation_enabled);

    // Appearance
    document.getElementById('subtitlePosition').value = this.settings.subtitle_position || 'bottom';
    
    const style = this.settings.subtitle_style || {};
    document.getElementById('fontSize').value = style.fontSize || '18px';
    document.getElementById('fontFamily').value = style.fontFamily || 'Arial, sans-serif';
    document.getElementById('textColor').value = style.color || '#ffffff';
    
    // Extract color from backgroundColor (remove alpha)
    const bgColor = style.backgroundColor || 'rgba(0, 0, 0, 0.8)';
    const colorMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (colorMatch) {
      const hex = '#' + [colorMatch[1], colorMatch[2], colorMatch[3]]
        .map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
      document.getElementById('backgroundColor').value = hex;
    }
    
    // Extract opacity
    const opacityMatch = bgColor.match(/rgba?\([^,]+,[^,]+,[^,]+,?\s*([^)]*)\)/);
    const opacity = opacityMatch ? Math.round(parseFloat(opacityMatch[1] || 0.8) * 100) : 80;
    document.getElementById('backgroundOpacity').value = opacity;
    document.getElementById('opacityValue').textContent = opacity + '%';

    // Advanced options
    document.getElementById('enableLogging').checked = this.settings.enable_logging || false;
    document.getElementById('autoEnable').checked = this.settings.auto_enable !== false;
    document.getElementById('maxDisplayTime').value = this.settings.max_display_time || 5000;
  }

  /**
   * Update preview subtitle
   */
  updatePreview() {
    const preview = document.querySelector('.sample-subtitle');
    const style = this.settings.subtitle_style || {};
    
    Object.assign(preview.style, {
      fontSize: style.fontSize || '18px',
      fontFamily: style.fontFamily || 'Arial, sans-serif',
      color: style.color || '#ffffff',
      backgroundColor: style.backgroundColor || 'rgba(0, 0, 0, 0.8)',
      borderRadius: style.borderRadius || '4px',
      padding: style.padding || '8px 12px'
    });
  }

  /**
   * Update a setting value
   * @param {string} key 
   * @param {any} value 
   */
  updateSetting(key, value) {
    this.settings[key] = value;
    this.unsavedChanges = true;
    this.updateSaveButtonState();
  }

  /**
   * Update subtitle style property
   * @param {string} property 
   * @param {string} value 
   */
  updateSubtitleStyle(property, value) {
    if (!this.settings.subtitle_style) {
      this.settings.subtitle_style = {};
    }
    this.settings.subtitle_style[property] = value;
    this.unsavedChanges = true;
    this.updateSaveButtonState();
  }

  /**
   * Update background color
   * @param {string} color 
   */
  updateBackgroundColor(color) {
    const opacity = document.getElementById('backgroundOpacity').value / 100;
    const rgb = this.hexToRgb(color);
    const backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    this.updateSubtitleStyle('backgroundColor', backgroundColor);
  }

  /**
   * Update background opacity
   * @param {number} opacity 
   */
  updateBackgroundOpacity(opacity) {
    const colorInput = document.getElementById('backgroundColor');
    const rgb = this.hexToRgb(colorInput.value);
    const backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity / 100})`;
    this.updateSubtitleStyle('backgroundColor', backgroundColor);
  }

  /**
   * Convert hex color to RGB
   * @param {string} hex 
   * @returns {Object}
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Toggle translation settings visibility
   * @param {boolean} enabled 
   */
  toggleTranslationSettings(enabled) {
    const translationSettings = document.getElementById('translationSettings');
    translationSettings.classList.toggle('hidden', !enabled);
  }

  /**
   * Test API key
   * @param {string} provider 
   * @param {string} apiKey 
   * @param {string} statusElementId 
   */
  async testApiKey(provider, apiKey, statusElementId) {
    if (!apiKey || apiKey.includes('••••')) {
      this.showKeyStatus(statusElementId, 'Please enter an API key', 'error');
      return;
    }

    const statusElement = document.getElementById(statusElementId);
    const testButton = statusElementId.includes('openai') ? 
      document.getElementById('testOpenaiKey') : 
      document.getElementById('testGoogleKey');

    // Show testing state
    this.showKeyStatus(statusElementId, 'Testing API key...', 'testing');
    testButton.textContent = 'Testing...';
    testButton.disabled = true;
    testButton.classList.add('testing');

    try {
      const response = await this.sendToBackground({
        action: 'testApiKey',
        provider: provider,
        apiKey: apiKey
      });

      if (response.success && response.isValid) {
        this.showKeyStatus(statusElementId, 'API key is valid', 'success');
      } else {
        this.showKeyStatus(statusElementId, 'Invalid API key', 'error');
      }

    } catch (error) {
      this.showKeyStatus(statusElementId, 'Failed to test API key', 'error');
    } finally {
      testButton.textContent = 'Test';
      testButton.disabled = false;
      testButton.classList.remove('testing');
    }
  }

  /**
   * Show API key status
   * @param {string} elementId 
   * @param {string} message 
   * @param {string} type 
   */
  showKeyStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `key-status ${type}`;
    element.style.display = 'block';
  }

  /**
   * Clear API key status
   * @param {string} elementId 
   */
  clearKeyStatus(elementId) {
    const element = document.getElementById(elementId);
    element.style.display = 'none';
  }

  /**
   * Save settings
   */
  async saveSettings() {
    try {
      const response = await this.sendToBackground({
        action: 'updateSettings',
        settings: this.settings
      });

      if (response.success) {
        this.originalSettings = { ...this.settings };
        this.unsavedChanges = false;
        this.updateSaveButtonState();
        this.showSaveStatus('Settings saved successfully', 'success');
      } else {
        throw new Error(response.error);
      }

    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showSaveStatus('Failed to save settings', 'error');
    }
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      // Load default settings structure
      this.settings = {
        preferred_api: 'openai',
        source_language: 'auto',
        target_language: 'mn',
        translation_enabled: false,
        extension_enabled: true,
        subtitle_style: {
          fontSize: '18px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '4px',
          padding: '8px 12px',
          maxWidth: '80%'
        },
        subtitle_position: 'bottom'
      };

      this.updateUI();
      this.updatePreview();
      this.unsavedChanges = true;
      this.updateSaveButtonState();
      this.showSaveStatus('Settings reset to defaults (not saved yet)', 'success');

    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showSaveStatus('Failed to reset settings', 'error');
    }
  }

  /**
   * Export settings
   */
  exportSettings() {
    const data = JSON.stringify(this.settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'live-subtitles-settings.json';
    a.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Import settings
   */
  importSettings() {
    const fileInput = document.getElementById('fileInput');
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const settings = JSON.parse(e.target.result);
            this.settings = { ...this.settings, ...settings };
            this.updateUI();
            this.updatePreview();
            this.unsavedChanges = true;
            this.updateSaveButtonState();
            this.showSaveStatus('Settings imported (not saved yet)', 'success');
          } catch (error) {
            this.showSaveStatus('Invalid settings file', 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    fileInput.click();
  }

  /**
   * Update save button state
   */
  updateSaveButtonState() {
    const saveButton = document.getElementById('saveSettings');
    saveButton.disabled = !this.unsavedChanges;
    saveButton.textContent = this.unsavedChanges ? 'Save Settings' : 'Settings Saved';
  }

  /**
   * Show save status
   * @param {string} message 
   * @param {string} type 
   */
  showSaveStatus(message, type) {
    const statusElement = document.getElementById('saveStatus');
    statusElement.textContent = message;
    statusElement.className = `save-status ${type}`;
    
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'save-status';
    }, 3000);
  }

  /**
   * Show modal
   * @param {string} title 
   * @param {string} content 
   */
  showModal(title, content = '') {
    const modal = document.getElementById('importExportModal');
    const modalTitle = document.getElementById('modalTitle');
    const settingsJson = document.getElementById('settingsJson');
    
    modalTitle.textContent = title;
    settingsJson.value = content;
    modal.style.display = 'flex';
  }

  /**
   * Hide modal
   */
  hideModal() {
    const modal = document.getElementById('importExportModal');
    modal.style.display = 'none';
  }

  /**
   * Confirm modal action
   */
  confirmModal() {
    // Implementation depends on modal context
    this.hideModal();
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
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});