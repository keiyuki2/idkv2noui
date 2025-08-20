// OpenAI Whisper API client for high-accuracy speech recognition
class WhisperClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = CONSTANTS.APIS.OPENAI_WHISPER_URL;
    this.maxFileSize = 25 * 1024 * 1024; // 25MB limit
  }

  /**
   * Transcribe audio using OpenAI Whisper
   * @param {string} audioData - Base64 encoded audio data
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>}
   */
  async transcribe(audioData, options = {}) {
    try {
      // Validate input
      if (!audioData) {
        throw new Error('No audio data provided');
      }

      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Convert base64 to blob
      const audioBlob = this.base64ToBlob(audioData, `audio/${options.format || 'webm'}`);
      
      // Check file size
      if (audioBlob.size > this.maxFileSize) {
        throw new Error(`Audio file too large: ${audioBlob.size} bytes (max: ${this.maxFileSize})`);
      }

      if (audioBlob.size < 100) {
        // Skip very small audio chunks
        return { text: '', confidence: 0, language: options.language || 'unknown' };
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('file', audioBlob, `audio.${options.format || 'webm'}`);
      formData.append('model', 'whisper-1');
      
      // Set language if specified (not auto)
      if (options.language && options.language !== 'auto') {
        formData.append('language', this.normalizeLanguageCode(options.language));
      }

      // Optional: set response format
      formData.append('response_format', 'json');

      // Optional: set temperature for creativity (0.0 - 1.0)
      formData.append('temperature', '0.2');

      // Make API request
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error response:', errorText);
        
        if (response.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 413) {
          throw new Error('Audio file too large');
        } else {
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();
      
      // Validate response
      if (!result.text) {
        return { text: '', confidence: 0, language: options.language || 'unknown' };
      }

      return {
        text: result.text.trim(),
        confidence: 1.0, // Whisper doesn't provide confidence scores
        language: options.language || 'unknown',
        duration: result.duration || null
      };

    } catch (error) {
      console.error('Whisper transcription failed:', error);
      throw error;
    }
  }

  /**
   * Test API connection and key validity
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return false;
      }

      // Create a minimal test audio file (silent audio)
      const testAudioData = this.createTestAudioBlob();
      const formData = new FormData();
      formData.append('file', testAudioData, 'test.mp3');
      formData.append('model', 'whisper-1');

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      // 401 means invalid key, anything else suggests the key is valid
      return response.status !== 401;

    } catch (error) {
      console.error('Whisper connection test failed:', error);
      return false;
    }
  }

  /**
   * Get supported languages
   * @returns {Array}
   */
  getSupportedLanguages() {
    return [
      'auto', 'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl',
      'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el',
      'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt',
      'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl',
      'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq',
      'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka',
      'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk',
      'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln',
      'ha', 'ba', 'jw', 'su'
    ];
  }

  /**
   * Normalize language code for Whisper API
   * @param {string} languageCode 
   * @returns {string}
   */
  normalizeLanguageCode(languageCode) {
    // Map common language codes to Whisper format
    const languageMap = {
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'en-US': 'en',
      'en-GB': 'en',
      'es-ES': 'es',
      'pt-BR': 'pt',
      'pt-PT': 'pt'
    };

    return languageMap[languageCode] || languageCode.split('-')[0];
  }

  /**
   * Convert base64 to blob
   * @param {string} base64 
   * @param {string} mimeType 
   * @returns {Blob}
   */
  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Create a minimal test audio blob
   * @returns {Blob}
   */
  createTestAudioBlob() {
    // Create a minimal MP3 header + silent audio
    const mp3Header = new Uint8Array([
      0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    
    return new Blob([mp3Header], { type: 'audio/mp3' });
  }

  /**
   * Get usage statistics
   * @returns {Object}
   */
  getUsageStats() {
    // Could be implemented to track API usage
    return {
      requestsToday: 0,
      charactersProcessed: 0,
      averageResponseTime: 0
    };
  }
}

// Make WhisperClient available globally
if (typeof window !== 'undefined') {
  window.WhisperClient = WhisperClient;
}