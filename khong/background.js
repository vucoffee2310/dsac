// selectedsend5/background.js
import { tabState } from './lib/tabState.js';
import { automationScript } from './lib/automation.js';

chrome.runtime.onConnect.addListener(port => {
  if (port.name === "keepAlive") {
    port.onDisconnect.addListener(() => console.log("Keep-alive lost."));
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    tabState.stopPlayingOnLoad(tabId);
  }
  if (changeInfo.status !== 'complete' || !tab.url?.startsWith('https://aistudio.google.com/prompts/new_chat')) return;
  const tabToProcess = tabState.findInjectableTab(tabId);
  if (tabToProcess) {
    chrome.scripting.executeScript({
      target: { tabId },
      func: automationScript,
      args: [tabToProcess.cardContent, tabToProcess.cardName]
    }).catch(err => console.error(`Injection failed for ${tabId}:`, err));
  }
});

chrome.tabs.onRemoved.addListener(tabState.removeTab);

chrome.runtime.onMessage.addListener((req, sender) => {
  const actions = {
    getTabState: () => Promise.resolve(tabState.getState()),
    logTabCreation: () => tabState.addTab(req.payload),
    updateDashboard: () => sender.tab && tabState.updateTabResponse(sender.tab.id, req),
    playTab: () => tabState.playTab(req.tabId),
    playAllTabs: tabState.playAllTabs,
    clearAllTabs: tabState.clearAllTabs,
  };
  const handler = actions[req.action];
  if (handler) {
    const result = handler();
    if (result instanceof Promise) result.catch(console.error);
    return true; // for async messaging
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});