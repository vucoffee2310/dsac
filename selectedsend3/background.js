// FILE: selectedsend3/background.js

// --- REVISED: State now holds richer objects ---
const tabState = {
  createdTabs: [] // Will contain {id, url, title, timestamp, cardName, cardContent}
};
const processorTabs = new Set(); // Tracks open processor.html tabs

// --- HELPER FUNCTION FOR TAB QUERY ---
// Encapsulate the query logic to avoid repetition
function findExistingProcessorTabs() {
  chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") }, (tabs) => {
    if (chrome.runtime.lastError) {
      // This will now handle potential errors more gracefully without crashing.
      console.error("Error querying for processor tabs:", chrome.runtime.lastError.message);
      return;
    }
    if (tabs && tabs.length > 0) {
      console.log(`Found ${tabs.length} existing processor tab(s) on startup/install.`);
      tabs.forEach(tab => processorTabs.add(tab.id));
    }
  });
}

// --- INITIALIZATION (FIXED) ---
// Find any processor.html tabs that are already open when the browser starts or extension is installed/updated.
// This is the correct way to handle initialization logic.
chrome.runtime.onStartup.addListener(findExistingProcessorTabs);
chrome.runtime.onInstalled.addListener(findExistingProcessorTabs);


// --- BROADCAST FUNCTION ---
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

// --- EVENT LISTENERS ---

// Track when our processor.html UI tab is opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('processor.html')) {
    processorTabs.add(tabId);
    // When a new UI opens, send it the current state immediately
    notifyProcessorTabs();
  }
});

// Stop tracking closed tabs
chrome.tabs.onRemoved.addListener(tabId => {
  // If it's a closed processor UI tab, remove it from the broadcast list
  if (processorTabs.has(tabId)) {
    processorTabs.delete(tabId);
  }

  // Check if the closed tab is one we are tracking for the monitor
  const initialLength = tabState.createdTabs.length;
  tabState.createdTabs = tabState.createdTabs.filter(t => t.id !== tabId);

  // If a tracked tab was removed, notify the UI to update
  if (tabState.createdTabs.length < initialLength) {
    notifyProcessorTabs();
  }
});


// --- MESSAGE HANDLING ---
chrome.runtime.onMessage.addListener((req, _, sendResponse) => {
  if (req.action === "getTabState") {
    sendResponse({
      createdTabs: [...tabState.createdTabs]
    });
  } else if (req.action === "logTabCreation") {
    // This message comes from processor.js after a card is clicked and tab created
    if (!tabState.createdTabs.some(t => t.id === req.payload.id)) {
      tabState.createdTabs.push(req.payload);
      notifyProcessorTabs();
    }
  }
  return true; // Required for async sendResponse
});

// --- EXTENSION ACTION ---
// Open the processor UI when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});