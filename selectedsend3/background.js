// FILE: selectedsend3/background.js

let createdTabs = []; // Simplified state from an object to a direct array
const processorTabs = new Set(); // Tracks open processor.html tab IDs

// Helper to find existing processor tabs on startup or install
function findExistingProcessorTabs() {
  chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error("Error querying processor tabs:", chrome.runtime.lastError.message);
      return;
    }
    tabs?.forEach(tab => processorTabs.add(tab.id));
  });
}

// Broadcasts the current state to all active processor UIs
function notifyProcessorTabs() {
  const payload = { createdTabs: [...createdTabs] };
  for (const tabId of processorTabs) {
    chrome.tabs.sendMessage(tabId, { action: "updateTabState", payload })
      .catch(() => processorTabs.delete(tabId)); // Clean up unreachable tabs
  }
}

// --- EVENT LISTENERS ---

// Populate processorTabs on extension startup and installation
chrome.runtime.onStartup.addListener(findExistingProcessorTabs);
chrome.runtime.onInstalled.addListener(findExistingProcessorTabs);

// Add new processor tabs to the set and send them the current state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('processor.html')) {
    processorTabs.add(tabId);
    notifyProcessorTabs();
  }
});

// Clean up closed tabs from state and tracking sets
chrome.tabs.onRemoved.addListener(tabId => {
  processorTabs.delete(tabId); // Remove if it was a processor tab

  // More efficient check and removal for monitored tabs
  const indexToRemove = createdTabs.findIndex(t => t.id === tabId);
  if (indexToRemove > -1) {
    createdTabs.splice(indexToRemove, 1);
    notifyProcessorTabs();
  }
});

// --- MESSAGE HANDLING ---
chrome.runtime.onMessage.addListener((req, _, sendResponse) => {
  switch (req.action) {
    case "getTabState":
      sendResponse({ createdTabs: [...createdTabs] });
      break;
    case "logTabCreation":
      if (!createdTabs.some(t => t.id === req.payload.id)) {
        createdTabs.push(req.payload);
        notifyProcessorTabs();
      }
      break;
  }
  return true; // Required for async sendResponse
});

// Open processor UI when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});