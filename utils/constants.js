// Configuration constants for the Live Subtitles extension
const CONSTANTS = {
  // API Configuration
  APIS: {
    OPENAI_WHISPER_URL: 'https://api.openai.com/v1/audio/transcriptions',
    GOOGLE_SPEECH_URL: 'https://speech.googleapis.com/v1/speech:recognize',
    GOOGLE_TRANSLATE_URL: 'https://translation.googleapis.com/language/translate/v2'
  },
  
  // Audio Processing
  AUDIO: {
    SAMPLE_RATE: 16000,
    CHUNK_DURATION: 3000, // 3 seconds
    BUFFER_SIZE: 4096,
    MIME_TYPE: 'audio/webm;codecs=opus'
  },
  
  // Subtitle Configuration
  SUBTITLES: {
    MAX_DISPLAY_TIME: 5000, // 5 seconds
    FADE_DURATION: 300, // milliseconds
    MAX_CHARACTERS_PER_LINE: 60,
    POSITION: {
      BOTTOM: 'bottom',
      TOP: 'top',
      CENTER: 'center'
    }
  },
  
  // Languages
  LANGUAGES: {
    SOURCE: {
      AUTO: 'auto',
      ENGLISH: 'en',
      SPANISH: 'es',
      FRENCH: 'fr',
      GERMAN: 'de',
      CHINESE: 'zh',
      JAPANESE: 'ja',
      KOREAN: 'ko'
    },
    TARGET: {
      MONGOLIAN: 'mn',
      ENGLISH: 'en',
      SPANISH: 'es',
      FRENCH: 'fr',
      GERMAN: 'de',
      CHINESE: 'zh'
    }
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    OPENAI_API_KEY: 'openai_api_key',
    GOOGLE_API_KEY: 'google_api_key',
    PREFERRED_API: 'preferred_api',
    SOURCE_LANGUAGE: 'source_language',
    TARGET_LANGUAGE: 'target_language',
    SUBTITLE_STYLE: 'subtitle_style',
    SUBTITLE_POSITION: 'subtitle_position',
    TRANSLATION_ENABLED: 'translation_enabled',
    EXTENSION_ENABLED: 'extension_enabled'
  },
  
  // Default Settings
  DEFAULTS: {
    PREFERRED_API: 'openai',
    SOURCE_LANGUAGE: 'auto',
    TARGET_LANGUAGE: 'mn',
    TRANSLATION_ENABLED: false,
    EXTENSION_ENABLED: true,
    SUBTITLE_STYLE: {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '4px',
      padding: '8px 12px',
      maxWidth: '80%'
    },
    SUBTITLE_POSITION: 'bottom'
  },
  
  // Error Messages
  ERRORS: {
    NO_API_KEY: 'API key not configured',
    API_REQUEST_FAILED: 'Speech recognition request failed',
    AUDIO_CAPTURE_FAILED: 'Failed to capture audio from video',
    VIDEO_NOT_FOUND: 'No video element found',
    TRANSLATION_FAILED: 'Translation request failed'
  },
  
  // Event Names
  EVENTS: {
    VIDEO_DETECTED: 'subtitles:video-detected',
    AUDIO_CHUNK_READY: 'subtitles:audio-chunk-ready',
    SUBTITLE_RECEIVED: 'subtitles:subtitle-received',
    TRANSLATION_RECEIVED: 'subtitles:translation-received',
    ERROR_OCCURRED: 'subtitles:error',
    SETTINGS_UPDATED: 'subtitles:settings-updated'
  }
};

// Make constants available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
} else if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}