// Main content script that coordinates video detection, audio capture, and subtitle display
class LiveSubtitlesController {
  constructor() {
    this.videoDetector = null;
    this.audioCapture = null;
    this.subtitleOverlay = null;
    this.isEnabled = false;
    this.currentVideo = null;
    this.settings = null;
    this.processingQueue = [];
    this.isProcessing = false;
    this.init();
  }

  /**
   * Initialize the live subtitles system
   */
  async init() {
    try {
      // Load settings first
      await this.loadSettings();
      
      if (!this.settings[CONSTANTS.STORAGE_KEYS.EXTENSION_ENABLED]) {
        console.log('Live subtitles extension is disabled');
        return;
      }

      // Check browser compatibility
      if (!this.checkCompatibility()) {
        console.error('Browser not compatible with live subtitles');
        return;
      }

      // Initialize components
      await this.initializeComponents();
      this.setupEventListeners();
      this.isEnabled = true;

      console.log('Live subtitles controller initialized successfully');

    } catch (error) {
      console.error('Failed to initialize live subtitles controller:', error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      this.settings = await StorageManager.getAllSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = CONSTANTS.DEFAULTS;
    }
  }

  /**
   * Check browser compatibility
   * @returns {boolean}
   */
  checkCompatibility() {
    const requirements = AudioCapture.getCapabilities();
    return requirements.isSupported;
  }

  /**
   * Initialize all components
   */
  async initializeComponents() {
    // Initialize subtitle overlay first
    this.subtitleOverlay = new SubtitleOverlay();
    await this.subtitleOverlay.init();

    // Initialize audio capture
    this.audioCapture = new AudioCapture();
    await this.audioCapture.init();

    // Initialize video detector
    this.videoDetector = new VideoDetector();
  }

  /**
   * Setup event listeners for component coordination
   */
  setupEventListeners() {
    // Video detection events
    document.addEventListener(CONSTANTS.EVENTS.VIDEO_DETECTED, (event) => {
      this.handleVideoDetected(event.detail);
    });

    // Audio chunk events
    document.addEventListener(CONSTANTS.EVENTS.AUDIO_CHUNK_READY, (event) => {
      this.handleAudioChunk(event.detail);
    });

    // Settings change events
    document.addEventListener(CONSTANTS.EVENTS.SETTINGS_UPDATED, () => {
      this.loadSettings();
    });

    // Background script communication
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
    });

