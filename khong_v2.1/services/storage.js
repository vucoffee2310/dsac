// lib/storage.js
export const getStorage = async (key) => {
  const result = await chrome.storage.local.get(key);
  return result[key];
};

export const setStorage = (key, value) => chrome.storage.local.set({ [key]: value });

export const removeStorage = (key) => chrome.storage.local.remove(key);