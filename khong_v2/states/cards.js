import { getStorage, setStorage, removeStorage } from '../services/storage.js';
const CLICKED_K = 'clickedCards_v1';
const CARDS_K = 'cardData_v1';

// --- Functions for CLICKED state ---
export const getClickedCards = () => getStorage(CLICKED_K).then(v => v ?? {});
export const addClickedCard = async (id) => { const c = await getClickedCards(); c[id] = true; return setStorage(CLICKED_K, c); };

// --- Functions for CARD DATA itself ---
export const getSavedCards = () => getStorage(CARDS_K).then(v => v ?? []);
export const saveCards = (lines) => setStorage(CARDS_K, lines);

// --- Combined Clear Function ---
// This will now clear both the card data and the clicked state, fully resetting the processor panel.
export const clearAllCardState = () => Promise.all([
  removeStorage(CLICKED_K),
  removeStorage(CARDS_K)
]);