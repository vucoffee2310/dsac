import { getStorage, setStorage, removeStorage } from '../services/storage.js';
const K = 'createdTabs_v1';
let tabs = [];
const playing = new Set();
(async () => { const s = await getStorage(K); if (s) tabs = s.map(t => ({ ...t, injected: t.injected !== false })); })();
const notify = async (p) => {
  try {
    const ts = await chrome.tabs.query({ url: chrome.runtime.getURL("processor.html") });
    await Promise.allSettled(ts.map(t => chrome.tabs.sendMessage(t.id, { action: "updateTabState", payload: p })));
  } catch (e) { console.error("Notify failed:", e); }
};
const save = async () => { await setStorage(K, tabs); notify({ createdTabs: tabs, playingTabs: [...playing] }); };
export const tabState = {
  addTab: (p) => { if (!tabs.some(t => t.id === p.id)) { tabs.push({ ...p, injected: false, isComplete: false }); save(); } },
  removeTab: (id) => {
    const t = tabs.find(x => x.id === id);
    if (!t) return;
    if (!t.isComplete) {
      Object.assign(t, { isComplete: true, responseText: "[Cancelled: tab closed before completion]", responseTimestamp: new Date().toLocaleString(), cancelled: true });
      save();
      // Use chrome.alarms for reliable delayed removal instead of setTimeout
      chrome.alarms.create(`cleanup_tab_${id}`, { delayInMinutes: 0.1 }); // ~6 seconds
    } else {
      const l = tabs.length;
      const wp = playing.delete(id);
      tabs = tabs.filter(x => x.id !== id);
      if (tabs.length !== l || wp) save();
    }
  },
  // New function to be called by the background script's alarm listener
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
    Object.assign(t, { responseText: u.responseText, responseTimestamp: u.timestamp, isComplete: u.isComplete });
    if (u.isComplete && playing.has(id)) { playing.delete(id); chrome.tabs.sendMessage(id, { stop: true }).catch(() => {}); }
    save();
  },
  findInjectableTab: (id) => { const t = tabs.find(x => x.id === id && !x.injected); if (t) t.injected = true; return t; },
  playTab: (id) => {
    if (playing.has(id)) { playing.delete(id); chrome.tabs.sendMessage(id, { stop: true }).catch(() => {}); }
    else { playing.add(id); chrome.tabs.sendMessage(id, { play: true }).catch(() => {}); }
    save();
  },
  playAllTabs: () => {
    const ids = tabs.map(t => t.id);
    const any = ids.some(id => playing.has(id));
    ids.forEach(id => {
      if (any) { playing.delete(id); chrome.tabs.sendMessage(id, { stop: true }).catch(() => {}); }
      else { playing.add(id); chrome.tabs.sendMessage(id, { play: true }).catch(() => {}); }
    });
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
    tabs = []; playing.clear(); await removeStorage(K);
    // Also clear any pending cleanup alarms to prevent them from running later
    const allAlarms = await chrome.alarms.getAll();
    const cleanupAlarmNames = allAlarms.filter(a => a.name.startsWith('cleanup_tab_')).map(a => a.name);
    if (cleanupAlarmNames.length > 0) {
      await chrome.alarms.clear(cleanupAlarmNames);
    }
    if (ids.length) chrome.tabs.remove(ids).catch(() => {});
    save();
  },
};