// FILE: selectedsend3/monitor.js

// --- REVISED: Dynamic render function with JSON download buttons ---
function render(state) {
  const container = document.getElementById('createdTabs');
  if (!container) return;
  
  container.innerHTML = ''; 

  if (!state.createdTabs || state.createdTabs.length === 0) {
    container.innerHTML = `<p class="monitor-placeholder">Click a card to monitor its tab.</p>`;
    return;
  }
  
  state.createdTabs.forEach(tabInfo => {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'monitor-entry';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'monitor-entry-header';

    const cardName = document.createElement('p');
    cardName.innerHTML = `<strong>Card Name:</strong> ${tabInfo.cardName || 'N/A'}`;
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'btn btn-download';
    downloadButton.innerHTML = '📥 Download JSON';
    
    // --- UPDATED DOWNLOAD LOGIC ---
    downloadButton.addEventListener('click', () => {
      // 1. Construct the data object with specified keys
      const dataToSave = {
        tab_id: tabInfo.id,
        tab_url: tabInfo.url,
        timestamp: tabInfo.timestamp,
        card_name: tabInfo.cardName,
        card_content: tabInfo.cardContent || ''
      };

      // 2. Convert the object to a pretty-printed JSON string
      const jsonContent = JSON.stringify(dataToSave, null, 2);
      
      // 3. Sanitize the filename and change the extension to .json
      const filename = `${tabInfo.cardName.replace(/\s+/g, '_')}_data.json`;
      
      // 4. Create a Blob with the correct 'application/json' MIME type
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      
      // 5. Create a link and trigger the download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href); // Clean up memory
    });
    // --- END OF UPDATED LOGIC ---
    
    headerDiv.appendChild(cardName);
    headerDiv.appendChild(downloadButton);

    const tabId = document.createElement('p');
    tabId.innerHTML = `<strong>Tab ID:</strong> ${tabInfo.id}`;

    const contentDetails = document.createElement('details');
    const contentSummary = document.createElement('summary');
    contentSummary.textContent = 'View/Hide Card Content';
    
    const contentPre = document.createElement('pre');
    contentPre.textContent = tabInfo.cardContent || '(No content)';
    
    contentDetails.appendChild(contentSummary);
    contentDetails.appendChild(contentPre);

    entryDiv.appendChild(headerDiv);
    entryDiv.appendChild(tabId);
    entryDiv.appendChild(contentDetails);
    
    container.appendChild(entryDiv);
  });
}

function fetchInitialState() {
  chrome.runtime.sendMessage({ action: "getTabState" }, response => {
    if (chrome.runtime.lastError) {
      console.warn("Could not fetch initial state:", chrome.runtime.lastError.message);
      document.getElementById('createdTabs').textContent = 'Error loading state.';
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
document.addEventListener('DOMContentLoaded', fetchInitialState);