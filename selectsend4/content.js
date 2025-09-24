(() => {
  if (window.__AUDIO_INJECTED__) return;
  window.__AUDIO_INJECTED__ = true;
  chrome.runtime.sendMessage({ injected: true });

  let audioContext, source;

  chrome.runtime.onMessage.addListener(async msg => {
    if (msg.play) {
      if (!audioContext) {
        audioContext = new AudioContext();
        const buffer = audioContext.createBuffer(1, 44100, 44100);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < 44100; i++) data[i] = Math.sin(i * 0.142) * 0.0005;
        audioContext.audioBuffer = buffer;
      }
      
      source?.stop();
      if (audioContext.state === 'suspended') await audioContext.resume();
      source = audioContext.createBufferSource();
      source.buffer = audioContext.audioBuffer;
      source.loop = true;
      source.connect(audioContext.destination);
      source.start();
    } else if (msg.stop) {
      source?.stop();
    }
  });
})();