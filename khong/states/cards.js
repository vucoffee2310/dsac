import { getStorage, setStorage, removeStorage } from '../services/storage.js';
const K = 'clickedCards_v1';
export const getClickedCards = () => getStorage(K).then(v => v ?? {});
export const addClickedCard = async (id) => { const c = await getClickedCards(); c[id] = true; return setStorage(K, c); };
export const clearClickedCards = () => removeStorage(K);