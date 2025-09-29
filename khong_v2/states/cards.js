import { getStorage, setStorage, removeStorage } from '../services/storage.js';
const CLICKED_K = 'clickedCards_v1';
const CARDS_K = 'cardData_v1';

// --- Functions for CLICKED state ---
export const getClickedCards = () => getStorage(CLICKED_K).then(v => v ?? {});
export const addClickedCard = async (id) => { const c = await getClickedCards(); c[id] = true; return setStorage(CLICKED_K, c); };

// --- Functions for CARD DATA itself ---
export const getSavedCards = () => getStorage(CARDS_K).then(v => v ?? []);
export const saveCards = (cardObjects) => setStorage(CARDS_K, cardObjects);

// --- NEW function to remove a single card and its state ---
export const removeSingleCard = async (cardIdToRemove) => {
  const [cards, clicked] = await Promise.all([getSavedCards(), getClickedCards()]);

  const updatedCards = cards.filter(c => c.id !== cardIdToRemove);
  delete clicked[cardIdToRemove];

  await Promise.all([
    setStorage(CARDS_K, updatedCards),
    setStorage(CLICKED_K, clicked)
  ]);

  return updatedCards; // Return the new list for re-rendering
};


// --- Combined Clear Function ---
// This will now clear both the card data and the clicked state, fully resetting the processor panel.
export const clearAllCardState = () => Promise.all([
  removeStorage(CLICKED_K),
  removeStorage(CARDS_K)
]);