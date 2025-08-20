// Translation service client for subtitle translation
class TranslationClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = CONSTANTS.APIS.GOOGLE_TRANSLATE_URL;
    this.maxTextLength = 5000; // Google Translate limit per request
  }

  /**
   * Translate text to target language
   * @param {string} text - Text to translate
   * @param {Object} options - Translation options
   * @returns {Promise<Object>}
   */
  async translate(text, options = {}) {
    try {
      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('No text provided for translation');
      }

      if (!this.apiKey) {
        throw new Error('Google API key not configured');
      }

      // Trim and validate text length
      text = text.trim();
      if (text.length === 0) {
        return { translatedText: '', detectedSourceLanguage: 'unknown' };
      }

      if (text.length > this.maxTextLength) {
        // Split long text into chunks
        return await this.translateLongText(text, options);
      }

      // Prepare request parameters
      const params = new URLSearchParams({
        key: this.apiKey,
        q: text,
        target: this.normalizeLanguageCode(options.target || 'mn'),
        format: 'text'
      });

      // Add source language if specified
      if (options.source && options.source !== 'auto') {
        params.append('source', this.normalizeLanguageCode(options.source));
      }

      // Make API request
      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Translate API error response:', errorText);
        
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid Google API key or insufficient permissions');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 400) {
          throw new Error('Invalid translation request');
        } else {
          throw new Error(`Google Translate API error: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();
      
      // Validate response
      if (!result.data || !result.data.translations || result.data.translations.length === 0) {
        throw new Error('No translation result received');
      }

      const translation = result.data.translations[0];
      
      return {
        translatedText: translation.translatedText,
        detectedSourceLanguage: translation.detectedSourceLanguage || options.source || 'unknown',
        confidence: 1.0 // Google Translate doesn't provide confidence scores
      };

    } catch (error) {
      console.error('Translation failed:', error);
      throw error;
    }
  }

  /**
   * Translate long text by splitting into chunks
   * @param {string} text 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async translateLongText(text, options = {}) {
    try {
      // Split text into sentences or logical chunks
      const chunks = this.splitTextIntoChunks(text, this.maxTextLength - 100);
      const translatedChunks = [];
      let detectedLanguage = 'unknown';

      for (const chunk of chunks) {
        if (chunk.trim().length === 0) continue;

        const result = await this.translate(chunk, options);
        translatedChunks.push(result.translatedText);
        
        // Use detected language from first chunk
        if (detectedLanguage === 'unknown' && result.detectedSourceLanguage) {
          detectedLanguage = result.detectedSourceLanguage;
        }

        // Small delay to avoid rate limiting
        await this.sleep(100);
      }

      return {
        translatedText: translatedChunks.join(' '),
        detectedSourceLanguage: detectedLanguage,
        confidence: 1.0
      };

    } catch (error) {
      console.error('Long text translation failed:', error);
      throw error;
    }
  }

  /**
   * Split text into manageable chunks
   * @param {string} text 
   * @param {number} maxLength 
   * @returns {Array<string>}
   */
  splitTextIntoChunks(text, maxLength) {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;

      if (potentialChunk.length <= maxLength) {
        currentChunk = potentialChunk;
      } else {
        // Current chunk is full, start a new one
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // If single sentence is too long, split by words
        if (trimmedSentence.length > maxLength) {
          const wordChunks = this.splitByWords(trimmedSentence, maxLength);
          chunks.push(...wordChunks);
          currentChunk = '';
        } else {
          currentChunk = trimmedSentence;
        }
      }
    }

    // Add the last chunk
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Split text by words when sentences are too long
   * @param {string} text 
   * @param {number} maxLength 
   * @returns {Array<string>}
   */
  splitByWords(text, maxLength) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + word;

      if (potentialChunk.length <= maxLength) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Detect the language of text
   * @param {string} text 
   * @returns {Promise<Object>}
   */
  async detectLanguage(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('No text provided for language detection');
      }

      if (!this.apiKey) {
        throw new Error('Google API key not configured');
      }

      const detectUrl = 'https://translation.googleapis.com/language/translate/v2/detect';
      const params = new URLSearchParams({
        key: this.apiKey,
        q: text.trim()
      });

      const response = await fetch(`${detectUrl}?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        throw new Error(`Language detection failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.data || !result.data.detections || result.data.detections.length === 0) {
        throw new Error('No language detection result');
      }

      const detection = result.data.detections[0][0];
      
      return {
        language: detection.language,
        confidence: detection.confidence || 0,
        isReliable: detection.isReliable || false
      };

    } catch (error) {
      console.error('Language detection failed:', error);
      throw error;
    }
  }

  /**
   * Get supported languages
   * @returns {Promise<Array>}
   */
  async getSupportedLanguages() {
    try {
      if (!this.apiKey) {
        throw new Error('Google API key not configured');
      }

      const languagesUrl = 'https://translation.googleapis.com/language/translate/v2/languages';
      const params = new URLSearchParams({
        key: this.apiKey,
        target: 'en' // Get language names in English
      });

      const response = await fetch(`${languagesUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to get supported languages: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.data || !result.data.languages) {
        throw new Error('No languages data received');
      }

      return result.data.languages.map(lang => ({
        code: lang.language,
        name: lang.name
      }));

    } catch (error) {
      console.error('Failed to get supported languages:', error);
      // Return a fallback list of common languages
      return this.getCommonLanguages();
    }
  }

  /**
   * Get common languages fallback list
   * @returns {Array}
   */
  getCommonLanguages() {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'th', name: 'Thai' },
      { code: 'vi', name: 'Vietnamese' },
      { code: 'mn', name: 'Mongolian' },
      { code: 'tr', name: 'Turkish' },
      { code: 'pl', name: 'Polish' },
      { code: 'nl', name: 'Dutch' },
      { code: 'sv', name: 'Swedish' },
      { code: 'da', name: 'Danish' },
      { code: 'no', name: 'Norwegian' },
      { code: 'fi', name: 'Finnish' }
    ];
  }

  /**
   * Normalize language code for Google Translate
   * @param {string} languageCode 
   * @returns {string}
   */
  normalizeLanguageCode(languageCode) {
    // Map common language codes to Google Translate format
    const languageMap = {
      'zh-CN': 'zh',
      'zh-TW': 'zh-TW',
      'zh-HK': 'zh-TW',
      'en-US': 'en',
      'en-GB': 'en',
      'es-ES': 'es',
      'es-MX': 'es',
      'pt-BR': 'pt',
      'pt-PT': 'pt',
      'auto': undefined // Don't specify source for auto-detection
    };

    return languageMap[languageCode] || languageCode.split('-')[0];
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

      // Test with a simple translation
      const result = await this.translate('Hello', { target: 'es' });
      return !!(result && result.translatedText);

    } catch (error) {
      console.error('Translation connection test failed:', error);
      return false;
    }
  }

  /**
   * Get translation cache key
   * @param {string} text 
   * @param {string} target 
   * @param {string} source 
   * @returns {string}
   */
  getCacheKey(text, target, source = 'auto') {
    return `translate_${source}_${target}_${this.hashString(text)}`;
  }

  /**
   * Simple string hash function
   * @param {string} str 
   * @returns {string}
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Sleep utility for rate limiting
   * @param {number} ms 
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get usage statistics
   * @returns {Object}
   */
  getUsageStats() {
    // Could be implemented to track API usage
    return {
      translationsToday: 0,
      charactersTranslated: 0,
      averageResponseTime: 0
    };
  }
}

// Make TranslationClient available globally
if (typeof window !== 'undefined') {
  window.TranslationClient = TranslationClient;
}