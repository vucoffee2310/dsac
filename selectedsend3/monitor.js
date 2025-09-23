// FILE: selectedsend3/monitor.js

// --- REVISED: Simplified render function ---
function render(state) {
  // Only update the 'createdTabs' element
  document.getElementById('createdTabs').textContent = JSON.stringify(state.createdTabs, null, 2);
}

function fetchInitialState() {
  chrome.runtime.sendMessage({ action: "getTabState" }, response => {
    // Handle potential errors, e.g., if the background script is not ready
    if (chrome.runtime.lastError) {
      console.warn("Could not fetch initial state:", chrome.runtime.lastError.message);
      return;
    }
    render(response);
  });
}

// Listen for real-time updates from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updateTabState") {
    render(message.payload);
  }
});

// Fetch the state when the page first loads
fetchInitialState();