// Audio capture system for extracting audio from video elements
class AudioCapture {
  constructor() {
    this.isCapturing = false;
    this.audioContext = null;
    this.mediaRecorder = null;
    this.currentStream = null;
    this.audioChunks = [];
    this.chunkCounter = 0;
    this.init();
  }

  /**
   * Initialize the audio capture system
   */
  async init() {
    if (!AudioUtils.isAudioProcessingSupported()) {
      console.error('Audio processing not supported in this browser');
      return false;
    }

    try {
      this.audioContext = AudioUtils.createAudioContext();
      return true;
    } catch (error) {
      console.error('Failed to initialize audio capture:', error);
      return false;
    }
  }

  /**
   * Start capturing audio from a video element
   * @param {HTMLVideoElement} videoElement 
   * @returns {Promise<boolean>}
   */
  async startCapture(videoElement) {
    if (this.isCapturing) {
      await this.stopCapture();
    }

    if (!videoElement) {
      console.error('No video element provided for audio capture');
      return false;
    }

    try {
      // Get audio stream from video
      this.currentStream = AudioUtils.getAudioStreamFromVideo(videoElement);
      if (!this.currentStream) {
        console.error('Failed to get audio stream from video');
        return false;
      }

      // Process the audio stream
      const processedDestination = AudioUtils.processAudioStream(
        this.audioContext, 
        this.currentStream
      );

      if (processedDestination) {
        this.currentStream = processedDestination.stream;
      }

      // Create media recorder
      this.mediaRecorder = AudioUtils.createMediaRecorder(
        this.currentStream,
        (audioBlob, mimeType) => this.handleAudioChunk(audioBlob, mimeType)
      );

      if (!this.mediaRecorder) {
        console.error('Failed to create MediaRecorder');
        return false;
      }

      // Start recording in chunks
      this.startChunkedRecording();
      this.isCapturing = true;

      console.log('Audio capture started successfully');
      return true;

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      await this.stopCapture();
      return false;
    }
  }

  /**
   * Stop audio capture
   * @returns {Promise<void>}
   */
  async stopCapture() {
    this.isCapturing = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }

    this.audioChunks = [];
    this.mediaRecorder = null;

    console.log('Audio capture stopped');
  }

  /**
   * Start recording in chunks for continuous processing
   */
  startChunkedRecording() {
    if (!this.mediaRecorder || !this.isCapturing) return;

    try {
      this.mediaRecorder.start();
      
      // Stop and restart recording after chunk duration
      setTimeout(() => {
        if (this.isCapturing && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          
          // Start next chunk after a brief pause
          setTimeout(() => {
            if (this.isCapturing) {
              this.startChunkedRecording();
            }
          }, 100);
        }
      }, AudioUtils.getOptimalChunkSize());

    } catch (error) {
      console.error('Failed to start chunked recording:', error);
    }
  }

  /**
   * Handle audio chunk data
   * @param {Blob} audioBlob 
   * @param {string} mimeType 
   */
  async handleAudioChunk(audioBlob, mimeType) {
    if (!AudioUtils.validateAudioData(audioBlob)) {
      console.warn('Invalid audio chunk received');
      return;
    }

    try {
      this.chunkCounter++;
      
      const chunkData = {
        id: this.chunkCounter,
        blob: audioBlob,
        mimeType: mimeType,
        timestamp: Date.now(),
        size: audioBlob.size
      };

      // Dispatch event with audio chunk
      this.dispatchAudioChunk(chunkData);

    } catch (error) {
      console.error('Failed to process audio chunk:', error);
    }
  }

  /**
   * Dispatch audio chunk event
   * @param {Object} chunkData 
   */
  dispatchAudioChunk(chunkData) {
    const event = new CustomEvent(CONSTANTS.EVENTS.AUDIO_CHUNK_READY, {
      detail: chunkData
    });
    document.dispatchEvent(event);
  }

  /**
   * Get current capture status
   * @returns {Object}
   */
  getStatus() {
    return {
      isCapturing: this.isCapturing,
      hasAudioContext: !!this.audioContext,
      hasMediaRecorder: !!this.mediaRecorder,
      hasStream: !!this.currentStream,
      chunkCount: this.chunkCounter
    };
  }

  /**
   * Check if audio capture is currently active
   * @returns {boolean}
   */
  isActive() {
    return this.isCapturing && 
           this.mediaRecorder && 
           this.mediaRecorder.state === 'recording';
  }

  /**
   * Resume audio context if suspended (required by some browsers)
   * @returns {Promise<void>}
   */
  async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('Audio context resumed');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
  }

  /**
   * Get audio capture capabilities
   * @returns {Object}
   */
  static getCapabilities() {
    return {
      isSupported: AudioUtils.isAudioProcessingSupported(),
      supportedMimeTypes: [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ].filter(type => MediaRecorder.isTypeSupported(type)),
      maxChannels: 2,
      sampleRates: [16000, 22050, 44100, 48000]
    };
  }

  /**
   * Test audio capture functionality
   * @returns {Promise<Object>}
   */
  static async testCapture() {
    const testResults = {
      supported: false,
      audioContext: false,
      mediaRecorder: false,
      streamCapture: false,
      errors: []
    };

    try {
      // Test audio context
      const audioContext = AudioUtils.createAudioContext();
      testResults.audioContext = true;
      audioContext.close();

      // Test media recorder
      const stream = new MediaStream();
      try {
        const recorder = new MediaRecorder(stream);
        testResults.mediaRecorder = true;
        recorder.stop();
      } catch (error) {
        testResults.errors.push('MediaRecorder test failed: ' + error.message);
      }

      // Test stream capture support
      testResults.streamCapture = typeof HTMLVideoElement.prototype.captureStream === 'function';
      if (!testResults.streamCapture) {
        testResults.errors.push('Video stream capture not supported');
      }

      testResults.supported = testResults.audioContext && 
                             testResults.mediaRecorder && 
                             testResults.streamCapture;

    } catch (error) {
      testResults.errors.push('Audio capture test failed: ' + error.message);
    }

    return testResults;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopCapture();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioContext = null;
    this.audioChunks = [];
  }
}

// Make AudioCapture available globally
if (typeof window !== 'undefined') {
  window.AudioCapture = AudioCapture;
}