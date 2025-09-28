import { renderMonitorFull, appendMonitorEntry, updateMonitorEntry, removeMonitorEntry, updateGlobalControls, downloadJSON } from './renderer.js';

let state = { createdTabs: [], playingTabs: [] };

const c = document.getElementById('createdTabs');
const p = document.getElementById('playAllTabs');
const d = document.getElementById('downloadAllJson');
const x = document.getElementById('clearAllTabs');
const prog = document.getElementById('monitorProgress');

// ✅ REMOVED: setupKeepAlive() and all related logic

const getTabData = t => ({
  card_name: t.cardName,
  prompt_content: t.cardContent || '',
  ai_response: t.responseText || null,
  response_timestamp: t.responseTimestamp || null
});

const handleClick = e => {
  const entry = e.target.closest('.monitor-entry');
  if (!entry) return;
  const id = parseInt(entry.dataset.tabId, 10);
  if (e.target.closest('.btn-play')) chrome.runtime.sendMessage({ action: "playTab", tabId: id });
  else if (e.target.closest('.btn-download')) {
    const t = state.createdTabs.find(x => x.id === id);
    if (t) downloadJSON(getTabData(t), `${(t.cardName || 'card').replace(/[\s\W]+/g, '_')}_data.json`);
  }
};

const downloadAll = () => {
  if (!state.createdTabs.length) return alert("No data.");
  downloadJSON(state.createdTabs.map(getTabData), `all_cards_data_${new Date().toISOString().slice(0, 10)}.json`);
};

const updateUIFromEvent = (event) => {
  switch (event.type) {
    case 'tabAdded':
      state.createdTabs.push(event.tab);
      appendMonitorEntry(event.tab, false);
      updateGlobalControls(state.createdTabs, state.playingTabs, p, d, x, prog);
      break;
    case 'tabUpdated':
      const idx = state.createdTabs.findIndex(t => t.id === event.tab.id);
      if (idx !== -1) {
        state.createdTabs[idx] = event.tab;
        updateMonitorEntry(event.tab, state.playingTabs.includes(event.tab.id));
      }
      updateGlobalControls(state.createdTabs, state.playingTabs, p, d, x, prog);
      break;
    case 'tabRemoved':
      state.createdTabs = state.createdTabs.filter(t => t.id !== event.tabId);
      removeMonitorEntry(event.tabId);
      updateGlobalControls(state.createdTabs, state.playingTabs, p, d, x, prog);
      break;
    case 'playStateChanged':
      state.playingTabs = event.playingTabs;
      state.createdTabs.forEach(tab => {
        updateMonitorEntry(tab, state.playingTabs.includes(tab.id));
      });
      updateGlobalControls(state.createdTabs, state.playingTabs, p, d, x, prog);
      break;
    case 'cleared':
      state = { createdTabs: [], playingTabs: [] };
      c.innerHTML = '<div class="placeholder"><p>Click a card to monitor its tab.</p></div>';
      updateGlobalControls(state.createdTabs, state.playingTabs, p, d, x, prog);
      break;
    default:
      if (event.createdTabs !== undefined) {
        state = event;
        renderMonitorFull(event, c, p, d, x, prog);
      }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // ✅ NO keepAlive call here
  chrome.runtime.sendMessage({ action: "getTabState" }, r => {
    if (r) updateUIFromEvent(r);
  });
  chrome.runtime.onMessage.addListener(m => {
    if (m.action === "updateTabState") {
      updateUIFromEvent(m.payload);
    }
  });
  c.addEventListener('click', handleClick);
  p.addEventListener('click', () => chrome.runtime.sendMessage({ action: "playAllTabs" }));
  d.addEventListener('click', downloadAll);
  x.addEventListener('click', () => {
    if (state.createdTabs.length && confirm('Clear all tabs?')) {
      chrome.runtime.sendMessage({ action: "clearAllTabs" });
    }
  });
});