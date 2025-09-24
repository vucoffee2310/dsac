// content.js (add stop handling)
(() => {
  if (window.__AUDIO_INJECTED__) return;
  window.__AUDIO_INJECTED__ = true;

  chrome.runtime.sendMessage({ injected: true });

  let audioContext = null;
  let audioBuffer = null;
  let source = null;

  const prepareAudio = () => {
    if (audioContext) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioContext = new Ctx();
    audioBuffer = audioContext.createBuffer(1, 44100, 44100);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < 44100; i++) {
      channel[i] = Math.sin(i * 0.142) * 0.0005;
    }
  };

  const play = async () => {
    prepareAudio();
    if (source) source.stop();
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => {});
    }

    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;
    source.connect(audioContext.destination);
    source.start();
  };

  const stop = () => {
    if (source) {
      source.stop();
      source = null;
    }
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.play) play();
    if (msg.stop) stop(); // 👈 Handle stop
  });
})();