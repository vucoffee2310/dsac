import { addClickedCard, getSavedCards, saveCards, clearAllCardState } from '../states/cards.js';
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
  // FIX: Select all buttons directly within the theme element, not by a specific class
  themeEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
};

const initTheme = async () => {
  // Read from chrome.storage.local (profile-specific)
  const s = await getStorage(themeKey) || 'system';
  applyTheme(s);
  
  themeEl.addEventListener('click', async (e) => {
    // FIX: Find the closest 'button' element, not '.theme-btn'
    const b = e.target.closest('button');
    if (b && b.dataset.theme) { // Ensure the button has a theme
      // Write to chrome.storage.local
      await setStorage(themeKey, b.dataset.theme);
      applyTheme(b.dataset.theme);
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    // Check chrome.storage.local before applying system theme change
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
  // Send both original and modified content for full transparency
  chrome.runtime.sendMessage({
    action: "logTabCreation",
    payload: {
      id: tab.id,
      cardName: name,
      originalCardContent: content, // The raw, original content
      cardContent: mod // The transformed prompt sent to the AI
    }
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  // --- Restore cards from storage on page load ---
  const savedLines = await getSavedCards();
  if (savedLines && savedLines.length > 0) {
    renderCards(g, savedLines);
  }

  g.addEventListener('click', e => { const c = e.target.closest('.card'); c && openCard(c); });

  f.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const txt = await file.text();
    const cardLines = txt.split(/\r?\n/).filter(Boolean);
    
    // --- Save the parsed card data to storage ---
    await saveCards(cardLines);
    
    renderCards(g, cardLines);
  });

  clr.addEventListener('click', async () => {
    // --- Use the combined clear function ---
    await clearAllCardState();
    alert('✅ Cleared all card data and clicked states.');
    // Re-render the grid to show the placeholder
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
});