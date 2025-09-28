import { tabState } from './states/tabs.js';
import { automationScript } from './automations/script.js';

chrome.runtime.onConnect.addListener(port => {
  if (port.name === "keepAlive") port.onDisconnect.addListener(() => console.log("Keep-alive lost."));
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
  if (req.action === 'getTabState') return sendResponse(tabState.getState());
  const h = {
    logTabCreation: () => tabState.addTab(req.payload),
    updateDashboard: () => sender.tab && tabState.updateTabResponse(sender.tab.id, req),
    playTab: () => tabState.playTab(req.tabId),
    playAllTabs: () => tabState.playAllTabs(),
    clearAllTabs: () => tabState.clearAllTabs(),
  };
  const f = h[req.action];
  if (f) {
    const r = f();
    if (r instanceof Promise) r.catch(console.error);
  }
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") }));