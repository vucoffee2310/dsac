import { renderMonitor, downloadJSON } from './lib/utils.js';

let currentTabState = { createdTabs: [], playingTabs: [] };
const container = document.getElementById('createdTabs');
const playAllBtn = document.getElementById('playAllTabs');
const downloadAllBtn = document.getElementById('downloadAllJson');
const clearAllBtn = document.getElementById('clearAllTabs');
const monitorProgress = document.getElementById('monitorProgress');

function setupKeepAlive() {
  let port = chrome.runtime.connect({ name: "keepAlive" });
  port.onDisconnect.addListener(() => {
    console.log("Keep-alive port disconnected. Attempting to reconnect...");
    setTimeout(setupKeepAlive, 5000); 
  });
  console.log("Keep-alive port connected.");
}

const getTabData = tabInfo => ({
    card_name: tabInfo.cardName,
    prompt_content: tabInfo.cardContent || '',
    ai_response: tabInfo.responseText || null,
    response_timestamp: tabInfo.responseTimestamp || null
});

function render(state) {
  currentTabState = state;
  if (container) {
    renderMonitor(state, container, playAllBtn, downloadAllBtn, clearAllBtn, monitorProgress);
  }
}

function handleMonitorClick({ target }) {
  const entryDiv = target.closest('.monitor-entry');
  if (!entryDiv) return;

  const tabId = parseInt(entryDiv.dataset.tabId, 10);

  if (target.closest('.btn-play')) {
    chrome.runtime.sendMessage({ action: "playTab", tabId });
  } else if (target.closest('.btn-download')) {
    const tabInfo = currentTabState.createdTabs.find(t => t.id === tabId);
    if (!tabInfo) return;
    const filename = `${(tabInfo.cardName || 'card').replace(/[\s\W]+/g, '_')}_data.json`;
    downloadJSON(getTabData(tabInfo), filename);
  }
}

function handleDownloadAll() {
  const { createdTabs } = currentTabState;
  if (!createdTabs?.length) return alert("No data to download.");
  
  const filename = `all_cards_data_${new Date().toISOString().slice(0, 10)}.json`;
  downloadJSON(createdTabs.map(getTabData), filename);
}

document.addEventListener('DOMContentLoaded', () => {
  setupKeepAlive();

  chrome.runtime.sendMessage({ action: "getTabState" }, response => response && render(response));
  chrome.runtime.onMessage.addListener(msg => msg.action === "updateTabState" && render(msg.payload));
  
  container.addEventListener('click', handleMonitorClick);
  playAllBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: "playAllTabs" }));
  downloadAllBtn.addEventListener('click', handleDownloadAll);
  clearAllBtn.addEventListener('click', () => {
    if (currentTabState.createdTabs.length && confirm('Are you sure you want to close all monitored tabs and clear the list?')) {
      chrome.runtime.sendMessage({ action: "clearAllTabs" });
    }
  });
});