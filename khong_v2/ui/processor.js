import { addClickedCard, getSavedCards, saveCards, clearAllCardState, removeSingleCard } from '../states/cards.js';
import { renderCards } from './renderer.js';
import { PROMPT_PREFIX } from '../services/promptConfig.js';

const g = document.getElementById('grid'), f = document.getElementById('fileInput'),
      clr = document.getElementById('clearSaved'), batchBtn = document.getElementById('batchOpenBtn'),
      batchIn = document.getElementById('batchOpenCount'), themeEl = document.getElementById('themeSwitcher'),
      themeKey = 'selected-card-theme';

// Configuration Modal Elements
const configModal = document.getElementById('configModal');
const closeConfigModal = document.getElementById('closeConfigModal');
const cancelConfigBtn = document.getElementById('cancelConfigBtn');
const confirmConfigBtn = document.getElementById('confirmConfigBtn');
const customPromptSection = document.getElementById('customPromptSection');
const customPromptInput = document.getElementById('customPromptInput');

// Store file temporarily while config is open
let pendingFile = null;

// Storage keys for configuration
const CONFIG_KEYS = {
  contentFormat: 'config_contentFormat',
  promptSource: 'config_promptSource',
  customPrompt: 'config_customPrompt'
};

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

// --- Configuration Modal Functions ---
const loadConfigState = async () => {
  const [contentFormat, promptSource, customPrompt] = await Promise.all([
    getStorage(CONFIG_KEYS.contentFormat),
    getStorage(CONFIG_KEYS.promptSource),
    getStorage(CONFIG_KEYS.customPrompt)
  ]);

  // Set radio buttons
  document.querySelector(`input[name="contentFormat"][value="${contentFormat || 'original'}"]`).checked = true;
  document.querySelector(`input[name="promptSource"][value="${promptSource || 'file'}"]`).checked = true;
  
  // Set custom prompt if exists
  if (customPrompt) {
    customPromptInput.value = customPrompt;
  }

  // Show/hide custom prompt section
  customPromptSection.style.display = (promptSource === 'custom') ? 'block' : 'none';
};

const saveConfigState = async () => {
  const contentFormat = document.querySelector('input[name="contentFormat"]:checked').value;
  const promptSource = document.querySelector('input[name="promptSource"]:checked').value;
  const customPrompt = customPromptInput.value;

  await Promise.all([
    setStorage(CONFIG_KEYS.contentFormat, contentFormat),
    setStorage(CONFIG_KEYS.promptSource, promptSource),
    setStorage(CONFIG_KEYS.customPrompt, customPrompt)
  ]);

  return { contentFormat, promptSource, customPrompt };
};

const openConfigModal = () => {
  loadConfigState();
  configModal.style.display = 'flex';
};

const closeConfigModalFn = () => {
  configModal.style.display = 'none';
  pendingFile = null;
  f.value = ''; // Reset file input
};

// --- File Processing Functions ---
const formatContent = (lines, contentFormat) => {
  if (contentFormat === 'array') {
    return '```\n' + JSON.stringify(lines) + '\n```';
  }
  return lines.join('\n');
};

const getPromptPrefix = async (promptSource, customPrompt) => {
  if (promptSource === 'custom' && customPrompt) {
    return customPrompt;
  }
  return PROMPT_PREFIX;
};

const processFile = async (file, config) => {
  const txt = await file.text();
  const allLines = txt.split(/\r?\n/).filter(Boolean);
  
  const per = 150;
  const numChunks = Math.ceil(allLines.length / per);
  
  const promptPrefix = await getPromptPrefix(config.promptSource, config.customPrompt);
  
  const cardObjects = Array.from({ length: numChunks }, (_, i) => {
    const chunkLines = allLines.slice(i * per, (i + 1) * per);
    const idx = i + 1;
    
    // Format the content based on user preference
    const formattedContent = formatContent(chunkLines, config.contentFormat);
    
    // Combine prompt prefix with formatted content
    const finalContent = config.contentFormat === 'array' 
      ? `${promptPrefix}\n${formattedContent}`
      : formattedContent;
    
    return { 
      id: `card_${idx}`, 
      name: `${idx}`, 
      content: finalContent,
      originalLines: chunkLines // Store original for reference
    };
  });
  
  await saveCards(cardObjects);
  renderCards(g, cardObjects);
};

const w = ms => new Promise(r => setTimeout(r, ms));

const openCard = async card => {
  if (!card || card.classList.contains('card-clicked')) return;
  card.classList.add('card-clicked');
  const { id, name, content } = card.dataset;
  await addClickedCard(id);
  
  // Get current config to determine if we need additional formatting
  const config = {
    contentFormat: await getStorage(CONFIG_KEYS.contentFormat) || 'original',
    promptSource: await getStorage(CONFIG_KEYS.promptSource) || 'file',
    customPrompt: await getStorage(CONFIG_KEYS.customPrompt) || ''
  };
  
  const promptPrefix = await getPromptPrefix(config.promptSource, config.customPrompt);
  
  // If using array format and prompt from file, ensure proper structure
  const finalContent = config.contentFormat === 'array' && config.promptSource === 'file'
    ? content // Already formatted during processing
    : content;
  
  const tab = await chrome.tabs.create({ url: "https://aistudio.google.com/prompts/new_chat", active: false });
  chrome.runtime.sendMessage({
    action: "logTabCreation",
    payload: { 
        id: tab.id, 
        cardId: id,
        cardName: name, 
        originalCardContent: content,
        cardContent: finalContent
    }
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  const savedCardsData = await getSavedCards();
  if (savedCardsData && savedCardsData.length > 0) {
    renderCards(g, savedCardsData);
  }

  // --- Configuration Modal Listeners ---
  document.querySelectorAll('input[name="promptSource"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      customPromptSection.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  });

  closeConfigModal.addEventListener('click', closeConfigModalFn);
  cancelConfigBtn.addEventListener('click', closeConfigModalFn);
  
  confirmConfigBtn.addEventListener('click', async () => {
    if (!pendingFile) {
      closeConfigModalFn();
      return;
    }

    const config = await saveConfigState();
    configModal.style.display = 'none';
    
    await processFile(pendingFile, config);
    
    pendingFile = null;
    f.value = '';
  });

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === configModal) {
      closeConfigModalFn();
    }
  });

  // --- File Input Handler ---
  f.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    pendingFile = file;
    openConfigModal();
  });

  // --- Card Grid Handlers ---
  g.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.btn-delete-card');
    if (deleteBtn) {
      e.stopPropagation();
      const card = e.target.closest('.card');
      if (card && confirm(`Are you sure you want to delete card ${card.dataset.name}?`)) {
        const updatedCards = await removeSingleCard(card.dataset.id);
        renderCards(g, updatedCards);
      }
      return;
    }
    const cardToOpen = e.target.closest('.card');
    if (cardToOpen) openCard(cardToOpen);
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

  document.addEventListener('removeProcessedCard', async (e) => {
    const { cardId } = e.detail;
    if (cardId) {
      const updatedCards = await removeSingleCard(cardId);
      renderCards(g, updatedCards);
    }
  });
});