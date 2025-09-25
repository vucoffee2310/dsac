// --- Storage Functions (for clicked card state) ---
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


// --- Tab State Management ---
let createdTabs = [];
const playingTabs = new Set();

const notifyProcessorTabs = async () => {
  const payload = { 
      createdTabs: [...createdTabs], 
      playingTabs: [...playingTabs] 
  };
  
  try {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: "updateTabState", payload })
        .catch(error => console.log(`Could not send message to tab ${tab.id}, it might be closing. Error: ${error.message}`));
    }
  } catch (e) {
      console.error("Failed to query for processor tabs:", e);
  }
};

export const stateManager = {
    addTab: (payload) => {
        if (!createdTabs.some(t => t.id === payload.id)) {
            createdTabs.push({ ...payload, injected: false, isComplete: false });
            notifyProcessorTabs();
        }
    },
    removeTab: (tabId) => {
        const wasChanged = playingTabs.delete(tabId);
        const index = createdTabs.findIndex(t => t.id === tabId);
        if (index > -1) {
            createdTabs.splice(index, 1);
            if (!wasChanged) notifyProcessorTabs();
        }
        if (wasChanged) notifyProcessorTabs();
    },
    updateTabResponse: (tabId, { responseText, timestamp, isComplete }) => {
        const tab = createdTabs.find(t => t.id === tabId);
        if (tab) {
            tab.responseText = responseText;
            tab.responseTimestamp = timestamp;
            if (isComplete !== undefined) {
                tab.isComplete = isComplete;
            }
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
        chrome.tabs.sendMessage(tabId, { play: true }).catch(e => {});
        notifyProcessorTabs();
    },
    playAllTabs: () => {
        playingTabs.clear();
        createdTabs.forEach(tab => {
            playingTabs.add(tab.id);
            chrome.tabs.sendMessage(tab.id, { play: true }).catch(e => {});
        });
        notifyProcessorTabs();
    },
    stopPlayingOnLoad: (tabId) => {
        if (playingTabs.has(tabId)) {
            playingTabs.delete(tabId);
            notifyProcessorTabs();
        }
    },

    getState: () => ({ createdTabs, playingTabs: [...playingTabs] }),
    
    clearAllTabs: () => {
      const tabIds = createdTabs.map(t => t.id);
      
      if (tabIds.length > 0) {
        chrome.tabs.remove(tabIds).catch(e => {
            console.log("Could not remove all tabs, some may have already been closed.", e.message);
        });
      }

      createdTabs = [];
      playingTabs.clear();
      
      notifyProcessorTabs();
    },
};