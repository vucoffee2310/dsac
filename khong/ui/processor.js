// ui/processor.js
import { addClickedCard, clearClickedCards } from '../lib/cardState.js';
import { renderCards } from './renderer.js';
import { PROMPT_PREFIX } from '../lib/promptConfig.js';

const grid = document.getElementById('grid');
const fileInput = document.getElementById('fileInput');
const clearSavedBtn = document.getElementById('clearSaved');
const batchOpenBtn = document.getElementById('batchOpenBtn');
const batchOpenCountInput = document.getElementById('batchOpenCount');
const themeSwitcher = document.getElementById('themeSwitcher');

const themeStorageKey = 'selected-card-theme';

function applyTheme(theme) {
  const root = document.documentElement;
  let effective = theme;
  if (theme === 'system') {
    effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', effective);
  themeSwitcher.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function initTheme() {
  const saved = localStorage.getItem(themeStorageKey) || 'system';
  applyTheme(saved);
  themeSwitcher.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-btn');
    if (btn) {
      localStorage.setItem(themeStorageKey, btn.dataset.theme);
      applyTheme(btn.dataset.theme);
    }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem(themeStorageKey) === 'system') applyTheme('system');
  });
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function openCard(card) {
  if (!card || card.classList.contains('card-clicked')) return;
  card.classList.add('card-clicked');
  const { id, name, content } = card.dataset;
  await addClickedCard(id);
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const modified = PROMPT_PREFIX + JSON.stringify(lines);
  const newTab = await chrome.tabs.create({ url: "https://aistudio.google.com/prompts/new_chat", active: false });
  chrome.runtime.sendMessage({ action: "logTabCreation", payload: { id: newTab.id, cardName: name, cardContent: modified } });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) openCard(card);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      const lines = text.split(/\r?\n/).filter(Boolean);
      renderCards(grid, lines);
    });
  });
  clearSavedBtn.addEventListener('click', async () => {
    await clearClickedCards();
    alert('✅ Cleared all clicked card states.');
    document.querySelectorAll('.card.card-clicked').forEach(c => c.classList.remove('card-clicked'));
  });
  batchOpenBtn.addEventListener('click', async () => {
    const count = parseInt(batchOpenCountInput.value, 10);
    if (isNaN(count) || count <= 0) {
      alert('Enter valid number.'); return;
    }
    const unclicked = grid.querySelectorAll('.card:not(.card-clicked)');
    const toOpen = Array.from(unclicked).slice(0, count);
    if (!toOpen.length) { alert('No unclicked cards.'); return; }
    batchOpenBtn.disabled = true;
    batchOpenCountInput.disabled = true;
    for (const card of toOpen) {
      await openCard(card);
      await wait(200);
    }
    batchOpenBtn.disabled = false;
    batchOpenCountInput.disabled = false;
    batchOpenCountInput.value = '';
  });
});