import { renderMonitor, downloadJSON, renderLazyResponse } from './renderer.js';
let state = { createdTabs: [], playingTabs: [] };

// --- Main UI Elements ---
const c = document.getElementById('createdTabs'), p = document.getElementById('playAllTabs'),
      d = document.getElementById('downloadAllJson'), x = document.getElementById('clearAllTabs'),
      prog = document.getElementById('monitorProgress'),
      autoBtn = document.getElementById('automationModeBtn');

// --- Report Modal Elements ---
const reportModal = document.getElementById('reportModal'),
      showReportBtn = document.getElementById('showReportBtn'),
      closeReportBtn = reportModal.querySelector('.close-btn'),
      clearReportBtn = document.getElementById('clearReportBtn'),
      reportContent = document.getElementById('reportContent');

let automationModeActive = false;
const AUTOMATION_KEY = 'automationModeActive_v1';
const LOG_KEY = 'automationLog_v1';

// --- Storage Helpers ---
const getStorage = async (k) => (await chrome.storage.local.get(k))[k];
const setStorage = (k, v) => chrome.storage.local.set({ [k]: v });
const removeStorage = (k) => chrome.storage.local.remove(k);
const getLog = () => getStorage(LOG_KEY).then(log => log ?? []);
const saveLog = (log) => setStorage(LOG_KEY, log);

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

const handleAutomation = async (newState) => {
  if (!automationModeActive) return;
  const oldCompletedIds = new Set(state.createdTabs.filter(t => t.isComplete).map(t => t.id));
  const newlyCompletedTabs = newState.createdTabs.filter(t => t.isComplete && !oldCompletedIds.has(t.id));

  if (newlyCompletedTabs.length > 0) {
      const log = await getLog();
      for (const t of newlyCompletedTabs) {
        console.log(`Automation: Job "${t.cardName}" completed. Logging, saving, closing, and starting next job.`);
        const fileName = `${(t.cardName || 'card').replace(/[\s\W]+/g, '_')}_data.json`;
        
        // Action 1: Create a log entry
        log.push({
            cardId: t.cardId,
            tabId: t.id,
            cardName: t.cardName,
            fileName: fileName,
            timestamp: new Date().toLocaleString()
        });

        // Action 2: Save data automatically via the background script.
        // This is now asynchronous and doesn't block the UI.
        chrome.runtime.sendMessage({
          action: "downloadFile",
          payload: { data: getTabData(t), fileName: fileName }
        });

        // The 500ms wait is REMOVED. The following actions happen immediately.
        // This makes the automation chain significantly faster.
        chrome.runtime.sendMessage({ action: "removeSingleTab", tabId: t.id });
        if (t.cardId) {
          document.dispatchEvent(new CustomEvent('removeProcessedCard', { detail: { cardId: t.cardId } }));
        }
        document.dispatchEvent(new CustomEvent('openNextCard'));
      }
      // Action 3: Save the updated log
      await saveLog(log);
  }
};

const render = s => {
  handleAutomation(s);
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
  } else if (e.target.closest('.btn-close')) {
    if (confirm(`Are you sure you want to close the tab for card ${entry.querySelector('strong').textContent}?`)) {
        chrome.runtime.sendMessage({ action: "removeSingleTab", tabId: id });
    }
  }

  const details = e.target.closest('details[data-lazy-response]');
  if (details && e.target.tagName === 'SUMMARY') {
    details.removeAttribute('data-lazy-response');
    const t = state.createdTabs.find(x => x.id === id);
    renderLazyResponse(details, t);
  }
};

const downloadAll = () => {
  if (!state.createdTabs.length) return alert("No data.");
  downloadJSON(state.createdTabs.map(getTabData), `all_cards_data_${new Date().toISOString().slice(0, 10)}.json`);
};

// --- Report Modal Functions ---
const renderReport = (log) => {
    if (!log || log.length === 0) {
        reportContent.innerHTML = '<p>No automation actions have been logged yet.</p>';
        return;
    }
    reportContent.innerHTML = [...log].reverse().map(entry => `
        <div class="log-entry">
            <strong>✅ Card '${entry.cardName}' processed.</strong>
            <small>Timestamp: ${entry.timestamp} | Saved as: ${entry.fileName}</small>
        </div>
    `).join('');
};

const openReport = async () => {
    const log = await getLog();
    renderReport(log);
    reportModal.style.display = 'flex';
};

const closeReport = () => reportModal.style.display = 'none';

const clearReport = async () => {
    if (confirm("Are you sure you want to permanently clear the automation report?")) {
        await removeStorage(LOG_KEY);
        renderReport([]); // Re-render with empty log
    }
};

document.addEventListener('DOMContentLoaded', () => {
  setupKeepAlive();
  chrome.runtime.sendMessage({ action: "getTabState" }, r => r && render(r));
  chrome.runtime.onMessage.addListener(m => m.action === "updateTabState" && render(m.payload));
  c.addEventListener('click', handleClick);
  p.addEventListener('click', () => chrome.runtime.sendMessage({ action: "playAllTabs" }));
  d.addEventListener('click', downloadAll);
  x.addEventListener('click', () => state.createdTabs.length && confirm('Clear all tabs?') && chrome.runtime.sendMessage({ action: "clearAllTabs" }));

  // --- Automation Mode Setup ---
  if (autoBtn) {
    getStorage(AUTOMATION_KEY).then(isActive => {
      automationModeActive = !!isActive;
      autoBtn.classList.toggle('active', automationModeActive);
    });
    autoBtn.addEventListener('click', () => {
      automationModeActive = !automationModeActive;
      autoBtn.classList.toggle('active', automationModeActive);
      setStorage(AUTOMATION_KEY, automationModeActive);
    });
  }

  // --- Report Modal Listeners ---
  showReportBtn.addEventListener('click', openReport);
  closeReportBtn.addEventListener('click', closeReport);
  clearReportBtn.addEventListener('click', clearReport);
  window.addEventListener('click', (event) => {
    if (event.target === reportModal) closeReport();
  });
});