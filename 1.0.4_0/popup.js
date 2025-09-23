var port = chrome.runtime.connect();
port.postMessage({action: 'start'});

var slide = document.getElementById('slide');
var button = document.getElementById('button');
const DEFAULT_VOLUME = 2;

// Retrieve the saved volume value when popup opens
chrome.storage.local.get('volumeLevel', function(data) {
  if (data.volumeLevel !== undefined) {
    slide.value = data.volumeLevel;
    // Update the volume in the background
    chrome.runtime.sendMessage({
      type: 'change-vol',
      target: 'offscreen',
      data: data.volumeLevel
    });
  } else {
    // Use default value if nothing is saved
    slide.value = DEFAULT_VOLUME;
  }
});

slide.onchange = function() {
  // Save the volume value when changed
  chrome.storage.local.set({'volumeLevel': this.value});
  
  chrome.runtime.sendMessage({
    type: 'change-vol',
    target: 'offscreen',
    data: this.value
  });
}

button.onclick = function() {
  // Reset volume to default when turning off
  chrome.storage.local.set({'volumeLevel': DEFAULT_VOLUME});
  
  chrome.runtime.sendMessage({
    type: 'stop-streaming',
    target: 'offscreen'
  });
  
  window.close();
}