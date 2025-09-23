chrome.tabCapture.getMediaStreamId({
    targetTabId: +new URLSearchParams(location.search).get("tabId")
}, async (id) => {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: id }}
    });
});