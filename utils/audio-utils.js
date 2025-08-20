// Audio processing utilities for the Live Subtitles extension
class AudioUtils {
  /**
   * Create an audio context with proper configuration
   */
  static createAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    return new AudioContext({
      sampleRate: CONSTANTS.AUDIO.SAMPLE_RATE
    });
  }

  /**
   * Get audio stream from a video element
   * @param {HTMLVideoElement} videoElement 
   * @returns {MediaStream|null}
   */
  static getAudioStreamFromVideo(videoElement) {
    try {
      if (!videoElement || !videoElement.captureStream) {
        console.warn('Video element does not support stream capture');
        return null;
      }

      const stream = videoElement.captureStream();
      const audioTracks = stream.getAudioTracks();
      
      if (audioTracks.length === 0) {
        console.warn('No audio tracks found in video stream');
        return null;
      }

      // Create a new stream with only audio tracks
      const audioStream = new MediaStream();
      audioTracks.forEach(track => audioStream.addTrack(track));
      
      return audioStream;
    } catch (error) {
      console.error('Failed to capture audio stream from video:', error);
      return null;
    }
  }

  /**
   * Create a MediaRecorder for audio streaming
   * @param {MediaStream} stream 
   * @param {Function} onDataAvailable 
   * @returns {MediaRecorder|null}
   */
  static createMediaRecorder(stream, onDataAvailable) {
    try {
      const options = {
        mimeType: CONSTANTS.AUDIO.MIME_TYPE
      };

      // Fallback to other formats if webm is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          options.mimeType = 'audio/wav';
        } else {
          console.warn('No supported audio format found, using default');
          delete options.mimeType;
        }
      }

      const recorder = new MediaRecorder(stream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          onDataAvailable(event.data, options.mimeType || 'audio/webm');
        }
      };

      recorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
      };

      return recorder;
    } catch (error) {
      console.error('Failed to create MediaRecorder:', error);
      return null;
    }
  }

  /**
   * Convert audio blob to base64 for API transmission
   * @param {Blob} audioBlob 
   * @returns {Promise<string>}
   */
  static async blobToBase64(audioBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  /**
   * Check if audio processing is supported in the current browser
   * @returns {boolean}
   */
  static isAudioProcessingSupported() {
    return !!(
      window.MediaRecorder &&
      window.AudioContext &&
      HTMLVideoElement.prototype.captureStream
    );
  }

  /**
   * Get optimal chunk size based on available bandwidth and API requirements
   * @returns {number} Chunk duration in milliseconds
   */
  static getOptimalChunkSize() {
    // For now, return the default chunk duration
    // Could be enhanced to dynamically adjust based on network conditions
    return CONSTANTS.AUDIO.CHUNK_DURATION;
  }

  /**
   * Process audio with noise reduction (basic implementation)
   * @param {AudioContext} audioContext 
   * @param {MediaStream} stream 
   * @returns {MediaStreamAudioDestinationNode}
   */
  static processAudioStream(audioContext, stream) {
    try {
      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();
      
      // Basic gain control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      
      // Connect the nodes
      source.connect(gainNode);
      gainNode.connect(destination);
      
      return destination;
    } catch (error) {
      console.error('Failed to process audio stream:', error);
      return null;
    }
  }

  /**
   * Validate audio data before sending to API
   * @param {Blob} audioBlob 
   * @returns {boolean}
   */
  static validateAudioData(audioBlob) {
    if (!audioBlob || audioBlob.size === 0) {
      return false;
    }

    // Check minimum size (at least 1KB for meaningful audio)
    if (audioBlob.size < 1024) {
      return false;
    }

    // Check maximum size (to avoid API limits, typically 25MB for Whisper)
    if (audioBlob.size > 25 * 1024 * 1024) {
      console.warn('Audio chunk too large:', audioBlob.size);
      return false;
    }

    return true;
  }
}

// Make AudioUtils available globally
if (typeof window !== 'undefined') {
  window.AudioUtils = AudioUtils;
}