// FILE: selectedsend3/background.js

// --- REVISED: Simplified State ---
// We only need to track created tabs and which UI tabs are open.
const tabState = {
  createdTabs: []
};
const processorTabs = new Set(); // Tracks open processor.html tabs

function isAllowedUrl(url) {
  return url?.startsWith("https://aistudio.google.com/");
}

// --- REVISED: More efficient state notification ---
// Sends only the 'createdTabs' state.
function notifyProcessorTabs() {
  const currentState = {
    createdTabs: [...tabState.createdTabs]
  };

  for (let tabId of processorTabs) {
    chrome.tabs.sendMessage(tabId, {
      action: "updateTabState",
      payload: currentState
    }).catch((error) => {
      console.warn(`Could not send message to tab ${tabId}, removing. Error: ${error.message}`);
      processorTabs.delete(tabId); // Clean up if a tab is closed/unreachable
    });
  }
}

// --- INITIALIZATION (Simplified) ---
// Find any processor.html tabs that are already open on startup.
chrome.tabs.query({ url: `*://*/processor.html` }, tabs => {
  tabs.forEach(tab => processorTabs.add(tab.id));
});

// --- EVENT LISTENERS (Simplified) ---

// Track newly created AI Studio tabs
chrome.tabs.onCreated.addListener(tab => {
  if (isAllowedUrl(tab.url)) {
    tabState.createdTabs.push({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      timestamp: Date.now()
    });
    notifyProcessorTabs();
  }
});

// Track when a user navigates an existing tab to AI Studio
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Logic to track when our processor.html UI tab is open
  if (changeInfo.status === 'complete' && tab.url?.includes('processor.html')) {
    processorTabs.add(tabId);
    return; // No further action needed for this tab
  }

  // Check if an existing tab navigated to our target URL
  const isAlreadyTracked = tabState.createdTabs.some(t => t.id === tabId);
  if (changeInfo.url && isAllowedUrl(tab.url) && !isAlreadyTracked) {
    tabState.createdTabs.push({
      id: tabId,
      url: tab.url,
      title: tab.title,
      timestamp: Date.now()
    });
    notifyProcessorTabs();
  }
});

// Stop tracking closed processor.html tabs
chrome.tabs.onRemoved.addListener(tabId => {
  if (processorTabs.has(tabId)) {
    processorTabs.delete(tabId);
  }
});

// --- MESSAGE HANDLING (Simplified) ---
chrome.runtime.onMessage.addListener((req, _, sendResponse) => {
  if (req.action === "getTabState") {
    sendResponse({
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