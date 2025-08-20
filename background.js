// Background service worker for API communication and extension management
class BackgroundService {
  constructor() {
    this.init();
  }

  /**
   * Initialize the background service
   */
  init() {
    this.setupEventListeners();
    this.setupContextMenus();
    console.log('Live Subtitles background service initialized');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Message handling from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Extension icon click
    chrome.action.onClicked.addListener((tab) => {
      this.toggleSubtitles(tab);
    });

    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.updateTabState(tab);
      }
    });
  }

  /**
   * Setup context menus
   */
  async setupContextMenus() {
    try {
      await chrome.contextMenus.removeAll();
      
      chrome.contextMenus.create({
        id: 'toggle-subtitles',
        title: 'Toggle Live Subtitles',
        contexts: ['video']
      });

      chrome.contextMenus.create({
        id: 'subtitle-settings',
        title: 'Subtitle Settings',
        contexts: ['video']
      });

      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleContextMenu(info, tab);
      });

    } catch (error) {
      console.error('Failed to setup context menus:', error);
    }
  }

  /**
   * Handle messages from content scripts and popup
   * @param {Object} message 
   * @param {Object} sender 
   * @param {Function} sendResponse 
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'transcribe':
          await this.handleTranscription(message, sendResponse);
          break;
          
        case 'translate':
          await this.handleTranslation(message, sendResponse);
          break;
          
        case 'getSettings':
          await this.handleGetSettings(sendResponse);
          break;
          
        case 'updateSettings':
          await this.handleUpdateSettings(message, sendResponse);
          break;
          
        case 'testApiKey':
          await this.handleTestApiKey(message, sendResponse);
          break;
          
        case 'getStatus':
          await this.handleGetStatus(sender, sendResponse);
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle transcription request
   * @param {Object} message 
   * @param {Function} sendResponse 
   */
  async handleTranscription(message, sendResponse) {
    const { audioData, mimeType, settings } = message;
    
    try {
      // Get API key
      const apiKey = await this.getApiKey(settings.preferredApi);
      if (!apiKey) {
        sendResponse({ 
          success: false, 
          error: `No ${settings.preferredApi} API key configured` 
        });
        return;
      }

      // Choose API client
      let result;
      if (settings.preferredApi === 'openai') {
        const whisperClient = new WhisperClient(apiKey);
        result = await whisperClient.transcribe(audioData, {
          language: settings.sourceLanguage === 'auto' ? undefined : settings.sourceLanguage,
          format: this.getMimeTypeFormat(mimeType)
        });
      } else if (settings.preferredApi === 'google') {
        const googleClient = new GoogleSpeechClient(apiKey);
        result = await googleClient.transcribe(audioData, {
          languageCode: settings.sourceLanguage === 'auto' ? 'en-US' : settings.sourceLanguage,
          format: this.getMimeTypeFormat(mimeType)
        });
      } else {
        throw new Error('Unsupported API provider');
      }

      sendResponse({
        success: true,
        text: result.text,
        confidence: result.confidence,
        language: result.language
      });

    } catch (error) {
      console.error('Transcription failed:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Handle translation request
   * @param {Object} message 
   * @param {Function} sendResponse 
   */
  async handleTranslation(message, sendResponse) {
    const { text, targetLanguage, sourceLanguage } = message;
    
    try {
      // Get Google API key for translation
      const apiKey = await this.getApiKey('google');
      if (!apiKey) {
        sendResponse({ 
          success: false, 
          error: 'No Google API key configured for translation' 
        });
        return;
      }

      const translator = new TranslationClient(apiKey);
      const result = await translator.translate(text, {
        target: targetLanguage,
        source: sourceLanguage === 'auto' ? undefined : sourceLanguage
      });

      sendResponse({
        success: true,
        translatedText: result.translatedText,
        detectedLanguage: result.detectedSourceLanguage
      });

    } catch (error) {
      console.error('Translation failed:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Handle settings retrieval
   * @param {Function} sendResponse 
   */
  async handleGetSettings(sendResponse) {
    try {
      const settings = await StorageManager.getAllSettings();
      sendResponse({ success: true, settings });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle settings update
   * @param {Object} message 
   * @param {Function} sendResponse 
   */
  async handleUpdateSettings(message, sendResponse) {
    try {
      const success = await StorageManager.setSettings(message.settings);
      
      if (success) {
        // Notify all tabs about settings update
        this.notifyAllTabs({ action: 'updateSettings' });
      }
      
      sendResponse({ success });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Test API key validity
   * @param {Object} message 
   * @param {Function} sendResponse 
   */
  async handleTestApiKey(message, sendResponse) {
    const { provider, apiKey } = message;
    
    try {
      let isValid = false;
      
      if (provider === 'openai') {
        const client = new WhisperClient(apiKey);
        isValid = await client.testConnection();
      } else if (provider === 'google') {
        const client = new GoogleSpeechClient(apiKey);
        isValid = await client.testConnection();
      }
      
      sendResponse({ success: true, isValid });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Get status from content script
   * @param {Object} sender 
   * @param {Function} sendResponse 
   */
  async handleGetStatus(sender, sendResponse) {
    try {
      if (sender.tab) {
        chrome.tabs.sendMessage(sender.tab.id, { action: 'getStatus' }, (response) => {
          sendResponse(response || { success: false, error: 'No response from content script' });
        });
      } else {
        sendResponse({ success: false, error: 'No tab context' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Get API key from storage
   * @param {string} provider 
   * @returns {Promise<string|null>}
   */
  async getApiKey(provider) {
    const key = provider === 'openai' 
      ? CONSTANTS.STORAGE_KEYS.OPENAI_API_KEY 
      : CONSTANTS.STORAGE_KEYS.GOOGLE_API_KEY;
    
    return await StorageManager.getSecureSetting(key);
  }

  /**
   * Get format from MIME type
   * @param {string} mimeType 
   * @returns {string}
   */
  getMimeTypeFormat(mimeType) {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('wav')) return 'wav';
    return 'webm'; // default
  }

  /**
   * Toggle subtitles on current tab
   * @param {Object} tab 
   */
  async toggleSubtitles(tab) {
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
    } catch (error) {
      console.error('Failed to toggle subtitles:', error);
    }
  }

  /**
   * Update tab state (icon, etc.)
   * @param {Object} tab 
   */
  async updateTabState(tab) {
    // Could implement icon state updates based on subtitle status
  }

  /**
   * Handle context menu clicks
   * @param {Object} info 
   * @param {Object} tab 
   */
  handleContextMenu(info, tab) {
    switch (info.menuItemId) {
      case 'toggle-subtitles':
        this.toggleSubtitles(tab);
        break;
        
      case 'subtitle-settings':
        chrome.runtime.openOptionsPage();
        break;
    }
  }

  /**
   * Notify all tabs about updates
   * @param {Object} message 
   */
  async notifyAllTabs(message) {
    try {
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
    } catch (error) {
      console.error('Failed to notify tabs:', error);
    }
  }
}

// API client classes (to be imported)
class WhisperClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = CONSTANTS.APIS.OPENAI_WHISPER_URL;
  }

  async transcribe(audioData, options = {}) {
    const formData = new FormData();
    
    // Convert base64 to blob
    const audioBlob = this.base64ToBlob(audioData, `audio/${options.format || 'webm'}`);
    formData.append('file', audioBlob, `audio.${options.format || 'webm'}`);
    formData.append('model', 'whisper-1');
    
    if (options.language) {
      formData.append('language', options.language);
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      text: result.text,
      confidence: 1.0, // Whisper doesn't provide confidence scores
      language: options.language || 'unknown'
    };
  }

  async testConnection() {
    // Simple test with minimal audio data
    try {
      // Create a minimal audio blob for testing
      const testBlob = new Blob([''], { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', testBlob, 'test.webm');
      formData.append('model', 'whisper-1');

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      // Even if transcription fails, a 401 means invalid key, anything else means key is valid
      return response.status !== 401;
    } catch (error) {
      return false;
    }
  }

  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

class GoogleSpeechClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = CONSTANTS.APIS.GOOGLE_SPEECH_URL;
  }

  async transcribe(audioData, options = {}) {
    const requestBody = {
      config: {
        encoding: this.getGoogleEncoding(options.format),
        sampleRateHertz: CONSTANTS.AUDIO.SAMPLE_RATE,
        languageCode: options.languageCode || 'en-US'
      },
      audio: {
        content: audioData
      }
    };

    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Google Speech API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.results || result.results.length === 0) {
      return { text: '', confidence: 0, language: options.languageCode };
    }

    const alternative = result.results[0].alternatives[0];
    return {
      text: alternative.transcript,
      confidence: alternative.confidence || 0,
      language: options.languageCode
    };
  }

  getGoogleEncoding(format) {
    switch (format) {
      case 'webm': return 'WEBM_OPUS';
      case 'mp4': return 'MP3';
      case 'wav': return 'LINEAR16';
      default: return 'WEBM_OPUS';
    }
  }

  async testConnection() {
    // Test with minimal request
    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { encoding: 'LINEAR16', sampleRateHertz: 16000, languageCode: 'en-US' },
          audio: { content: '' }
        })
      });
      
      return response.status !== 401 && response.status !== 403;
    } catch (error) {
      return false;
    }
  }
}

class TranslationClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = CONSTANTS.APIS.GOOGLE_TRANSLATE_URL;
  }

  async translate(text, options = {}) {
    const params = new URLSearchParams({
      key: this.apiKey,
      q: text,
      target: options.target || 'mn'
    });

    if (options.source) {
      params.append('source', options.source);
    }

    const response = await fetch(`${this.baseUrl}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.data || !result.data.translations || result.data.translations.length === 0) {
      throw new Error('No translation result');
    }

    const translation = result.data.translations[0];
    return {
      translatedText: translation.translatedText,
      detectedSourceLanguage: translation.detectedSourceLanguage
    };
  }
}

// Initialize background service
new BackgroundService();