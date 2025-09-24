const audioPlayer = document.getElementById('audioPlayer');
const statusEl = document.getElementById('status');
const tabInfoEl = document.getElementById('tabInfo');

const urlParams = new URLSearchParams(location.search);
const tabId = +urlParams.get("tabId");
const tabTitle = decodeURIComponent(urlParams.get("title") || "Unknown Tab");

// Update tab info in UI
tabInfoEl.textContent = `Tab: ${tabTitle.slice(0, 20)}${tabTitle.length > 20 ? '...' : ''}`;

// Update status function
const updateStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#e74c3c' : '#666';
};

// Stop sharing by closing the popup window
document.getElementById('stopBtn').addEventListener('click', () => {
  updateStatus('Stopping...');
  window.close();
});

// Close the popup if the target tab is closed
chrome.tabs.onRemoved.addListener(id => {
  if (id === tabId) {
    window.close();
  }
});

// Main capture logic
updateStatus('Starting audio capture...');

chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
  if (!streamId) {
    const error = chrome.runtime.lastError?.message || 'Failed to get stream ID';
    console.error('Audio capture error:', error);
    updateStatus(`Failed: ${error}`, true);
    return;
  }

  updateStatus('Requesting audio access...');

  navigator.mediaDevices.getUserMedia({
    audio: { 
      mandatory: { 
        chromeMediaSource: 'tab', 
        chromeMediaSourceId: streamId 
      } 
    }
  })
  .then(stream => {
    // Keep the stream alive by attaching it to the audio element
    audioPlayer.srcObject = stream;
    updateStatus('✅ Audio capturing active');
    console.log('✅ Audio capture started for tab', tabId);

    // If user stops sharing via browser UI, close the popup
    // A tab audio stream will only have one track
    stream.getTracks()[0].onended = () => {
      updateStatus('Audio sharing ended');
      setTimeout(() => window.close(), 1000);
    };
  })
  .catch(error => {
    console.error('Failed to capture audio:', error);
    updateStatus('Audio access denied', true);
    setTimeout(() => window.close(), 3000);
  });
});