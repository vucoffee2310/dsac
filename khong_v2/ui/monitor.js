import { renderMonitor, downloadJSON, renderLazyResponse } from './renderer.js';
let state = { createdTabs: [], playingTabs: [] };
const c = document.getElementById('createdTabs'), p = document.getElementById('playAllTabs'),
      d = document.getElementById('downloadAllJson'), x = document.getElementById('clearAllTabs'),
      prog = document.getElementById('monitorProgress');

const setupKeepAlive = () => {
  let port = chrome.runtime.connect({ name: "keepAlive" });
  port.onDisconnect.addListener(() => setTimeout(setupKeepAlive, 5000));
};

const getTabData = t => ({
  card_name: t.cardName,
  original_prompt_content: t.originalCardContent || '',
  final_prompt_sent: t.cardContent || '',
  ai_response: t.responseText || null,
  response_timestamp: t.responseTimestamp || null
});

const render = s => {
  state = s;
  renderMonitor(s, c, p, d, x, prog);
  p.textContent = s.playingTabs.length ? '⏹️' : '▶️';
};

const handleClick = e => {
  const entry = e.target.closest('.monitor-entry');
  if (!entry) return;
  const id = parseInt(entry.dataset.tabId, 10);

  if (e.target.closest('.btn-play')) {
    chrome.runtime.sendMessage({ action: "playTab", tabId: id });
  } else if (e.target.closest('.btn-download')) {
    const t = state.createdTabs.find(x => x.id === id);
    if (t) downloadJSON(getTabData(t), `${(t.cardName || 'card').replace(/[\s\W]+/g, '_')}_data.json`);
  }

  // Logic for lazy-loading the AI response on click
  const details = e.target.closest('details[data-lazy-response]');
  if (details && e.target.tagName === 'SUMMARY') {
    // Remove attribute immediately to prevent this from running more than once.
    details.removeAttribute('data-lazy-response');
    const t = state.createdTabs.find(x => x.id === id);
    // Call the dedicated rendering function to inject the content.
    renderLazyResponse(details, t);
  }
};

const downloadAll = () => {
  if (!state.createdTabs.length) return alert("No data.");
  downloadJSON(state.createdTabs.map(getTabData), `all_cards_data_${new Date().toISOString().slice(0, 10)}.json`);
};

document.addEventListener('DOMContentLoaded', () => {
  setupKeepAlive();
  chrome.runtime.sendMessage({ action: "getTabState" }, r => r && render(r));
  chrome.runtime.onMessage.addListener(m => m.action === "updateTabState" && render(m.payload));
  c.addEventListener('click', handleClick);
  p.addEventListener('click', () => chrome.runtime.sendMessage({ action: "playAllTabs" }));
  d.addEventListener('click', downloadAll);
  x.addEventListener('click', () => state.createdTabs.length && confirm('Clear all tabs?') && chrome.runtime.sendMessage({ action: "clearAllTabs" }));
});