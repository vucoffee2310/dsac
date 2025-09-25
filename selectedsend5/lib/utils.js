import { getClickedCards } from './state.js';

// --- Utilities ---
// This is already concise and secure. No changes needed.
export const escapeHtml = (text = '') => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// This pattern is standard and already optimized. No changes needed.
export const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(link).click();
    link.remove(); // .remove() is a modern alternative to parentNode.removeChild(child)
    URL.revokeObjectURL(url);
};

// --- File Handling ---
// Using a guard clause to exit early if no file is present.
export async function handleFileSelect(event, onFileParsed) {
  const file = event.target.files?.[0];
  if (!file) return;

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  onFileParsed(lines);
}

// --- Card Rendering ---
// Replaced the for-loop with a more functional approach using Array.from and map.
export async function renderCards(gridElement, lines, linesPerCard = 200) {
  if (!lines.length) {
    gridElement.innerHTML = '<div class="placeholder"><p>No content in file.</p></div>';
    return;
  }
  
  const numCards = Math.ceil(lines.length / linesPerCard);
  gridElement.innerHTML = Array.from({ length: numCards }, (_, i) => {
    const chunk = lines.slice(i * linesPerCard, (i + 1) * linesPerCard);
    const index = i + 1;
    const preview = chunk.slice(0, 3).join('\n');
    const remaining = Math.max(0, chunk.length - 3);
    return `
      <div class="card" data-id="card_${index}" data-name="${index}" data-content="${escapeHtml(chunk.join('\n'))}">
        <h3>${index}</h3>
        <pre>${escapeHtml(preview) || '<em>(empty)</em>'}</pre>
        ${remaining > 0 ? `<small>+${remaining} more</small>` : ''}
      </div>`;
  }).join('');

  const clickedIds = await getClickedCards();
  Object.keys(clickedIds).forEach(cardId => {
    gridElement.querySelector(`[data-id="${cardId}"]`)?.classList.add('card-clicked');
  });
}

// --- Monitor Rendering ---
// Combined helpers into the main function for locality, but kept separate for clarity in this refactor.
// The original structure is good, so changes are minimal.
const createMonitorEntryHtml = (tab, isPlaying) => `
  <div class="monitor-entry ${isPlaying ? 'playing' : ''} ${tab.isComplete ? 'is-complete' : ''}" data-tab-id="${tab.id}">
    <div class="monitor-entry-header">
      <p><strong>${escapeHtml(tab.cardName ?? 'N/A')}</strong><span class="completion-status">✅</span></p>
      <div class="monitor-buttons">
        <button class="btn btn-play" data-tooltip="${isPlaying ? "Stop Audio" : "Play Audio"}">${isPlaying ? '⏹️' : '▶️'}</button>
        <button class="btn btn-download" data-tooltip="Download JSON">📥</button>
      </div>
    </div>
    <details><summary>View Original Prompt</summary><pre>${escapeHtml(tab.cardContent ?? '(No content)')}</pre></details>
    <div class="response-area">
      ${tab.responseText 
        ? `<details><summary>View AI Response</summary><div class="monitor-response"><h4>AI Response <small>(${tab.responseTimestamp})</small></h4><pre>${escapeHtml(tab.responseText)}</pre></div></details>`
        : `<div class="monitor-response-placeholder"><p>🤖 Response pending...</p></div>`
      }
    </div>
  </div>`;

const updateMonitorEntry = (entry, tab, isPlaying) => {
  entry.classList.toggle('playing', isPlaying);
  entry.classList.toggle('is-complete', tab.isComplete);
  const playBtn = entry.querySelector('.btn-play');
  playBtn.textContent = isPlaying ? '⏹️' : '▶️';
  playBtn.dataset.tooltip = isPlaying ? 'Stop Audio' : 'Play Audio'; // Use .dataset

  const responseArea = entry.querySelector('.response-area');
  const placeholderEl = responseArea.querySelector('.monitor-response-placeholder');

  // If the placeholder exists but we now have response text, replace the whole area.
  if (placeholderEl && tab.responseText) {
      responseArea.innerHTML = `<details><summary>View AI Response</summary><div class="monitor-response"><h4>AI Response <small>(${tab.responseTimestamp})</small></h4><pre>${escapeHtml(tab.responseText)}</pre></div></details>`;
  } 
  // Otherwise, if the response area is already populated, just update the text content.
  else if (!placeholderEl && tab.responseText) {
      const pre = responseArea.querySelector('pre');
      const small = responseArea.querySelector('small');
      if (pre) pre.textContent = tab.responseText;
      if (small) small.textContent = `(${tab.responseTimestamp})`;
  }
};

// Simplified the DOM reconciliation loop slightly.
export function renderMonitor(state, container, playAllBtn, downloadAllBtn, clearAllBtn, progress) {
    const { createdTabs, playingTabs } = state;
    const total = createdTabs?.length || 0;
    const finished = createdTabs?.filter(t => t.isComplete).length || 0;
    const hasTabs = total > 0;

    // Update Header
    [playAllBtn, downloadAllBtn, clearAllBtn].forEach(btn => btn.disabled = !hasTabs);
    progress.textContent = hasTabs ? `Progress: ${finished} / ${total} completed` : 'Awaiting jobs...';
    
    const placeholder = container.querySelector('.placeholder');
    if (placeholder) {
      placeholder.style.display = hasTabs ? 'none' : 'block';
    }

    // DOM Reconciliation
    const playingSet = new Set(playingTabs);
    const existingEntries = new Map(Array.from(container.querySelectorAll('.monitor-entry'), el => [el.dataset.tabId, el]));

    // Iterate state to update/create DOM nodes
    [...createdTabs].reverse().forEach(tab => {
        const tabIdStr = String(tab.id);
        const entry = existingEntries.get(tabIdStr);
        const isPlaying = playingSet.has(tab.id);

        if (entry) {
            updateMonitorEntry(entry, tab, isPlaying);
            existingEntries.delete(tabIdStr); // Mark as processed
        } else {
            container.insertAdjacentHTML('afterbegin', createMonitorEntryHtml(tab, isPlaying));
        }
    });

    // Remove stale entries that are no longer in the state
    existingEntries.forEach(staleEntry => staleEntry.remove());
}