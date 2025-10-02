import { getStorage, setStorage, removeStorage } from '../services/storage.js';
const TABS_K = 'createdTabs_v1';
const PLAYING_K = 'playingTabs_v1';
const DEBOUNCE_DELAY = 200; // ms to wait after last event
const THROTTLE_LIMIT = 3000; // ms max wait time between updates

let tabs = [];
let playing = new Set(); // Will be overwritten by storage
let debounceTimeout = null;
let throttleTimeout = null;

(async () => {
  const [savedTabs, savedPlaying] = await Promise.all([
    getStorage(TABS_K),
    getStorage(PLAYING_K)
  ]);
  if (savedTabs) {
    tabs = savedTabs.map(t => ({ ...t, injected: t.injected !== false }));
  }
  if (savedPlaying) {
    playing = new Set(savedPlaying);
  }
})();

const executeNotification = async () => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  if (throttleTimeout) clearTimeout(throttleTimeout);
  debounceTimeout = null;
  throttleTimeout = null;

  try {
    const payload = { createdTabs: tabs, playingTabs: [...playing] };
    const ts = await chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") }).catch(() => []);
    if (ts && ts.length > 0) {
      await Promise.allSettled(ts.map(t => 
        chrome.tabs.sendMessage(t.id, { action: "updateTabState", payload })
          .catch(() => {}) // Ignore individual message failures
      ));
    }
  } catch (e) { 
    // Suppress "No SW" errors during extension reload
    if (!e.message?.includes('No SW')) {
      console.error("Notify failed:", e); 
    }
  }
};

const notify = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(executeNotification, DEBOUNCE_DELAY);

  if (!throttleTimeout) {
    throttleTimeout = setTimeout(executeNotification, THROTTLE_LIMIT);
  }
};

// Save with optional skipNotify parameter
const save = async (skipNotify = false) => {
  try {
    await Promise.all([
      setStorage(TABS_K, tabs),
      setStorage(PLAYING_K, [...playing])
    ]);
    if (!skipNotify) {
      notify();
    }
  } catch (e) {
    // Suppress errors during extension reload
    if (!e.message?.includes('No SW') && !e.message?.includes('Extension context invalidated')) {
      console.error("Save failed:", e);
    }
  }
};

export const tabState = {
  addTab: (p) => { 
    if (!tabs.some(t => t.id === p.id)) { 
      tabs.push({ ...p, injected: false, isComplete: false }); 
      save(); 
    } 
  },
  
  removeTab: (id) => {
    const t = tabs.find(x => x.id === id);
    if (!t) return;
    if (!t.isComplete) {
      Object.assign(t, { 
        isComplete: true, 
        responseText: "[Cancelled: tab closed before completion]", 
        responseTimestamp: new Date().toLocaleString(), 
        cancelled: true 
      });
      save(true).then(() => {
        executeNotification(); 
      }).catch(() => {}); // Handle potential errors silently
      chrome.alarms.create(`cleanup_tab_${id}`, { delayInMinutes: 0.1 }).catch(() => {});
    } else {
      const l = tabs.length;
      const wp = playing.delete(id);
      tabs = tabs.filter(x => x.id !== id);
      if (tabs.length !== l || wp) save();
    }
  },
  
  finalizeRemove: (id) => {
    const i = tabs.findIndex(x => x.id === id);
    if (i !== -1 && tabs[i].cancelled) {
      tabs.splice(i, 1);
      playing.delete(id);
      save();
    }
  },
  
  updateTabResponse: (id, u) => {
    const t = tabs.find(x => x.id === id);
    if (!t) return;
    Object.assign(t, { 
      responseText: u.responseText, 
      responseTimestamp: u.timestamp, 
      isComplete: u.isComplete 
    });

    if (u.isComplete) { 
      playing.delete(id); 
      chrome.tabs.sendMessage(id, { stop: true }).catch(() => {});
      save(true).then(executeNotification).catch(() => {});
    } else {
      save();
    }
  },

  startPlaying: (id) => {
    if (id && !playing.has(id)) {
        playing.add(id);
        chrome.tabs.sendMessage(id, { play: true }).catch(() => {});
        save();
    }
  },
  
  findInjectableTab: (id) => { 
    const t = tabs.find(x => x.id === id && !x.injected); 
    if (t) t.injected = true; 
    return t; 
  },
  
  playTab: (id) => {
    const t = tabs.find(x => x.id === id);
    if (!t) return;

    if (playing.has(id)) {
      playing.delete(id);
      chrome.tabs.sendMessage(id, { stop: true }).catch(() => {});
    } else {
      playing.add(id);
      chrome.tabs.sendMessage(id, { play: true }).catch(() => {});
    }
    save();
  },
  
  playAllTabs: () => {
    const allIds = tabs.map(t => t.id);
    const anyPlaying = allIds.some(id => playing.has(id));
    if (anyPlaying) {
      allIds.forEach(id => {
        playing.delete(id);
        chrome.tabs.sendMessage(id, { stop: true }).catch(() => {});
      });
    } else {
      const incompleteTabs = tabs.filter(t => !t.isComplete);
      incompleteTabs.forEach(t => {
        playing.add(t.id);
        chrome.tabs.sendMessage(t.id, { play: true }).catch(() => {});
      });
    }
    save();
  },
  
  stopIfNavigatedAway: (id, url) => {
    const isAI = url?.startsWith('https://aistudio.google.com/prompts/new_chat');
    const known = tabs.some(t => t.id === id);
    if (known && !isAI && playing.delete(id)) save();
  },
  
  getState: () => ({ createdTabs: tabs, playingTabs: [...playing] }),
  
  clearAllTabs: async () => {
    const ids = tabs.map(t => t.id);
    tabs = []; 
    playing.clear();
    
    try {
      await Promise.all([removeStorage(TABS_K), removeStorage(PLAYING_K)]);
      const allAlarms = await chrome.alarms.getAll();
      const cleanupAlarmNames = allAlarms.filter(a => a.name.startsWith('cleanup_tab_')).map(a => a.name);
      if (cleanupAlarmNames.length > 0) {
        await Promise.all(cleanupAlarmNames.map(name => chrome.alarms.clear(name)));
      }
      if (ids.length) chrome.tabs.remove(ids).catch(() => {});
      save();
    } catch (e) {
      // Suppress errors during extension reload
      if (!e.message?.includes('No SW') && !e.message?.includes('Extension context invalidated')) {
        console.error("Clear tabs failed:", e);
      }
    }
  },
};