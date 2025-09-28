export const getStorage = async (k) => { const r = await chrome.storage.local.get(k); return r[k]; };
export const setStorage = (k, v) => chrome.storage.local.set({ [k]: v });
export const removeStorage = (k) => chrome.storage.local.remove(k);