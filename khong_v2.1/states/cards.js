// state/cards.js
import { getStorage, setStorage, removeStorage } from '../services/storage.js';

const KEY = 'clickedCards_v1';

export const getClickedCards = () => getStorage(KEY).then(v => v ?? {});

export const addClickedCard = async (cardId) => {
  const clicked = await getClickedCards();
  clicked[cardId] = true;
  return setStorage(KEY, clicked);
};

export const clearClickedCards = () => removeStorage(KEY);