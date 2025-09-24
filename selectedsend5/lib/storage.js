// FILE: selectedsend3/lib/storage.js

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