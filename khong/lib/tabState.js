// lib/tabState.js
import { getStorage, setStorage, removeStorage } from './storage.js';

const TABS_KEY = 'createdTabs_v1';
let createdTabs = [];
const playingTabs = new Set();

// Rehydrate
(async () => {
  const saved = await getStorage(TABS_KEY);
  if (saved) createdTabs = saved.map(t => ({ ...t, injected: t.injected !== false }));
})();

const notifyProcessorTabs = async (payload) => {
  try {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") });
    await Promise.allSettled(
      tabs.map(tab => chrome.tabs.sendMessage(tab.id, { action: "updateTabState", payload }))
    );
  } catch (e) {
    console.error("Notify processor tabs failed:", e);
  }
};

const persistAndNotify = async () => {
  await setStorage(TABS_KEY, createdTabs);
  notifyProcessorTabs({ createdTabs, playingTabs: [...playingTabs] });
};

export const tabState = {
  addTab: (payload) => {
    if (!createdTabs.some(t => t.id === payload.id)) {
      createdTabs.push({ ...payload, injected: false, isComplete: false });
      persistAndNotify();
    }
  },

  removeTab: (tabId) => {
    const initialLen = createdTabs.length;
    const wasPlaying = playingTabs.delete(tabId);
    createdTabs = createdTabs.filter(t => t.id !== tabId);
    if (createdTabs.length !== initialLen || wasPlaying) persistAndNotify();
  },

  updateTabResponse: (tabId, updates) => {
    const tab = createdTabs.find(t => t.id === tabId);
    if (!tab) return;

    // Apply updates
    Object.assign(tab, {
      responseText: updates.responseText,
      responseTimestamp: updates.timestamp,
      isComplete: updates.isComplete
    });

    // ✅ If the tab is now complete AND was playing → stop audio
    if (updates.isComplete && playingTabs.has(tabId)) {
      playingTabs.delete(tabId);
      chrome.tabs.sendMessage(tabId, { stop: true }).catch(() => {});
    }

    persistAndNotify();
  },

  findInjectableTab: (tabId) => {
    const tab = createdTabs.find(t => t.id === tabId && !t.injected);
    if (tab) tab.injected = true;
    return tab;
  },

  playTab: (tabId) => {
    // Toggle individual tab
    if (playingTabs.has(tabId)) {
      playingTabs.delete(tabId);
      chrome.tabs.sendMessage(tabId, { stop: true }).catch(() => {});
    } else {
      playingTabs.add(tabId);
      chrome.tabs.sendMessage(tabId, { play: true }).catch(() => {});
    }
    persistAndNotify();
  },

  playAllTabs: () => {
    const tabIds = createdTabs.map(t => t.id);
    const anyPlaying = tabIds.some(id => playingTabs.has(id));

    tabIds.forEach(id => {
      if (anyPlaying) {
        playingTabs.delete(id);
        chrome.tabs.sendMessage(id, { stop: true }).catch(() => {});
      } else {
        playingTabs.add(id);
        chrome.tabs.sendMessage(id, { play: true }).catch(() => {});
      }
    });
    persistAndNotify();
  },

  // Only stop if tab is LEAVING AI Studio
  stopIfNavigatedAway: (tabId, url) => {
    const isAiStudio = url?.startsWith('https://aistudio.google.com/prompts/new_chat');
    const knownTab = createdTabs.some(t => t.id === tabId);
    if (knownTab && !isAiStudio && playingTabs.delete(tabId)) {
      persistAndNotify();
    }
  },

  getState: () => ({ createdTabs, playingTabs: [...playingTabs] }),

  clearAllTabs: async () => {
    const ids = createdTabs.map(t => t.id);
    createdTabs = [];
    playingTabs.clear();
    await removeStorage(TABS_KEY);
    if (ids.length) chrome.tabs.remove(ids).catch(() => {});
    persistAndNotify();
  },
};