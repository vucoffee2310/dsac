import { addClickedCard, clearClickedCards } from '../states/cards.js';
import { renderCards } from './renderer.js';
import { PROMPT_PREFIX } from '../services/promptConfig.js';

const g = document.getElementById('grid'), f = document.getElementById('fileInput'),
      clr = document.getElementById('clearSaved'), batchBtn = document.getElementById('batchOpenBtn'),
      batchIn = document.getElementById('batchOpenCount'), themeEl = document.getElementById('themeSwitcher'),
      themeKey = 'selected-card-theme';

// Store card content in memory for the session, not in chrome.storage
let cardLines = [];

const applyTheme = t => {
  const root = document.documentElement, eff = t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
  root.setAttribute('data-theme', eff);
  themeEl.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
};

const initTheme = () => {
  const s = localStorage.getItem(themeKey) || 'system';
  applyTheme(s);
  themeEl.addEventListener('click', e => {
    const b = e.target.closest('.theme-btn');
    if (b) { localStorage.setItem(themeKey, b.dataset.theme); applyTheme(b.dataset.theme); }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => localStorage.getItem(themeKey) === 'system' && applyTheme('system'));
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

  // The page will now start with the placeholder, awaiting a file upload.
  // The logic to restore cards from chrome.storage has been removed.

  g.addEventListener('click', e => { const c = e.target.closest('.card'); c && openCard(c); });

  f.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const txt = await file.text();
    // Store lines in the module-level variable instead of chrome.storage
    cardLines = txt.split(/\r?\n/).filter(Boolean);
    renderCards(g, cardLines);
  });

  clr.addEventListener('click', async () => {
    await clearClickedCards();
    alert('✅ Cleared all clicked card states.');
    document.querySelectorAll('.card.card-clicked').forEach(c => c.classList.remove('card-clicked'));
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