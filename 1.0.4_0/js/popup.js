chrome.tabCapture.getMediaStreamId({
    targetTabId: +new URLSearchParams(location.search).get("tabId")
}, async (id) => {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: id }}
    });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    src.connect(gain).connect(ctx.destination);
    document.getElementById("volume-range").oninput = e => gain.gain.value = e.target.value / 100;
});