// ui/monitor.js
import { renderMonitor, downloadJSON } from './renderer.js';

let currentTabState = { createdTabs: [], playingTabs: [] };
const container = document.getElementById('createdTabs');
const playAllBtn = document.getElementById('playAllTabs');
const downloadAllBtn = document.getElementById('downloadAllJson');
const clearAllBtn = document.getElementById('clearAllTabs');
const monitorProgress = document.getElementById('monitorProgress');

function setupKeepAlive() {
  let port = chrome.runtime.connect({ name: "keepAlive" });
  port.onDisconnect.addListener(() => {
    console.log("Reconnecting...");
    setTimeout(setupKeepAlive, 5000);
  });
}

const getTabData = tab => ({
  card_name: tab.cardName,
  prompt_content: tab.cardContent || '',
  ai_response: tab.responseText || null,
  response_timestamp: tab.responseTimestamp || null
});


function render(state) {
  currentTabState = state;
  renderMonitor(state, container, playAllBtn, downloadAllBtn, clearAllBtn, monitorProgress);
  const anyPlaying = state.playingTabs.length > 0;
  playAllBtn.textContent = anyPlaying ? '⏹️ Stop All' : '▶️ Play All';
}

function handleMonitorClick(e) {
  const entry = e.target.closest('.monitor-entry');
  if (!entry) return;
  const tabId = parseInt(entry.dataset.tabId, 10);
  if (e.target.closest('.btn-play')) {
    chrome.runtime.sendMessage({ action: "playTab", tabId });
  } else if (e.target.closest('.btn-download')) {
    const tab = currentTabState.createdTabs.find(t => t.id === tabId);
    if (tab) {
      const name = (tab.cardName || 'card').replace(/[\s\W]+/g, '_');
      downloadJSON(getTabData(tab), `${name}_data.json`);
    }
  }
}

function handleDownloadAll() {
  const { createdTabs } = currentTabState;
  if (!createdTabs?.length) return alert("No data.");
  const filename = `all_cards_data_${new Date().toISOString().slice(0, 10)}.json`;
  downloadJSON(createdTabs.map(getTabData), filename);
}

document.addEventListener('DOMContentLoaded', () => {
  setupKeepAlive();
  chrome.runtime.sendMessage({ action: "getTabState" }, res => res && render(res));
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === "updateTabState") render(msg.payload);
  });

  container.addEventListener('click', handleMonitorClick);
  
  playAllBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "playAllTabs" });
  });

  downloadAllBtn.addEventListener('click', handleDownloadAll);
  
  clearAllBtn.addEventListener('click', () => {
    if (currentTabState.createdTabs.length && confirm('Clear all tabs?')) {
      chrome.runtime.sendMessage({ action: "clearAllTabs" });
    }
  });
});