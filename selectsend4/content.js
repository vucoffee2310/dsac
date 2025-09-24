(() => {
  if (window.__AUDIO_INJECTED__) return;
  window.__AUDIO_INJECTED__ = true;
  chrome.runtime.sendMessage({ injected: true });

  let audioContext, audioBuffer, source;

  const initAudio = () => {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioBuffer = audioContext.createBuffer(1, 44100, 44100);
    const data = audioBuffer.getChannelData(0);
    for (let i = 0; i < 44100; i++) data[i] = Math.sin(i * 0.142) * 0.0005;
  };

  chrome.runtime.onMessage.addListener(async msg => {
    if (msg.play) {
      initAudio();
      source?.stop();
      if (audioContext.state === 'suspended') await audioContext.resume().catch(() => {});
      source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(audioContext.destination);
      source.start();
    } else if (msg.stop) {
      source?.stop();
      source = null;
    }
  });
})();