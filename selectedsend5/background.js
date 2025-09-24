import { stateManager } from './lib/state.js';
import { automationScript } from './lib/automation.js';

chrome.runtime.onConnect.addListener(port => {
  if (port.name === "keepAlive") {
    console.log("Background: Keep-alive connection established.");
    port.onDisconnect.addListener(() => {
      console.log("Background: Keep-alive port disconnected.");
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        stateManager.stopPlayingOnLoad(tabId);
    }
    if (changeInfo.status !== 'complete' || !tab.url) return;

    if (tab.url.includes(chrome.runtime.getURL("processor.html"))) {
        stateManager.addProcessorTab(tabId);
    } else if (tab.url.startsWith('https://aistudio.google.com/prompts/new_chat')) {
        const tabToProcess = stateManager.findInjectableTab(tabId);
        if (tabToProcess) {
            chrome.scripting.executeScript({
                target: { tabId },
                func: automationScript,
                args: [tabToProcess.cardContent]
            }).catch(err => console.error(`Script injection failed for tab ${tabId}:`, err));
        }
    }
});

chrome.tabs.onRemoved.addListener(tabId => {
    stateManager.removeProcessorTab(tabId);
    stateManager.removeTab(tabId);
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch (req.action) {
        case "getTabState":
            sendResponse(stateManager.getState());
            return true;
        
        case "logTabCreation":
            stateManager.addTab(req.payload);
            break;
        
        case "updateDashboard":
            if (sender.tab) {
                stateManager.updateTabResponse(sender.tab.id, req);
            }
            break;
        
        case "playTab":
            stateManager.playTab(req.tabId);
            break;
        
        case "playAllTabs":
            stateManager.playAllTabs();
            break;
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});
