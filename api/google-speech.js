// Google Speech-to-Text API client for backup speech recognition
class GoogleSpeechClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = CONSTANTS.APIS.GOOGLE_SPEECH_URL;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB limit for synchronous requests
  }

  /**
   * Transcribe audio using Google Speech-to-Text
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
        throw new Error('Google API key not configured');
      }

      // Check file size
      const audioSize = (audioData.length * 3) / 4; // Approximate size from base64
      if (audioSize > this.maxFileSize) {
        throw new Error(`Audio file too large: ${audioSize} bytes (max: ${this.maxFileSize})`);
      }

      if (audioSize < 100) {
        // Skip very small audio chunks
        return { text: '', confidence: 0, language: options.languageCode || 'en-US' };
      }

      // Prepare request body
      const requestBody = {
        config: {
          encoding: this.getGoogleEncoding(options.format),
          sampleRateHertz: CONSTANTS.AUDIO.SAMPLE_RATE,
          languageCode: this.normalizeLanguageCode(options.languageCode || 'en-US'),
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
          model: 'default', // or 'video' for video content
          useEnhanced: true // Use enhanced models when available
        },
        audio: {
          content: audioData
        }
      };

      // Add alternative language codes for better recognition
      if (options.languageCode === 'auto' || !options.languageCode) {
        requestBody.config.alternativeLanguageCodes = ['en-US', 'es-ES', 'fr-FR', 'de-DE'];
      }

      // Make API request
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Speech API error response:', errorText);
        
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid Google API key or insufficient permissions');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 413) {
          throw new Error('Audio file too large');
        } else {
          throw new Error(`Google Speech API error: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();
      
      // Handle API response
      if (!result.results || result.results.length === 0) {
        return { 
          text: '', 
          confidence: 0, 
          language: options.languageCode || 'en-US' 
        };
      }

      // Get the best alternative
      const alternative = result.results[0].alternatives[0];
      if (!alternative || !alternative.transcript) {
        return { 
          text: '', 
          confidence: 0, 
          language: options.languageCode || 'en-US' 
        };
      }

      return {
        text: alternative.transcript.trim(),
        confidence: alternative.confidence || 0,
        language: result.results[0].languageCode || options.languageCode || 'en-US'
      };

    } catch (error) {
      console.error('Google Speech transcription failed:', error);
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

      // Create minimal test request
      const testRequest = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US'
        },
        audio: {
          content: '' // Empty audio content for testing
        }
      };

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testRequest)
      });

      // 401/403 means invalid key, other errors suggest the key is valid
      return response.status !== 401 && response.status !== 403;

    } catch (error) {
      console.error('Google Speech connection test failed:', error);
      return false;
    }
  }

  /**
   * Get supported languages
   * @returns {Array}
   */
  getSupportedLanguages() {
    return [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-NZ', 'en-ZA',
      'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-CL', 'es-PE', 'es-VE',
      'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH',
      'de-DE', 'de-AT', 'de-CH',
      'it-IT', 'it-CH',
      'pt-BR', 'pt-PT',
      'ru-RU',
      'ja-JP',
      'ko-KR',
      'zh-CN', 'zh-TW', 'zh-HK',
      'nl-NL', 'nl-BE',
      'sv-SE',
      'da-DK',
      'no-NO',
      'fi-FI',
      'pl-PL',
      'cs-CZ',
      'sk-SK',
      'hu-HU',
      'ro-RO',
      'bg-BG',
      'hr-HR',
      'sl-SI',
      'et-EE',
      'lv-LV',
      'lt-LT',
      'el-GR',
      'tr-TR',
      'ar-SA', 'ar-AE', 'ar-BH', 'ar-DZ', 'ar-EG', 'ar-IQ', 'ar-JO', 'ar-KW', 'ar-LB', 'ar-MA', 'ar-OM', 'ar-QA', 'ar-TN', 'ar-YE',
      'he-IL',
      'hi-IN',
      'th-TH',
      'vi-VN',
      'id-ID',
      'ms-MY',
      'tl-PH',
      'uk-UA',
      'be-BY',
      'ka-GE',
      'hy-AM',
      'az-AZ',
      'kk-KZ',
      'ky-KG',
      'uz-UZ',
      'mn-MN'
    ];
  }

  /**
   * Normalize language code for Google Speech API
   * @param {string} languageCode 
   * @returns {string}
   */
  normalizeLanguageCode(languageCode) {
    // Map common language codes to Google Speech format
    const languageMap = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'nl': 'nl-NL',
      'sv': 'sv-SE',
      'da': 'da-DK',
      'no': 'no-NO',
      'fi': 'fi-FI',
      'pl': 'pl-PL',
      'cs': 'cs-CZ',
      'hu': 'hu-HU',
      'tr': 'tr-TR',
      'ar': 'ar-SA',
      'he': 'he-IL',
      'hi': 'hi-IN',
      'th': 'th-TH',
      'vi': 'vi-VN',
      'id': 'id-ID',
      'ms': 'ms-MY',
      'uk': 'uk-UA',
      'mn': 'mn-MN',
      'auto': 'en-US'
    };

    return languageMap[languageCode] || languageCode;
  }

  /**
   * Get Google Speech encoding from format
   * @param {string} format 
   * @returns {string}
   */
  getGoogleEncoding(format) {
    const encodingMap = {
      'webm': 'WEBM_OPUS',
      'opus': 'WEBM_OPUS',
      'mp4': 'MP3',
      'mp3': 'MP3',
      'wav': 'LINEAR16',
      'flac': 'FLAC',
      'ogg': 'OGG_OPUS'
    };

    return encodingMap[format] || 'WEBM_OPUS';
  }

  /**
   * Get recognition features for enhanced accuracy
   * @returns {Object}
   */
  getEnhancedFeatures() {
    return {
      enableSpeakerDiarization: false, // For multiple speakers
      diarizationSpeakerCount: 2,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: false,
      enableWordConfidence: true,
      maxAlternatives: 1,
      profanityFilter: false,
      speechContexts: [], // For custom vocabulary
      useEnhanced: true,
      model: 'default' // 'video', 'phone_call', 'command_and_search', 'default'
    };
  }

  /**
   * Long running recognize (for files > 1 minute)
   * @param {string} audioData 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async longRunningRecognize(audioData, options = {}) {
    // Implementation for long audio files using operations API
    // This would be useful for very long video content
    throw new Error('Long running recognition not implemented yet');
  }

  /**
   * Streaming recognition (for real-time audio)
   * @param {ReadableStream} audioStream 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async streamingRecognize(audioStream, options = {}) {
    // Implementation for streaming recognition
    // Would require WebSocket connection to Google Speech API
    throw new Error('Streaming recognition not implemented yet');
  }

  /**
   * Get usage statistics
   * @returns {Object}
   */
  getUsageStats() {
    // Could be implemented to track API usage
    return {
      requestsToday: 0,
      minutesProcessed: 0,
      averageResponseTime: 0
    };
  }
}

// Make GoogleSpeechClient available globally
if (typeof window !== 'undefined') {
  window.GoogleSpeechClient = GoogleSpeechClient;
}