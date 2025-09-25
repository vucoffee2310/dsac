// All functions are explicitly exported for named imports.

const STORAGE_KEY = 'clickedCards_v1';

// --- Storage Functions (for clicked card state) ---
// These are already concise and follow best practices. No changes needed.
export const getClickedCards = async () => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] ?? {};
};

export const addClickedCard = async (cardId) => {
    const clickedIds = await getClickedCards();
    clickedIds[cardId] = true;
    await chrome.storage.local.set({ [STORAGE_KEY]: clickedIds });
};

export const clearClickedCards = () => chrome.storage.local.remove(STORAGE_KEY);


// --- In-Memory Tab State Management ---
let createdTabs = [];
const playingTabs = new Set();

// Centralized function to notify all processor tabs of a state change.
const notifyProcessorTabs = async () => {
  const payload = { createdTabs: [...createdTabs], playingTabs: [...playingTabs] };
  try {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") });
    await Promise.allSettled(
      tabs.map(tab => chrome.tabs.sendMessage(tab.id, { action: "updateTabState", payload }))
    );
  } catch (error) {
    console.error("Failed to query/notify processor tabs:", error);
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
        const initialCount = createdTabs.length;
        const wasPlaying = playingTabs.delete(tabId);
        createdTabs = createdTabs.filter(t => t.id !== tabId);
        if (createdTabs.length < initialCount || wasPlaying) {
             notifyProcessorTabs();
        }
    },
    updateTabResponse: (tabId, updates) => {
        const tab = createdTabs.find(t => t.id === tabId);
        if (tab) {
            Object.assign(tab, {
                responseText: updates.responseText,
                responseTimestamp: updates.timestamp,
                isComplete: updates.isComplete
            });
            notifyProcessorTabs();
        }
    },
    findInjectableTab: (tabId) => {
        const tab = createdTabs.find(t => t.id === tabId && !t.injected);
        if (tab) tab.injected = true;
        return tab;
    },
    playTab: (tabId) => {
        playingTabs.clear();
        playingTabs.add(tabId);
        chrome.tabs.sendMessage(tabId, { play: true }).catch(() => {});
        notifyProcessorTabs();
    },
    playAllTabs: () => {
        playingTabs.clear();
        createdTabs.forEach(tab => {
            playingTabs.add(tab.id);
            chrome.tabs.sendMessage(tab.id, { play: true }).catch(() => {});
        });
        notifyProcessorTabs();
    },
    stopPlayingOnLoad: (tabId) => {
        // .delete() returns true if an element was successfully removed.
        if (playingTabs.delete(tabId)) {
            notifyProcessorTabs();
        }
    },
    getState: () => ({ createdTabs, playingTabs: [...playingTabs] }),
    clearAllTabs: async () => {
      const tabIds = createdTabs.map(t => t.id);
      createdTabs = [];
      playingTabs.clear();
      if (tabIds.length) {
        await chrome.tabs.remove(tabIds).catch(e => console.log("Some tabs may be closed.", e.message));
      }
      notifyProcessorTabs();
    },
};