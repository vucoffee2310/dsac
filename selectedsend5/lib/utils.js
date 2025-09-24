import { getClickedCards } from './state.js';

// --- Core Utilities ---
export const escapeHtml = (text = '') => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const downloadJSON = (data, filename) => {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};


// --- File Handling ---
export function handleFileSelect(event, onFileParsed) {
  const file = event.target.files[0];
  if (file) {
    file.text().then(text => {
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      onFileParsed(lines);
    });
  }
}


// --- Rendering Functions ---

// For card grid
const LINES_PER_CARD = 200;
const PREVIEW_LINES = 3;

export async function renderCards(gridElement, lines) {
  if (!lines.length) {
    gridElement.innerHTML = '<div class="placeholder"><p>No content found in file.</p></div>';
    return;
  }
  
  const cardsHtml = [];
  for (let i = 0; i < lines.length; i += LINES_PER_CARD) {
    const chunk = lines.slice(i, i + LINES_PER_CARD);
    const index = Math.floor(i / LINES_PER_CARD) + 1;
    const preview = chunk.slice(0, PREVIEW_LINES).join('\n');
    const remaining = chunk.length - PREVIEW_LINES;
    cardsHtml.push(`
      <div class="card" data-id="card_${index}" data-name="Card ${index}" data-content="${escapeHtml(chunk.join('\n'))}">
        <h3>Card ${index}</h3>
        <pre>${escapeHtml(preview) || '<em>(empty)</em>'}</pre>
        ${remaining > 0 ? `<small>+${remaining} more</small>` : ''}
      </div>`);
  }
  gridElement.innerHTML = cardsHtml.join('');

  const clickedIds = await getClickedCards();
  Object.keys(clickedIds).forEach(cardId => {
    gridElement.querySelector(`[data-id="${cardId}"]`)?.classList.add('card-clicked');
  });
}

// For monitor
export function renderMonitor(state, containerElement, playAllBtnElement) {
  playAllBtnElement.disabled = !state.createdTabs?.length;

  if (!state.createdTabs?.length) {
    containerElement.innerHTML = `<div class="placeholder">Click a card to monitor its tab.</div>`;
    return;
  }

  const playingSet = new Set(state.playingTabs || []);

  containerElement.innerHTML = state.createdTabs.map(tab => {
    const isPlaying = playingSet.has(tab.id);
    return `
    <div class="monitor-entry ${isPlaying ? 'playing' : ''}" data-tab-id="${tab.id}">
      <div class="monitor-entry-header">
        <p><strong>${escapeHtml(tab.cardName || 'N/A')}</strong> (Tab ID: ${tab.id})</p>
        <div class="monitor-buttons">
          <button class="btn btn-play">${isPlaying ? '⏹️ Playing...' : '▶️ Play'}</button>
          <button class="btn btn-download">📥 Download JSON</button>
        </div>
      </div>
      <details>
        <summary>View Original Prompt</summary>
        <pre>${escapeHtml(tab.cardContent || '(No content)')}</pre>
      </details>
      ${tab.responseText ? `
        <div class="monitor-response">
          <h4>AI Response <small>(${tab.responseTimestamp})</small></h4>
          <pre>${escapeHtml(tab.responseText)}</pre>
        </div>` : `
        <div class="monitor-response-placeholder">
          <p>🤖 Response pending...</p>
        </div>`
      }
    </div>`;
  }).join('');
}