    // Page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // User interaction to resume audio context
    document.addEventListener('click', () => {
      this.resumeAudioContextIfNeeded();
    }, { once: true });
  }

  /**
   * Handle video detection event
   * @param {Object} detail 
   */
  async handleVideoDetected(detail) {
    const { video, hasAudio, action } = detail;

    if (action === 'seeking') {
      // Clear subtitles when user seeks in video
      this.subtitleOverlay.clearSubtitles();
      return;
    }

    if (action === 'volumechange') {
      // Handle volume changes
      if (detail.muted || detail.volume === 0) {
        await this.stopProcessing();
      } else if (this.currentVideo === video && !this.audioCapture.isActive()) {
        await this.startProcessing(video);
      }
      return;
    }

    // New video detected
    if (video !== this.currentVideo) {
      await this.stopProcessing();
      
      if (hasAudio && this.isVideoEligible(video)) {
        await this.startProcessing(video);
      }
    }
  }

  /**
   * Check if video is eligible for subtitle processing
   * @param {HTMLVideoElement} video 
   * @returns {boolean}
   */
  isVideoEligible(video) {
    if (!video || video.muted || video.volume === 0) {
      return false;
    }

    // Skip very short videos
    if (video.duration && video.duration < 10) {
      return false;
    }

    // Check minimum video size
    const rect = video.getBoundingClientRect();
    if (rect.width < 200 || rect.height < 150) {
      return false;
    }

    return true;
  }

  /**
   * Start processing audio from video
   * @param {HTMLVideoElement} video 
   */
  async startProcessing(video) {
    if (!this.isEnabled || !video) return;

    try {
      this.currentVideo = video;
      
      // Check API key availability
      const apiKeys = await StorageManager.checkApiKeys();
      if (!apiKeys.hasAnyKey) {
        this.subtitleOverlay.showError('No API key configured. Please check extension settings.');
        return;
      }

      // Start audio capture
      const success = await this.audioCapture.startCapture(video);
      if (!success) {
        this.subtitleOverlay.showError('Failed to capture audio from video');
        return;
      }

      console.log('Started processing video:', video.src || 'unknown source');

    } catch (error) {
      console.error('Failed to start processing:', error);
      this.subtitleOverlay.showError('Failed to start live subtitles');
    }
  }

  /**
   * Stop processing current video
   */
  async stopProcessing() {
    if (this.audioCapture) {
      await this.audioCapture.stopCapture();
    }
    
    if (this.subtitleOverlay) {
      this.subtitleOverlay.clearSubtitles();
    }
    
    this.currentVideo = null;
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Handle audio chunk for speech recognition
   * @param {Object} chunkData 
   */
  async handleAudioChunk(chunkData) {
    if (!this.isEnabled || !this.currentVideo) return;

    try {
      // Add to processing queue
      this.processingQueue.push(chunkData);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processAudioQueue();
      }

    } catch (error) {
      console.error('Failed to handle audio chunk:', error);
    }
  }

  /**
   * Process audio chunks in queue
   */
  async processAudioQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;
    this.subtitleOverlay.showLoading();

    while (this.processingQueue.length > 0) {
      const chunkData = this.processingQueue.shift();
      
      try {
        await this.processAudioChunk(chunkData);
      } catch (error) {
        console.error('Failed to process audio chunk:', error);
      }
    }

    this.isProcessing = false;
    this.subtitleOverlay.hideLoading();
  }

  /**
   * Process individual audio chunk
   * @param {Object} chunkData 
   */
  async processAudioChunk(chunkData) {
    try {
      // Convert blob to base64 for API transmission
      const base64Audio = await AudioUtils.blobToBase64(chunkData.blob);
      
      // Send to background script for API processing
      const response = await this.sendToBackground({
        action: 'transcribe',
        audioData: base64Audio,
        mimeType: chunkData.mimeType,
        settings: {
          preferredApi: this.settings[CONSTANTS.STORAGE_KEYS.PREFERRED_API],
          sourceLanguage: this.settings[CONSTANTS.STORAGE_KEYS.SOURCE_LANGUAGE],
          targetLanguage: this.settings[CONSTANTS.STORAGE_KEYS.TARGET_LANGUAGE],
          translationEnabled: this.settings[CONSTANTS.STORAGE_KEYS.TRANSLATION_ENABLED]
        }
      });

      if (response.success) {
        // Display subtitle
        if (response.text) {
          this.subtitleOverlay.displaySubtitle(response.text, false);
          
          // Request translation if enabled
          if (this.settings[CONSTANTS.STORAGE_KEYS.TRANSLATION_ENABLED] && response.text) {
            this.requestTranslation(response.text);
          }
        }
      } else {
        console.error('Transcription failed:', response.error);
        if (response.error !== 'Empty response') {
          this.subtitleOverlay.showError('Transcription failed');
        }
      }

    } catch (error) {
      console.error('Failed to process audio chunk:', error);
    }
  }

  /**
   * Request translation for subtitle text
   * @param {string} text 
   */
  async requestTranslation(text) {
    try {
      const response = await this.sendToBackground({
        action: 'translate',
        text: text,
        targetLanguage: this.settings[CONSTANTS.STORAGE_KEYS.TARGET_LANGUAGE],
        sourceLanguage: this.settings[CONSTANTS.STORAGE_KEYS.SOURCE_LANGUAGE]
      });

      if (response.success && response.translatedText) {
        this.subtitleOverlay.displaySubtitle(response.translatedText, true);
      }

    } catch (error) {
      console.error('Translation request failed:', error);
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
   * Handle messages from background script
   * @param {Object} message 
   * @param {Object} sender 
   * @param {Function} sendResponse 
   */
  handleBackgroundMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'toggle':
        this.toggleSubtitles();
        sendResponse({ success: true });
        break;
        
      case 'updateSettings':
        this.loadSettings();
        sendResponse({ success: true });
        break;
        
      case 'getStatus':
        sendResponse({
          success: true,
          status: this.getStatus()
        });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  /**
   * Toggle subtitles on/off
   */
  async toggleSubtitles() {
    if (this.isEnabled) {
      await this.stopProcessing();
      this.isEnabled = false;
    } else {
      this.isEnabled = true;
      if (this.currentVideo) {
        await this.startProcessing(this.currentVideo);
      }
    }
  }

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange() {
    if (document.hidden) {
      // Page hidden - pause processing to save resources
      this.stopProcessing();
    } else {
      // Page visible - resume if enabled
      if (this.isEnabled && this.videoDetector) {
        const activeVideo = this.videoDetector.getActiveVideo();
        if (activeVideo && this.isVideoEligible(activeVideo)) {
          this.startProcessing(activeVideo);
        }
      }
    }
  }

  /**
   * Resume audio context if needed (user interaction required)
   */
  async resumeAudioContextIfNeeded() {
    if (this.audioCapture) {
      await this.audioCapture.resumeAudioContext();
    }
  }

  /**
   * Get current status
   * @returns {Object}
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      hasVideo: !!this.currentVideo,
      isCapturingAudio: this.audioCapture ? this.audioCapture.isActive() : false,
      hasSubtitles: this.subtitleOverlay ? this.subtitleOverlay.isVisible() : false,
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopProcessing();
    
    if (this.videoDetector) {
      this.videoDetector.destroy();
    }
    
    if (this.audioCapture) {
      this.audioCapture.destroy();
    }
    
    if (this.subtitleOverlay) {
      this.subtitleOverlay.destroy();
    }
    
    this.isEnabled = false;
  }
}

// Initialize controller when page loads
let liveSubtitlesController = null;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeController);
} else {
  initializeController();
}

function initializeController() {
  // Small delay to ensure all resources are loaded
  setTimeout(() => {
    liveSubtitlesController = new LiveSubtitlesController();
  }, 1000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (liveSubtitlesController) {
    liveSubtitlesController.destroy();
  }
});

// Make controller available globally for debugging
if (typeof window !== 'undefined') {
  window.LiveSubtitlesController = LiveSubtitlesController;
  window.liveSubtitlesController = liveSubtitlesController;
}