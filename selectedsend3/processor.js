// FILE: selectedsend3/processor.js
function escapeHtml(t) {
  let d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

// Unique key for storage
const STORAGE_KEY = 'clickedCards_v1';

// Load saved state and apply to UI
function loadAndApplySavedState() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const saved = result[STORAGE_KEY] || {};
    document.querySelectorAll('.card').forEach(card => {
      const cardId = card.dataset.id;
      if (saved[cardId]) {
        card.classList.add('card-clicked');
      }
    });
  });
}

// Save clicked card state
function saveCardClick(cardId) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const saved = result[STORAGE_KEY] || {};
    saved[cardId] = true;
    chrome.storage.local.set({ [STORAGE_KEY]: saved });
  });
}

document.getElementById('fileInput').addEventListener('change', e => {
  let file = e.target.files[0];
  if (!file) return;

  let reader = new FileReader();
  reader.onload = e => {
    let lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    let grid = document.getElementById('grid');
    grid.innerHTML = '';

    if (!lines.length) {
      grid.innerHTML = '<div class="card"><p class="empty">No content.</p></div>';
      return;
    }

    const L = 200, P = 3;
    for (let i = 0; i < lines.length; i += L) {
      let chunk = lines.slice(i, i + L);
      let preview = chunk.slice(0, P);
      let rem = chunk.length - P;
      let idx = Math.floor(i / L) + 1;

      // Generate unique ID and name per card
      let cardId = `card_${idx}`;
      let cardName = `Card ${idx}`;
      let cardContent = chunk.join('\n');

      let card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = cardId;
      // Store card data on the element itself for easy access on click
      card.dataset.name = cardName;
      card.dataset.content = cardContent;

      let txt = escapeHtml(preview.join('\n')).replace(/\n/g, '<br>') || '<em>(empty)</em>';
      let more = rem > 0 ? `<small>+${rem} more</small>` : '';

      card.innerHTML = `<h3>${cardName}</h3><pre>${txt}</pre>${more}`;

      card.addEventListener('click', () => {
        // Define the target URL here to ensure consistency
        const targetUrl = "https://aistudio.google.com/";
        
        // Create the tab, and in its callback, send the full data to the background script.
        chrome.tabs.create({ url: targetUrl }, (newTab) => {
          card.classList.add('card-clicked');
          saveCardClick(cardId);
          
          // Send detailed info to the background script for monitoring
          chrome.runtime.sendMessage({
            action: "logTabCreation",
            payload: {
              id: newTab.id,
              // FIX: Use the 'targetUrl' we defined, not 'newTab.url' which is unreliable here.
              url: targetUrl, 
              title: newTab.title, // Note: title might also be empty initially for the same reason
              timestamp: Date.now(),
              cardName: card.dataset.name,
              cardContent: card.dataset.content
            }
          });
        });
      });

      grid.appendChild(card);
    }

    // Apply saved states after rendering
    loadAndApplySavedState();
  };

  reader.readAsText(file, 'UTF-8');
});

// Apply saved state on initial page load (if cards rendered before JS runs)
document.addEventListener('DOMContentLoaded', loadAndApplySavedState);

// Clear saved state button
document.getElementById('clearSaved')?.addEventListener('click', () => {
  chrome.storage.local.remove(STORAGE_KEY, () => {
    alert('✅ Cleared all clicked card states.');
    document.querySelectorAll('.card').forEach(card => {
      card.classList.remove('card-clicked');
    });
  });
});