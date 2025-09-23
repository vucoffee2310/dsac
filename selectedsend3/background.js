const tabState = {
  openTabIds: new Set(),
  closedTabs: [],
  createdTabs: []
};

// Track open processor.html tabs
const processorTabs = new Set();

function isAllowedUrl(url) {
  return url?.startsWith("https://aistudio.google.com/");
}

// Detect when processor.html is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('chrome-extension://') && tab.url.includes('processor.html')) {
    processorTabs.add(tabId);
  }
});

// Detect when processor.html is closed
chrome.tabs.onRemoved.addListener(tabId => {
  if (processorTabs.has(tabId)) {
    processorTabs.delete(tabId);
  }
});

function notifyProcessorTabs() {
  chrome.runtime.sendMessage({ action: "getTabState" }, currentState => {
    if (chrome.runtime.lastError) return;

    for (let tabId of processorTabs) {
      chrome.tabs.sendMessage(tabId, {
        action: "updateTabState",
        payload: currentState
      }).catch(() => {
        processorTabs.delete(tabId);
      });
    }
  });
}

// Initialize with existing tabs
chrome.tabs.query({}, tabs => {
  tabs.forEach(tab => {
    if (isAllowedUrl(tab.url)) tabState.openTabIds.add(tab.id);
    if (tab.url?.includes('processor.html')) processorTabs.add(tab.id);
  });
});

chrome.tabs.onCreated.addListener(tab => {
  if (isAllowedUrl(tab.url)) {
    tabState.openTabIds.add(tab.id);
    tabState.createdTabs.push({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      timestamp: Date.now()
    });
    notifyProcessorTabs();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && isAllowedUrl(changeInfo.url) && !tabState.openTabIds.has(tabId)) {
    tabState.openTabIds.add(tabId);
    tabState.createdTabs.push({
      id: tabId,
      url: changeInfo.url,
      timestamp: Date.now()
    });
    notifyProcessorTabs();
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  if (tabState.openTabIds.has(tabId)) {
    tabState.openTabIds.delete(tabId);
    tabState.closedTabs.push({ id: tabId, timestamp: Date.now() });
    notifyProcessorTabs();
  }
});

chrome.runtime.onMessage.addListener((req, _, send) => {
  if (req.action === "getTabState") {
    send({
      openTabIds: [...tabState.openTabIds],
      closedTabs: [...tabState.closedTabs],
      createdTabs: [...tabState.createdTabs]
    });
  }
  return true;
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});