import { getStorage, setStorage, removeStorage } from '../services/storage.js';

const K = 'createdTabs_v1';
let tabs = [];
const playing = new Set();

(async () => {
  const s = await getStorage(K);
  if (s) tabs = s.map(t => ({ ...t, injected: t.injected !== false }));
})();

let saveTimeout = null;
const DEBOUNCE_DELAY = 2000;

const debouncedSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await setStorage(K, tabs);
    } catch (e) {
      console.error("Failed to persist tabs state:", e);
    }
  }, DEBOUNCE_DELAY);
};

const notify = async (payload) => {
  try {
    const processorTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") });
    await Promise.allSettled(
      processorTabs.map(t => chrome.tabs.sendMessage(t.id, { action: "updateTabState", payload }))
    );
  } catch (e) {
    console.error("Notify failed:", e);
  }
};

const notifyTabAdded = (tab) => notify({ type: 'tabAdded', tab });
const notifyTabUpdated = (tab) => notify({ type: 'tabUpdated', tab });
const notifyTabRemoved = (tabId) => notify({ type: 'tabRemoved', tabId });
const notifyPlayStateChanged = () => notify({ type: 'playStateChanged', playingTabs: [...playing] });
const notifyCleared = () => notify({ type: 'cleared' });

export const tabState = {
  addTab: (payload) => {
    if (!tabs.some(t => t.id === payload.id)) {
      const newTab = { ...payload, injected: false, isComplete: false };
      tabs.push(newTab);
      notifyTabAdded(newTab);
      debouncedSave();
    }
  },

  removeTab: (id) => {
    const existing = tabs.find(x => x.id === id);
    if (!existing) return;

    if (!existing.isComplete) {
      Object.assign(existing, {
        isComplete: true,
        responseText: "[Cancelled: tab closed before completion]",
        responseTimestamp: new Date().toLocaleString(),
        cancelled: true
      });
      notifyTabUpdated(existing);
      debouncedSave();

      setTimeout(() => {
        const idx = tabs.findIndex(x => x.id === id);
        if (idx !== -1 && tabs[idx].cancelled) {
          tabs.splice(idx, 1);
          playing.delete(id);
          notifyTabRemoved(id);
          debouncedSave();
        }
      }, 5000);
    } else {
      const wasPlaying = playing.delete(id);
      tabs = tabs.filter(x => x.id !== id);
      notifyTabRemoved(id);
      if (wasPlaying) notifyPlayStateChanged();
      debouncedSave();
    }
  },

  updateTabResponse: (id, update) => {
    const tab = tabs.find(x => x.id === id);
    if (!tab) return;

    Object.assign(tab, {
      responseText: update.responseText,
      responseTimestamp: update.timestamp,
      isComplete: update.isComplete
    });

    if (update.isComplete && playing.has(id)) {
      playing.delete(id);
      chrome.tabs.sendMessage(id, { stop: true }).catch(() => {});
      notifyPlayStateChanged();
    }

    notifyTabUpdated(tab);
    debouncedSave();
  },

  findInjectableTab: (id) => {
    const tab = tabs.find(x => x.id === id && !x.injected);
    if (tab) tab.injected = true;
    return tab;
  },

  playTab: (id) => {
    if (playing.has(id)) {
      playing.delete(id);
      chrome.tabs.sendMessage(id, { stop: true }).catch(() => {});
    } else {
      playing.add(id);
      chrome.tabs.sendMessage(id, { play: true }).catch(() => {});
    }
    notifyPlayStateChanged();
    debouncedSave();
  },

  playAllTabs: () => {
    const ids = tabs.map(t => t.id);
    if (ids.length === 0) return;

    const anyPlaying = ids.some(id => playing.has(id));
    ids.forEach(id => {
      if (anyPlaying) {
        playing.delete(id);
        chrome.tabs.sendMessage(id, { stop: true }).catch(() => {});
      } else {
        playing.add(id);
        chrome.tabs.sendMessage(id, { play: true }).catch(() => {});
      }
    });
    notifyPlayStateChanged();
    debouncedSave();
  },

  stopIfNavigatedAway: (id, url) => {
    const cleanUrl = url?.trim();
    const isAIStudio = cleanUrl?.startsWith('https://aistudio.google.com/prompts/new_chat');
    const knownTab = tabs.some(t => t.id === id);

    if (knownTab && !isAIStudio && playing.delete(id)) {
      notifyPlayStateChanged();
      debouncedSave();
    }
  },

  getState: () => ({ createdTabs: tabs, playingTabs: [...playing] }),

  clearAllTabs: async () => {
    const ids = tabs.map(t => t.id);
    tabs = [];
    playing.clear();
    await removeStorage(K);
    notifyCleared();

    if (ids.length) {
      chrome.tabs.remove(ids).catch(() => {});
    }
  },
};