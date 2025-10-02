(() => {
  if (window.__AUDIO_INJECTOR_LOADED__) return;
  window.__AUDIO_INJECTOR_LOADED__ = true;

  let audioContext, oscillator;

  // Constants for the sound, calculated from your original formula
  const FREQUENCY = (0.142 * 44100) / (2 * Math.PI); // ~996.67 Hz
  const GAIN = 0.0005; // The volume

  chrome.runtime.onMessage.addListener(message => {
    if (message.play) {
      // Lazily create the AudioContext
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Stop any sound that is currently playing
      if (oscillator) {
        oscillator.stop();
      }

      // Ensure the context is running (handles browser autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(console.warn);
      }

      // Create the audio graph: Oscillator -> Gain -> Output
      oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Configure the sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(FREQUENCY, audioContext.currentTime);
      gainNode.gain.setValueAtTime(GAIN, audioContext.currentTime);

      // Connect the nodes and start the sound
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();

    } else if (message.stop && oscillator) {
      oscillator.stop();
      oscillator = null; // Allow the node to be garbage collected
    }
  });
})();