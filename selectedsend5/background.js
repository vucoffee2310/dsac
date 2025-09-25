import { stateManager } from './lib/state.js';
import { automationScript } from './lib/automation.js';

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "keepAlive") return;
  console.log("Background: Keep-alive connection established.");
  port.onDisconnect.addListener(() => console.log("Background: Keep-alive port disconnected."));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        stateManager.stopPlayingOnLoad(tabId);
    }
    if (changeInfo.status !== 'complete' || !tab.url?.startsWith('https://aistudio.google.com/prompts/new_chat')) return;
    
    const tabToProcess = stateManager.findInjectableTab(tabId);
    if (tabToProcess) {
        chrome.scripting.executeScript({
            target: { tabId },
            func: automationScript,
            args: [tabToProcess.cardContent, tabToProcess.cardName]
        }).catch(err => console.error(`Script injection failed for tab ${tabId}:`, err));
    }
});

chrome.tabs.onRemoved.addListener(stateManager.removeTab);

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    const actions = {
        getTabState: () => { sendResponse(stateManager.getState()); return true; },
        logTabCreation: () => stateManager.addTab(req.payload),
        updateDashboard: () => sender.tab && stateManager.updateTabResponse(sender.tab.id, req),
        playTab: () => stateManager.playTab(req.tabId),
        playAllTabs: stateManager.playAllTabs,
        clearAllTabs: stateManager.clearAllTabs,
    };
    return actions[req.action]?.();
});

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});