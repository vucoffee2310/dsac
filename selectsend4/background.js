// background.js

const injectedTabs = new Set();
const playingTabs = new Set();
const popupConnections = new Set(); // Also used for monitor connections

const notifyPopups = () => {
  const update = { tabIds: [...injectedTabs], playingTabs: [...playingTabs] };
  popupConnections.forEach(port => {
    try {
      port.postMessage(update);
    } catch {
      popupConnections.delete(port);
    }
  });
};

// Handle messages from content scripts or monitor page
chrome.runtime.onMessage.addListener((req, sender) => {
  const tabId = sender.tab?.id;
  
  if (req.injected && tabId) {
    injectedTabs.add(tabId);
    notifyPopups();
  } else if (req.playTab) {
    playingTabs.clear();
    playingTabs.add(req.playTab);
    chrome.tabs.sendMessage(req.playTab, { play: true });
    notifyPopups();
  } else if (req.playAll) {
    playingTabs.clear();
    injectedTabs.forEach(id => {
      playingTabs.add(id);
      chrome.tabs.sendMessage(id, { play: true });
    });
    notifyPopups();
  }
});

// Clean up when tabs are closed or reloaded
chrome.tabs.onRemoved.addListener(tabId => {
  if (injectedTabs.delete(tabId) || playingTabs.delete(tabId)) {
    notifyPopups();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && playingTabs.delete(tabId)) {
    notifyPopups();
  }
});

// Handle connection from popup or monitor page
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'popup' || port.name === 'monitor') {
    popupConnections.add(port);
    port.postMessage({ tabIds: [...injectedTabs], playingTabs: [...playingTabs] });
    port.onDisconnect.addListener(() => popupConnections.delete(port));
  }
});

// Open monitor.html when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('monitor.html') });
});