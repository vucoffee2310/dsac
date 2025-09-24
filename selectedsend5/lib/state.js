// --- Storage Functions (from storage.js) ---
const STORAGE_KEY = 'clickedCards_v1';

export async function getClickedCards() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
}

export async function addClickedCard(cardId) {
    const clickedIds = await getClickedCards();
    clickedIds[cardId] = true;
    await chrome.storage.local.set({ [STORAGE_KEY]: clickedIds });
}

export async function clearClickedCards() {
    await chrome.storage.local.remove(STORAGE_KEY);
}


// --- Tab State Management (from tabStateManager.js) ---
let createdTabs = [];
const processorTabs = new Set();
const playingTabs = new Set();

function safeSendMessage(tabId, message, onError) {
  chrome.tabs.sendMessage(tabId, message).catch(error => {
    if (error.message.includes('Receiving end does not exist')) {
      if (onError) onError(tabId);
    } else {
      console.error(`Error sending message to tab ${tabId}:`, error);
    }
  });
}

const notifyProcessorTabs = () => {
  const payload = { 
      createdTabs: [...createdTabs], 
      playingTabs: [...playingTabs] 
  };
  processorTabs.forEach(tabId => {
    safeSendMessage(tabId, { action: "updateTabState", payload }, (failedTabId) => {
      processorTabs.delete(failedTabId);
    });
  });
};

export const stateManager = {
    addProcessorTab: (tabId) => {
        processorTabs.add(tabId);
        notifyProcessorTabs();
    },
    removeProcessorTab: (tabId) => processorTabs.delete(tabId),
    
    addTab: (payload) => {
        if (!createdTabs.some(t => t.id === payload.id)) {
            createdTabs.push({ ...payload, injected: false });
            notifyProcessorTabs();
        }
    },
    removeTab: (tabId) => {
        const wasPlaying = playingTabs.has(tabId);
        playingTabs.delete(tabId);
        const index = createdTabs.findIndex(t => t.id === tabId);
        if (index > -1) {
            createdTabs.splice(index, 1);
        }
        notifyProcessorTabs();
    },
    updateTabResponse: (tabId, { responseText, timestamp }) => {
        const tab = createdTabs.find(t => t.id === tabId);
        if (tab) {
            tab.responseText = responseText;
            tab.responseTimestamp = timestamp;
            notifyProcessorTabs();
        }
    },
    findInjectableTab: (tabId) => {
        const tabToProcess = createdTabs.find(t => t.id === tabId && !t.injected);
        if (tabToProcess) {
            tabToProcess.injected = true;
            return tabToProcess;
        }
        return null;
    },
    
    playTab: (tabId) => {
        playingTabs.clear();
        playingTabs.add(tabId);
        safeSendMessage(tabId, { play: true });
        notifyProcessorTabs();
    },
    playAllTabs: () => {
        playingTabs.clear();
        createdTabs.forEach(tab => {
            playingTabs.add(tab.id);
            safeSendMessage(tab.id, { play: true });
        });
        notifyProcessorTabs();
    },
    stopPlayingOnLoad: (tabId) => {
        if (playingTabs.has(tabId)) {
            playingTabs.delete(tabId);
            notifyProcessorTabs();
        }
    },

    getState: () => ({ createdTabs, playingTabs: [...playingTabs] })
};
