import { tabState } from './states/tabs.js';
import { automationScript } from './automations/script.js';

chrome.runtime.onConnect.addListener(port => {
  if (port.name === "keepAlive") port.onDisconnect.addListener(() => console.log("Keep-alive lost."));
});

// Listener for reliable delayed actions from chrome.alarms
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name.startsWith('cleanup_tab_')) {
    const tabId = parseInt(alarm.name.split('_')[2], 10);
    if (!isNaN(tabId)) {
      tabState.finalizeRemove(tabId);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) tabState.stopIfNavigatedAway(tabId, tab.url);
  if (changeInfo.status === 'complete' && tab.url?.startsWith('https://aistudio.google.com/prompts/new_chat')) {
    const t = tabState.findInjectableTab(tabId);
    if (t) chrome.scripting.executeScript({ target: { tabId }, func: automationScript, args: [t.cardContent, t.cardName] }).catch(e => console.error(`Injection failed for ${tabId}:`, e));
  }
});

chrome.tabs.onRemoved.addListener(tabState.removeTab);

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  // The audio content script sends a generic message. We must handle it here.
  if (req.play) {
    if (sender.tab) chrome.tabs.sendMessage(sender.tab.id, { play: true }).catch(() => {});
    return;
  }
  
  if (req.action === 'getTabState') return sendResponse(tabState.getState());
  const h = {
    logTabCreation: () => tabState.addTab(req.payload),
    updateDashboard: () => sender.tab && tabState.updateTabResponse(sender.tab.id, req),
    playTab: () => tabState.playTab(req.tabId),
    playAllTabs: () => tabState.playAllTabs(),
    clearAllTabs: () => tabState.clearAllTabs(),
    removeSingleTab: () => chrome.tabs.remove(req.tabId).catch(() => {}),
    startPlaying: () => sender.tab && tabState.startPlaying(sender.tab.id),
    downloadFile: () => {
      const { data, fileName } = req.payload;
      
      // --- START OF FIX ---
      // REPLACED: Blob URL which is not available in Service Workers.
      // const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      // const url = URL.createObjectURL(blob);

      // WITH: A self-contained Data URL, which works perfectly in Service Workers.
      const content = JSON.stringify(data, null, 2);
      const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(content);
      // --- END OF FIX ---

      chrome.downloads.download({
        url: url,
        filename: fileName
      });
    },
  };
  const f = h[req.action];
  if (f) {
    const r = f();
    if (r instanceof Promise) r.catch(console.error);
  }
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") }));