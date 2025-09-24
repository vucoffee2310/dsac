// FILE: selectedsend3/monitor.js
import { renderMonitor } from './lib/monitorRenderer.js';
import { downloadJSON } from './lib/utils.js';

let currentTabState = { createdTabs: [], playingTabs: [] };
const container = document.getElementById('createdTabs');
const playAllBtn = document.getElementById('playAllTabs');

function setupKeepAlive() {
  let port = chrome.runtime.connect({ name: "keepAlive" });
  port.onDisconnect.addListener(() => {
    console.log("Keep-alive port disconnected. Attempting to reconnect...");
    setTimeout(setupKeepAlive, 5000); 
  });
  console.log("Keep-alive port connected.");
}

function render(state) {
  currentTabState = state;
  if (container && playAllBtn) {
    renderMonitor(state, container, playAllBtn);
  }
}

function handleMonitorClick(event) {
  const target = event.target;
  const entryDiv = target.closest('.monitor-entry');
  if (!entryDiv) return;

  const tabId = parseInt(entryDiv.dataset.tabId, 10);

  if (target.closest('.btn-play')) {
    chrome.runtime.sendMessage({ action: "playTab", tabId });
    return;
  }

  if (target.closest('.btn-download')) {
    const tabInfo = currentTabState.createdTabs.find(t => t.id === tabId);
    if (!tabInfo) return;
    const data = {
        card_name: tabInfo.cardName,
        prompt_content: tabInfo.cardContent || '',
        ai_response: tabInfo.responseText || null,
        response_timestamp: tabInfo.responseTimestamp || null
    };
    const filename = `${(tabInfo.cardName || 'card').replace(/[\s\W]+/g, '_')}_data.json`;
    downloadJSON(data, filename);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupKeepAlive();

  chrome.runtime.sendMessage({ action: "getTabState" }, response => response && render(response));
  chrome.runtime.onMessage.addListener(msg => msg.action === "updateTabState" && render(msg.payload));
  
  container.addEventListener('click', handleMonitorClick);
  playAllBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "playAllTabs" });
  });
});