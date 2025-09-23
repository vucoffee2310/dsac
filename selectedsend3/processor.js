// FILE: selectedsend3/processor.js

const STORAGE_KEY = 'clickedCards_v1';
const LINES_PER_CARD = 200;
const PREVIEW_LINES = 3;

// --- UTILITIES ---
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- STATE & UI ---
function applySavedState() {
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const clickedIds = result[STORAGE_KEY] || {};
    document.querySelectorAll('.card').forEach(card => {
      if (clickedIds[card.dataset.id]) {
        card.classList.add('card-clicked');
      }
    });
  });
}

function renderCards(lines) {
  const grid = document.getElementById('grid');
  grid.innerHTML = ''; // Clear previous content

  if (!lines.length) {
    grid.innerHTML = '<div class="empty-state"><p>No content found in file.</p></div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < lines.length; i += LINES_PER_CARD) {
    const chunk = lines.slice(i, i + LINES_PER_CARD);
    const preview = chunk.slice(0, PREVIEW_LINES).join('\n');
    const index = Math.floor(i / LINES_PER_CARD) + 1;

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = `card_${index}`;
    card.dataset.name = `Card ${index}`;
    card.dataset.content = chunk.join('\n');
    
    const remaining = chunk.length - PREVIEW_LINES;
    const moreHtml = remaining > 0 ? `<small>+${remaining} more</small>` : '';
    const previewHtml = escapeHtml(preview).replace(/\n/g, '<br>') || '<em>(empty)</em>';

    card.innerHTML = `<h3>${card.dataset.name}</h3><pre>${previewHtml}</pre>${moreHtml}`;
    card.addEventListener('click', handleCardClick);
    fragment.appendChild(card);
  }
  grid.appendChild(fragment);
  applySavedState();
}

// --- EVENT HANDLERS ---
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(line => line.trim());
    renderCards(lines);
  };
  reader.readAsText(file, 'UTF-8');
}

function handleCardClick(event) {
  const card = event.currentTarget;
  const { id, name, content } = card.dataset;
  const targetUrl = "https://aistudio.google.com/";

  card.classList.add('card-clicked');
  // Save state optimistically
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const clickedIds = result[STORAGE_KEY] || {};
    clickedIds[id] = true;
    chrome.storage.local.set({ [STORAGE_KEY]: clickedIds });
  });

  chrome.tabs.create({ url: targetUrl }, (newTab) => {
    chrome.runtime.sendMessage({
      action: "logTabCreation",
      payload: { id: newTab.id, url: targetUrl, title: newTab.title, timestamp: Date.now(), cardName: name, cardContent: content }
    });
  });
}

function handleClearSaved() {
  chrome.storage.local.remove(STORAGE_KEY, () => {
    alert('✅ Cleared all clicked card states.');
    document.querySelectorAll('.card.card-clicked').forEach(card => {
      card.classList.remove('card-clicked');
    });
  });
}

// --- INITIALIZATION ---
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('clearSaved').addEventListener('click', handleClearSaved);