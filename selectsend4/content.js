(() => {
  if (window.__A__) return;
  window.__A__ = 1;
  chrome.runtime.sendMessage({ injected: 1 });

  let ctx, src;
  chrome.runtime.onMessage.addListener(async m => {
    if (m.play) {
      if (!ctx) {
        ctx = new AudioContext();
        const b = ctx.createBuffer(1, 44100, 44100);
        const d = b.getChannelData(0);
        for (let i = 0; i < 44100; i++) d[i] = Math.sin(i * 0.142) * 0.0005;
        ctx.b = b;
      }
      src?.stop();
      ctx.state === 'suspended' && await ctx.resume();
      src = ctx.createBufferSource();
      src.buffer = ctx.b;
      src.loop = 1;
      src.connect(ctx.destination);
      src.start();
    } else if (m.stop) src?.stop();
  });
})();