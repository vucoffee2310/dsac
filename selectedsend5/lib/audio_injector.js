// FILE: selectedsend3/lib/audio_injector.js
(() => {
  if (window.__AUDIO_INJECTOR_LOADED__) return;
  window.__AUDIO_INJECTOR_LOADED__ = true;

  let audioContext, audioSource;

  const createSilentBuffer = (ctx) => {
    const buffer = ctx.createBuffer(1, 44100, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < 44100; i++) {
      data[i] = Math.sin(i * 0.142) * 0.0005;
    }
    return buffer;
  };

  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.play) {
      if (!audioContext) audioContext = new AudioContext();
      if (audioSource) audioSource.stop();
      if (audioContext.state === 'suspended') await audioContext.resume();
      
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = createSilentBuffer(audioContext);
      audioSource.loop = true;
      audioSource.connect(audioContext.destination);
      audioSource.start();
    } else if (message.stop) {
      if (audioSource) {
        audioSource.stop();
        audioSource = null;
      }
    }
    return true;
  });
})();