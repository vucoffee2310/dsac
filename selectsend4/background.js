// background.js
const injectedTabs = new Set();
const playingTabs = new Set(); // 👈 NEW: tracks ALL tabs that should be playing
const popupConnections = new Set();

const notifyPopups = () => {
  const update = {
    tabIds: [...injectedTabs],
    playingTabs: [...playingTabs] // send array of playing tab IDs
  };
  popupConnections.forEach(port => {
    try { port.postMessage(update); }
    catch (e) { popupConnections.delete(port); }
  });
};

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (req.injected && tabId) {
    if (!injectedTabs.has(tabId)) {
      injectedTabs.add(tabId);
      notifyPopups();
    }
    return;
  }

  // ✅ Single tab play: clear all, play one
  if (req.playTab) {
    playingTabs.clear();
    playingTabs.add(req.playTab);
    chrome.tabs.sendMessage(req.playTab, { play: true })
      .catch(() => {
        injectedTabs.delete(req.playTab);
        playingTabs.delete(req.playTab);
        notifyPopups();
      });
    notifyPopups();
    return;
  }

  // ✅ Play ALL: add all injected tabs to playing set
  if (req.playAll) {
    playingTabs.clear();
    const playPromises = [];
    for (const id of injectedTabs) {
      playingTabs.add(id);
      playPromises.push(
        chrome.tabs.sendMessage(id, { play: true })
          .catch(() => {
            injectedTabs.delete(id);
            playingTabs.delete(id);
          })
      );
    }
    Promise.allSettled(playPromises).then(() => notifyPopups());
    notifyPopups(); // immediate UI update
    return;
  }

  return true;
});

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  let changed = false;
  if (injectedTabs.delete(tabId)) changed = true;
  if (playingTabs.delete(tabId)) changed = true;
  if (changed) notifyPopups();
});

// Optional: Stop audio when tab reloads
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && playingTabs.has(tabId)) {
    chrome.tabs.sendMessage(tabId, { stop: true }).catch(() => {});
    playingTabs.delete(tabId);
    notifyPopups();
  }
});

// Popup connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupConnections.add(port);
    port.postMessage({
      tabIds: [...injectedTabs],
      playingTabs: [...playingTabs]
    });
    port.onDisconnect.addListener(() => popupConnections.delete(port));
  }
});