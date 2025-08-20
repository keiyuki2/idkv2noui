// Video detector for finding and monitoring video elements
class VideoDetector {
  constructor() {
    this.videos = new Set();
    this.activeVideo = null;
    this.observer = null;
    this.eventHandlers = new Map();
    this.init();
  }

  /**
   * Initialize the video detector
   */
  init() {
    this.setupMutationObserver();
    this.detectExistingVideos();
    this.startMonitoring();
  }

  /**
   * Set up mutation observer to detect new video elements
   */
  setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForVideos(node);
            }
          });
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Detect existing video elements on the page
   */
  detectExistingVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => this.addVideo(video));
  }

  /**
   * Check a DOM node and its children for video elements
   * @param {Element} node 
   */
  checkForVideos(node) {
    if (node.tagName === 'VIDEO') {
      this.addVideo(node);
    }
    
    const videos = node.querySelectorAll('video');
    videos.forEach(video => this.addVideo(video));
  }

  /**
   * Add a video element to monitoring
   * @param {HTMLVideoElement} video 
   */
  addVideo(video) {
    if (this.videos.has(video)) return;

    this.videos.add(video);
    this.attachVideoEventListeners(video);
    
    // Check if this video should become the active one
    if (this.shouldBecomeActiveVideo(video)) {
      this.setActiveVideo(video);
    }
  }

  /**
   * Remove a video element from monitoring
   * @param {HTMLVideoElement} video 
   */
  removeVideo(video) {
    if (!this.videos.has(video)) return;

    this.videos.delete(video);
    this.detachVideoEventListeners(video);
    
    if (this.activeVideo === video) {
      this.activeVideo = null;
      this.findNewActiveVideo();
    }
  }

  /**
   * Attach event listeners to a video element
   * @param {HTMLVideoElement} video 
   */
  attachVideoEventListeners(video) {
    const handlers = {
      play: () => this.onVideoPlay(video),
      pause: () => this.onVideoPause(video),
      seeking: () => this.onVideoSeeking(video),
      timeupdate: () => this.onVideoTimeUpdate(video),
      volumechange: () => this.onVideoVolumeChange(video),
      ended: () => this.onVideoEnded(video),
      error: () => this.onVideoError(video)
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });

    this.eventHandlers.set(video, handlers);
  }

  /**
   * Detach event listeners from a video element
   * @param {HTMLVideoElement} video 
   */
  detachVideoEventListeners(video) {
    const handlers = this.eventHandlers.get(video);
    if (!handlers) return;

    Object.entries(handlers).forEach(([event, handler]) => {
      video.removeEventListener(event, handler);
    });

    this.eventHandlers.delete(video);
  }

  /**
   * Determine if a video should become the active video
   * @param {HTMLVideoElement} video 
   * @returns {boolean}
   */
  shouldBecomeActiveVideo(video) {
    // Prioritize playing videos
    if (!video.paused && !video.ended) {
      return true;
    }

    // If no active video, this one becomes active
    if (!this.activeVideo) {
      return true;
    }

    // Check if the current active video is still valid
    if (!this.isVideoVisible(this.activeVideo) || this.activeVideo.paused) {
      return this.isVideoVisible(video);
    }

    return false;
  }

  /**
   * Check if a video element is visible and in viewport
   * @param {HTMLVideoElement} video 
   * @returns {boolean}
   */
  isVideoVisible(video) {
    if (!video || !video.offsetParent) return false;

    const rect = video.getBoundingClientRect();
    const isInViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );

    // Video should be at least partially visible and have reasonable size
    return isInViewport && rect.width > 200 && rect.height > 150;
  }

  /**
   * Set the active video for subtitle processing
   * @param {HTMLVideoElement} video 
   */
  setActiveVideo(video) {
    if (this.activeVideo === video) return;

    this.activeVideo = video;
    this.dispatchEvent(CONSTANTS.EVENTS.VIDEO_DETECTED, {
      video: video,
      hasAudio: this.videoHasAudio(video)
    });
  }

  /**
   * Find a new active video when the current one becomes inactive
   */
  findNewActiveVideo() {
    let bestVideo = null;
    let bestScore = 0;

    this.videos.forEach(video => {
      const score = this.scoreVideo(video);
      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    });

    if (bestVideo) {
      this.setActiveVideo(bestVideo);
    }
  }

  /**
   * Score a video to determine priority for active selection
   * @param {HTMLVideoElement} video 
   * @returns {number}
   */
  scoreVideo(video) {
    let score = 0;

    // Playing videos get highest priority
    if (!video.paused && !video.ended) score += 100;

    // Visible videos get priority
    if (this.isVideoVisible(video)) score += 50;

    // Videos with audio get priority
    if (this.videoHasAudio(video)) score += 30;

    // Larger videos get slight priority
    const rect = video.getBoundingClientRect();
    score += Math.min(rect.width * rect.height / 10000, 20);

    // Videos with duration get priority over live streams for our use case
    if (video.duration && !isNaN(video.duration)) score += 10;

    return score;
  }

  /**
   * Check if a video has audio tracks
   * @param {HTMLVideoElement} video 
   * @returns {boolean}
   */
  videoHasAudio(video) {
    // Check if video has audio tracks
    if (video.audioTracks && video.audioTracks.length > 0) {
      return true;
    }

    // Check if video is muted
    if (video.muted) {
      return false;
    }

    // For most videos, assume audio exists if not explicitly muted
    return true;
  }

  /**
   * Start monitoring for video changes
   */
  startMonitoring() {
    // Check for video changes periodically
    setInterval(() => {
      this.cleanupInvalidVideos();
      if (!this.activeVideo || !this.isVideoVisible(this.activeVideo)) {
        this.findNewActiveVideo();
      }
    }, 5000);
  }

  /**
   * Remove videos that are no longer in the DOM
   */
  cleanupInvalidVideos() {
    this.videos.forEach(video => {
      if (!document.contains(video)) {
        this.removeVideo(video);
      }
    });
  }

  /**
   * Get the currently active video
   * @returns {HTMLVideoElement|null}
   */
  getActiveVideo() {
    return this.activeVideo;
  }

  /**
   * Get all monitored videos
   * @returns {Set<HTMLVideoElement>}
   */
  getAllVideos() {
    return new Set(this.videos);
  }

  // Event handlers
  onVideoPlay(video) {
    if (this.shouldBecomeActiveVideo(video)) {
      this.setActiveVideo(video);
    }
  }

  onVideoPause(video) {
    if (this.activeVideo === video) {
      this.findNewActiveVideo();
    }
  }

  onVideoSeeking(video) {
    if (this.activeVideo === video) {
      this.dispatchEvent(CONSTANTS.EVENTS.VIDEO_DETECTED, {
        video: video,
        action: 'seeking'
      });
    }
  }

  onVideoTimeUpdate(video) {
    // Throttled time update handling could be added here
  }

  onVideoVolumeChange(video) {
    if (this.activeVideo === video) {
      this.dispatchEvent(CONSTANTS.EVENTS.VIDEO_DETECTED, {
        video: video,
        action: 'volumechange',
        muted: video.muted,
        volume: video.volume
      });
    }
  }

  onVideoEnded(video) {
    if (this.activeVideo === video) {
      this.findNewActiveVideo();
    }
  }

  onVideoError(video) {
    console.warn('Video error detected:', video.error);
    this.removeVideo(video);
  }

  /**
   * Dispatch custom events
   * @param {string} eventName 
   * @param {Object} detail 
   */
  dispatchEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.videos.forEach(video => {
      this.detachVideoEventListeners(video);
    });

    this.videos.clear();
    this.eventHandlers.clear();
    this.activeVideo = null;
  }
}

// Make VideoDetector available globally
if (typeof window !== 'undefined') {
  window.VideoDetector = VideoDetector;
}