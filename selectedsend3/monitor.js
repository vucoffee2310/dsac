// FILE: selectedsend3/monitor.js

// Module-level cache to hold the latest tab state for event handlers
let currentTabState = { createdTabs: [] };

// Utility to prevent XSS from card content
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Renders the list of monitored tabs
function render(state) {
  currentTabState = state; // Update the cache
  const container = document.getElementById('createdTabs');
  if (!container) return;

  if (!state.createdTabs || state.createdTabs.length === 0) {
    container.innerHTML = `<p class="monitor-placeholder">Click a card to monitor its tab.</p>`;
    return;
  }

  container.innerHTML = state.createdTabs.map(tabInfo => {
    const safeCardName = escapeHtml(tabInfo.cardName || 'N/A');
    const safeContent = escapeHtml(tabInfo.cardContent || '(No content)');
    const filename = `${(tabInfo.cardName || 'card').replace(/[\s\W]+/g, '_')}_data.json`;
    
    return `
      <div class="monitor-entry" data-tab-id="${tabInfo.id}">
        <div class="monitor-entry-header">
          <p><strong>Card Name:</strong> ${safeCardName}</p>
          <button class="btn btn-download">📥 Download JSON</button>
        </div>
        <p><strong>Tab ID:</strong> ${tabInfo.id}</p>
        <details>
          <summary>View/Hide Card Content</summary>
          <pre>${safeContent}</pre>
        </details>
      </div>`;
  }).join('');
}

// Handles download logic using the cached state
function handleDownloadClick(event) {
  if (!event.target.classList.contains('btn-download')) return;

  const entryDiv = event.target.closest('.monitor-entry');
  if (!entryDiv) return;

  const tabId = parseInt(entryDiv.dataset.tabId, 10);
  const tabInfo = currentTabState.createdTabs.find(t => t.id === tabId);
  if (!tabInfo) return;

  const dataToSave = {
    tab_id: tabInfo.id,
    tab_url: tabInfo.url,
    timestamp: tabInfo.timestamp,
    card_name: tabInfo.cardName,
    card_content: tabInfo.cardContent || ''
  };

  const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(tabInfo.cardName || 'card').replace(/[\s\W]+/g, '_')}_data.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- INITIALIZATION ---
function initMonitor() {
  // Fetch initial state on load
  chrome.runtime.sendMessage({ action: "getTabState" }, response => {
    if (chrome.runtime.lastError) {
      console.warn("Could not fetch initial state:", chrome.runtime.lastError.message);
      document.getElementById('createdTabs').textContent = 'Error loading state.';
    } else if (response) {
      render(response);
    }
  });

  // Listen for real-time updates
  chrome.runtime.onMessage.addListener(message => {
    if (message.action === "updateTabState") {
      render(message.payload);
    }
  });

  // Use event delegation for all download buttons
  document.getElementById('createdTabs').addEventListener('click', handleDownloadClick);
}

document.addEventListener('DOMContentLoaded', initMonitor);