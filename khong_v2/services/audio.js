(() => {
  if (window.__AUDIO_INJECTOR_LOADED__) return;
  window.__AUDIO_INJECTOR_LOADED__ = true;
  let ctx, src;
  const buf = (c) => {
    const b = c.createBuffer(1, 44100, 44100);
    const d = b.getChannelData(0);
    for (let i = 0; i < 44100; i++) d[i] = Math.sin(i * 0.142) * 0.0005;
    return b;
  };
  chrome.runtime.onMessage.addListener(m => {
    if (m.play) {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (src) src.stop();
      if (ctx.state === 'suspended') ctx.resume().catch(console.warn);
      src = ctx.createBufferSource();
      src.buffer = buf(ctx);
      src.loop = true;
      src.connect(ctx.destination);
      src.start();
    } else if (m.stop && src) { src.stop(); src = null; }
  });
})();