// Subtitle overlay system for displaying live captions
class SubtitleOverlay {
  constructor() {
    this.container = null;
    this.currentSubtitle = null;
    this.translationSubtitle = null;
    this.subtitleQueue = [];
    this.settings = null;
    this.fadeTimeout = null;
    this.init();
  }

  /**
   * Initialize the subtitle overlay system
   */
  async init() {
    await this.loadSettings();
    this.createContainer();
    this.setupEventListeners();
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      this.settings = await StorageManager.getAllSettings();
    } catch (error) {
      console.error('Failed to load subtitle settings:', error);
      this.settings = CONSTANTS.DEFAULTS;
    }
  }

  /**
   * Create the main subtitle container
   */
  createContainer() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'live-subtitles-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
      font-family: ${this.settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_STYLE].fontFamily};
    `;

    document.body.appendChild(this.container);
  }

  /**
   * Setup event listeners for subtitle events
   */
  setupEventListeners() {
    // Listen for subtitle text events
    document.addEventListener(CONSTANTS.EVENTS.SUBTITLE_RECEIVED, (event) => {
      this.displaySubtitle(event.detail.text, false);
    });

    // Listen for translation events
    document.addEventListener(CONSTANTS.EVENTS.TRANSLATION_RECEIVED, (event) => {
      this.displaySubtitle(event.detail.text, true);
    });

    // Listen for settings updates
    document.addEventListener(CONSTANTS.EVENTS.SETTINGS_UPDATED, () => {
      this.loadSettings();
      this.updateSubtitleStyle();
    });

    // Listen for storage changes
    if (typeof StorageManager !== 'undefined') {
      StorageManager.onSettingsChanged(() => {
        this.loadSettings();
        this.updateSubtitleStyle();
      });
    }
  }

  /**
   * Display a subtitle with optional translation
   * @param {string} text 
   * @param {boolean} isTranslation 
   */
  displaySubtitle(text, isTranslation = false) {
    if (!text || !this.container) return;

    // Clear existing fade timeout
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }

    if (isTranslation && this.settings[CONSTANTS.STORAGE_KEYS.TRANSLATION_ENABLED]) {
      this.showDualSubtitles(this.currentSubtitle?.textContent || '', text);
    } else if (!isTranslation) {
      this.showSingleSubtitle(text);
    }

    // Auto-hide subtitle after display time
    this.fadeTimeout = setTimeout(() => {
      this.fadeOutSubtitle();
    }, CONSTANTS.SUBTITLES.MAX_DISPLAY_TIME);
  }

  /**
   * Show a single subtitle
   * @param {string} text 
   */
  showSingleSubtitle(text) {
    // Remove existing subtitles
    this.clearSubtitles();

    // Create subtitle element
    this.currentSubtitle = this.createSubtitleElement(text);
    this.container.appendChild(this.currentSubtitle);

    // Trigger fade-in animation
    requestAnimationFrame(() => {
      this.currentSubtitle.classList.add('fade-in');
    });
  }

  /**
   * Show dual subtitles (original + translation)
   * @param {string} originalText 
   * @param {string} translationText 
   */
  showDualSubtitles(originalText, translationText) {
    this.clearSubtitles();

    // Create dual subtitle container
    const dualContainer = this.createSubtitleElement('');
    dualContainer.classList.add('dual-subtitles');

    // Original subtitle
    const originalElement = document.createElement('span');
    originalElement.className = 'live-subtitles-original';
    originalElement.textContent = originalText;

    // Translation subtitle
    const translationElement = document.createElement('span');
    translationElement.className = 'live-subtitles-translation';
    translationElement.textContent = translationText;

    dualContainer.appendChild(originalElement);
    dualContainer.appendChild(translationElement);

    this.currentSubtitle = dualContainer;
    this.container.appendChild(this.currentSubtitle);

    // Trigger fade-in animation
    requestAnimationFrame(() => {
      this.currentSubtitle.classList.add('fade-in');
    });
  }

  /**
   * Create a subtitle element with proper styling
   * @param {string} text 
   * @returns {HTMLElement}
   */
  createSubtitleElement(text) {
    const element = document.createElement('div');
    element.className = 'live-subtitles-overlay';
    element.textContent = text;

    // Apply position class
    const position = this.settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_POSITION];
    element.classList.add(`position-${position}`);

    // Apply style settings
    this.applySubtitleStyle(element);

    return element;
  }

  /**
   * Apply styling to a subtitle element
   * @param {HTMLElement} element 
   */
  applySubtitleStyle(element) {
    const style = this.settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_STYLE];
    
    Object.assign(element.style, {
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      padding: style.padding,
      maxWidth: style.maxWidth
    });
  }

  /**
   * Update subtitle styling for existing elements
   */
  updateSubtitleStyle() {
    if (this.currentSubtitle) {
      this.applySubtitleStyle(this.currentSubtitle);
      
      // Update position class
      const position = this.settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_POSITION];
      this.currentSubtitle.className = this.currentSubtitle.className
        .replace(/position-\w+/, `position-${position}`);
    }
  }

  /**
   * Fade out current subtitle
   */
  fadeOutSubtitle() {
    if (this.currentSubtitle) {
      this.currentSubtitle.classList.remove('fade-in');
      this.currentSubtitle.classList.add('fade-out');

      setTimeout(() => {
        this.clearSubtitles();
      }, CONSTANTS.SUBTITLES.FADE_DURATION);
    }
  }

  /**
   * Clear all subtitle elements
   */
  clearSubtitles() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.currentSubtitle = null;
    this.translationSubtitle = null;
  }

  /**
   * Show an error message
   * @param {string} message 
   */
  showError(message) {
    this.clearSubtitles();

    const errorElement = this.createSubtitleElement(message);
    errorElement.classList.add('error');
    
    this.currentSubtitle = errorElement;
    this.container.appendChild(this.currentSubtitle);

    requestAnimationFrame(() => {
      this.currentSubtitle.classList.add('fade-in');
    });

    // Auto-hide error after shorter duration
    setTimeout(() => {
      this.fadeOutSubtitle();
    }, 3000);
  }

  /**
   * Show a loading indicator
   */
  showLoading() {
    if (this.currentSubtitle && this.currentSubtitle.classList.contains('loading')) {
      return; // Already showing loading
    }

    this.clearSubtitles();

    const loadingElement = this.createSubtitleElement('Processing audio');
    loadingElement.classList.add('loading');
    
    this.currentSubtitle = loadingElement;
    this.container.appendChild(this.currentSubtitle);

    requestAnimationFrame(() => {
      this.currentSubtitle.classList.add('fade-in');
    });
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    if (this.currentSubtitle && this.currentSubtitle.classList.contains('loading')) {
      this.fadeOutSubtitle();
    }
  }

  /**
   * Check if overlay is currently visible
   * @returns {boolean}
   */
  isVisible() {
    return !!(this.currentSubtitle && this.currentSubtitle.classList.contains('fade-in'));
  }

  /**
   * Set subtitle position
   * @param {string} position - 'top', 'bottom', or 'center'
   */
  setPosition(position) {
    if (this.currentSubtitle) {
      this.currentSubtitle.className = this.currentSubtitle.className
        .replace(/position-\w+/, `position-${position}`);
    }
  }

  /**
   * Set subtitle style
   * @param {Object} styleOptions 
   */
  setStyle(styleOptions) {
    this.settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_STYLE] = {
      ...this.settings[CONSTANTS.STORAGE_KEYS.SUBTITLE_STYLE],
      ...styleOptions
    };
    this.updateSubtitleStyle();
  }

  /**
   * Preview subtitle with sample text
   * @param {string} sampleText 
   */
  showPreview(sampleText = 'Sample subtitle text for preview') {
    this.displaySubtitle(sampleText);
  }

  /**
   * Get current subtitle text
   * @returns {string}
   */
  getCurrentText() {
    return this.currentSubtitle ? this.currentSubtitle.textContent : '';
  }

  /**
   * Check if the overlay container exists
   * @returns {boolean}
   */
  isInitialized() {
    return !!(this.container && document.contains(this.container));
  }

  /**
   * Clean up resources and remove overlay
   */
  destroy() {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }

    this.clearSubtitles();

    if (this.container && document.contains(this.container)) {
      document.body.removeChild(this.container);
    }

    this.container = null;
    this.currentSubtitle = null;
    this.translationSubtitle = null;
    this.subtitleQueue = [];
  }
}

// Make SubtitleOverlay available globally
if (typeof window !== 'undefined') {
  window.SubtitleOverlay = SubtitleOverlay;
}