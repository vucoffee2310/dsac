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

// --- REVISED: More efficient state notification ---
// Directly uses the tabState object instead of messaging itself.
function notifyProcessorTabs() {
  const currentState = {
    openTabIds: [...tabState.openTabIds],
    closedTabs: [...tabState.closedTabs],
    createdTabs: [...tabState.createdTabs]
  };

  for (let tabId of processorTabs) {
    chrome.tabs.sendMessage(tabId, {
      action: "updateTabState",
      payload: currentState
    }).catch((error) => {
      console.warn(`Could not send message to tab ${tabId}, removing. Error: ${error.message}`);
      processorTabs.delete(tabId);
    });
  }
}

// --- INITIALIZATION ---
// Get initial state of tabs when the extension starts
chrome.tabs.query({}, tabs => {
  tabs.forEach(tab => {
    if (isAllowedUrl(tab.url)) {
      tabState.openTabIds.add(tab.id);
    }
    if (tab.url?.includes('processor.html')) {
      processorTabs.add(tab.id);
    }
  });
});

// --- EVENT LISTENERS ---

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Logic to track when our processor.html UI tab is open
  if (changeInfo.status === 'complete' && tab.url?.includes('processor.html')) {
    processorTabs.add(tabId);
  }

  // --- REVISED: Fixed bug to get complete tab info ---
  // Added the 'tab' parameter to get the title and full URL.
  if (changeInfo.url && isAllowedUrl(tab.url) && !tabState.openTabIds.has(tabId)) {
    tabState.openTabIds.add(tabId);
    tabState.createdTabs.push({
      id: tabId,
      url: tab.url,
      title: tab.title,
      timestamp: Date.now()
    });
    notifyProcessorTabs();
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  // Stop tracking closed processor tabs
  if (processorTabs.has(tabId)) {
    processorTabs.delete(tabId);
  }

  // Update state for closed aistudio tabs
  if (tabState.openTabIds.has(tabId)) {
    tabState.openTabIds.delete(tabId);
    tabState.closedTabs.push({ id: tabId, timestamp: Date.now() });
    notifyProcessorTabs();
  }
});

// --- MESSAGE HANDLING ---
// Listens for requests from the monitor UI (e.g., on initial load)
chrome.runtime.onMessage.addListener((req, _, sendResponse) => {
  if (req.action === "getTabState") {
    sendResponse({
      openTabIds: [...tabState.openTabIds],
      closedTabs: [...tabState.closedTabs],
      createdTabs: [...tabState.createdTabs]
    });
  }
  return true; // Required for async sendResponse
});

// --- EXTENSION ACTION ---
// Open the processor UI when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});