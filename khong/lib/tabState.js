// lib/tabState.js
import { getStorage, setStorage, removeStorage } from './storage.js';

const TABS_KEY = 'createdTabs_v1';

let createdTabs = [];
const playingTabs = new Set();

// Rehydrate on load
(async () => {
  const saved = await getStorage(TABS_KEY);
  if (saved) {
    createdTabs = saved.map(t => ({ ...t, injected: t.injected !== false }));
  }
})();

const persistAndNotify = async () => {
  await setStorage(TABS_KEY, createdTabs);
  try {
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") });
    const payload = { createdTabs: [...createdTabs], playingTabs: [...playingTabs] };
    await Promise.allSettled(
      tabs.map(tab => chrome.tabs.sendMessage(tab.id, { action: "updateTabState", payload }))
    );
  } catch (e) {
    console.error("Notify processor tabs failed:", e);
  }
};

export const tabState = {
  addTab: (payload) => {
    if (!createdTabs.some(t => t.id === payload.id)) {
      createdTabs.push({ ...payload, injected: false, isComplete: false });
      persistAndNotify();
    }
  },
  removeTab: (tabId) => {
    const initial = createdTabs.length;
    const wasPlaying = playingTabs.delete(tabId);
    createdTabs = createdTabs.filter(t => t.id !== tabId);
    if (createdTabs.length < initial || wasPlaying) persistAndNotify();
  },
  updateTabResponse: (tabId, updates) => {
    const tab = createdTabs.find(t => t.id === tabId);
    if (tab) {
      Object.assign(tab, {
        responseText: updates.responseText,
        responseTimestamp: updates.timestamp,
        isComplete: updates.isComplete
      });
      persistAndNotify();
    }
  },
  findInjectableTab: (tabId) => {
    const tab = createdTabs.find(t => t.id === tabId && !t.injected);
    if (tab) {
      tab.injected = true;
      // Optional: persist injected state if needed
    }
    return tab;
  },
  playTab: (tabId) => {
    playingTabs.clear();
    playingTabs.add(tabId);
    chrome.tabs.sendMessage(tabId, { play: true }).catch(() => {});
    persistAndNotify();
  },
  playAllTabs: () => {
    playingTabs.clear();
    createdTabs.forEach(tab => {
      playingTabs.add(tab.id);
      chrome.tabs.sendMessage(tab.id, { play: true }).catch(() => {});
    });
    persistAndNotify();
  },
  stopPlayingOnLoad: (tabId) => {
    if (playingTabs.delete(tabId)) persistAndNotify();
  },
  getState: () => ({ createdTabs, playingTabs: [...playingTabs] }),
  clearAllTabs: async () => {
    const ids = createdTabs.map(t => t.id);
    createdTabs = [];
    playingTabs.clear();
    await removeStorage(TABS_KEY);
    if (ids.length) {
      await chrome.tabs.remove(ids).catch(e => console.log("Tabs may be closed:", e.message));
    }
    persistAndNotify();
  },
};