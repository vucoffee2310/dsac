import { addClickedCard, getSavedCards, saveCards, clearAllCardState, removeSingleCard } from '../states/cards.js';
import { renderCards } from './renderer.js';
import { PROMPT_PREFIX } from '../services/promptConfig.js';

const g = document.getElementById('grid'), f = document.getElementById('fileInput'),
      clr = document.getElementById('clearSaved'), batchBtn = document.getElementById('batchOpenBtn'),
      batchIn = document.getElementById('batchOpenCount'), themeEl = document.getElementById('themeSwitcher'),
      themeKey = 'selected-card-theme';

// --- Helper functions to access chrome.storage.local for the theme ---
const getStorage = async (k) => (await chrome.storage.local.get(k))[k];
const setStorage = (k, v) => chrome.storage.local.set({ [k]: v });

const applyTheme = t => {
  const root = document.documentElement, eff = t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
  root.setAttribute('data-theme', eff);
  themeEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
};

const initTheme = async () => {
  const s = await getStorage(themeKey) || 'system';
  applyTheme(s);
  
  themeEl.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.theme) {
      await setStorage(themeKey, b.dataset.theme);
      applyTheme(b.dataset.theme);
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const currentTheme = await getStorage(themeKey) || 'system';
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
};

const w = ms => new Promise(r => setTimeout(r, ms));

const openCard = async card => {
  if (!card || card.classList.contains('card-clicked')) return;
  card.classList.add('card-clicked');
  const { id, name, content } = card.dataset;
  await addClickedCard(id);
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const mod = PROMPT_PREFIX + JSON.stringify(lines);
  const tab = await chrome.tabs.create({ url: "https://aistudio.google.com/prompts/new_chat", active: false });
  chrome.runtime.sendMessage({
    action: "logTabCreation",
    payload: { 
        id: tab.id, 
        cardId: id, // <-- ADDED: Pass the card's unique ID
        cardName: name, 
        originalCardContent: content, 
        cardContent: mod 
    }
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  const savedCardsData = await getSavedCards();
  if (savedCardsData && savedCardsData.length > 0) {
    renderCards(g, savedCardsData);
  }

  g.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.btn-delete-card');
    if (deleteBtn) {
      e.stopPropagation(); // Prevent card from opening
      const card = e.target.closest('.card');
      if (card && confirm(`Are you sure you want to delete card ${card.dataset.name}?`)) {
        const updatedCards = await removeSingleCard(card.dataset.id);
        renderCards(g, updatedCards); // Re-render the grid with the modified data
      }
      return;
    }
    const cardToOpen = e.target.closest('.card');
    if (cardToOpen) openCard(cardToOpen);
  });

  f.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const txt = await file.text();
    const allLines = txt.split(/\r?\n/).filter(Boolean);
    
    const per = 150;
    const numChunks = Math.ceil(allLines.length / per);
    const cardObjects = Array.from({ length: numChunks }, (_, i) => {
      const chunkLines = allLines.slice(i * per, (i + 1) * per);
      const idx = i + 1;
      return { id: `card_${idx}`, name: `${idx}`, content: chunkLines.join('\n') };
    });
    
    await saveCards(cardObjects);
    renderCards(g, cardObjects);
  });

  clr.addEventListener('click', async () => {
    await clearAllCardState();
    alert('✅ Cleared all card data and clicked states.');
    renderCards(g, []);
  });

  batchBtn.addEventListener('click', async () => {
    const n = parseInt(batchIn.value, 10);
    if (isNaN(n) || n <= 0) return alert('Enter valid number.');
    const unclicked = [...g.querySelectorAll('.card:not(.card-clicked)')].slice(0, n);
    if (!unclicked.length) return alert('No unclicked cards.');
    batchBtn.disabled = true; batchIn.disabled = true;
    for (const c of unclicked) { await openCard(c); await w(200); }
    batchBtn.disabled = false; batchIn.disabled = false; batchIn.value = '';
  });

  document.addEventListener('openNextCard', async () => {
    const nextCard = g.querySelector('.card:not(.card-clicked)');
    if (nextCard) {
      await openCard(nextCard);
      await w(200);
    } else {
      console.log("Automation chain stopped: No unclicked cards left.");
    }
  });

  // --- NEW: Automation chain listener for cleanup ---
  document.addEventListener('removeProcessedCard', async (e) => {
    const { cardId } = e.detail;
    if (cardId) {
      const updatedCards = await removeSingleCard(cardId);
      renderCards(g, updatedCards);
    }
  });
});