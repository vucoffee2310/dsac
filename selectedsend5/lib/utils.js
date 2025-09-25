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
      <div class="card" data-id="card_${index}" data-name="${index}" data-content="${escapeHtml(chunk.join('\n'))}">
        <h3>${index}</h3>
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

// Helper for creating the HTML for a single monitor entry
const createMonitorEntryHtml = (tab, isPlaying) => {
  const completeClass = tab.isComplete ? 'is-complete' : '';
  const currentResponseText = tab.responseText || '';
  return `
    <div class="monitor-entry ${isPlaying ? 'playing' : ''} ${completeClass}" data-tab-id="${tab.id}">
      <div class="monitor-entry-header">
        <p>
          <strong>${escapeHtml(tab.cardName || 'N/A')}</strong>
          <span class="completion-status">✅</span>
        </p>
        <div class="monitor-buttons">
          <button class="btn btn-play">${isPlaying ? '⏹️ Playing...' : '▶️ Play'}</button>
          <button class="btn btn-download">📥 Download JSON</button>
        </div>
      </div>
      <details>
        <summary>View Original Prompt</summary>
        <pre>${escapeHtml(tab.cardContent || '(No content)')}</pre>
      </details>
      
      <div class="response-area">
        ${currentResponseText ? `
          <details> <!-- REMOVED the 'open' attribute -->
            <summary>View AI Response</summary>
            <div class="monitor-response">
              <h4>AI Response <small>(${tab.responseTimestamp})</small></h4>
              <pre>${escapeHtml(currentResponseText)}</pre>
            </div>
          </details>` : `
          <div class="monitor-response-placeholder">
            <p>🤖 Response pending...</p>
          </div>`
        }
      </div>
    </div>`;
};

// For monitor - Smartly updates the DOM instead of replacing innerHTML
export function renderMonitor(state, containerElement, playAllBtnElement, downloadAllBtnElement, clearAllBtnElement, progressElement) {
  const total = state.createdTabs?.length || 0;
  const finished = state.createdTabs?.filter(t => t.isComplete).length || 0;
  const hasTabs = total > 0;

  playAllBtnElement.disabled = !hasTabs;
  downloadAllBtnElement.disabled = !hasTabs;
  clearAllBtnElement.disabled = !hasTabs;

  if (hasTabs) {
    progressElement.textContent = `Progress: ${finished} / ${total} completed`;
  } else {
    progressElement.textContent = `Awaiting jobs...`;
  }

  const placeholder = containerElement.querySelector('.placeholder');

  if (!hasTabs) {
    if (!placeholder) {
      containerElement.innerHTML = `<div class="placeholder">Click a card to monitor its tab.</div>`;
    }
    containerElement.querySelectorAll('.monitor-entry').forEach(e => e.remove());
    return;
  } else if (placeholder) {
    placeholder.remove();
  }

  const playingSet = new Set(state.playingTabs || []);
  const newTabIds = new Set(state.createdTabs.map(t => t.id));

  containerElement.querySelectorAll('.monitor-entry').forEach(entry => {
    const tabId = parseInt(entry.dataset.tabId, 10);
    if (!newTabIds.has(tabId)) {
      entry.remove();
    }
  });

  [...state.createdTabs].reverse().forEach((tab, index) => {
    let entry = containerElement.querySelector(`.monitor-entry[data-tab-id="${tab.id}"]`);
    const isPlaying = playingSet.has(tab.id);

    if (!entry) {
      const newEntryHtml = createMonitorEntryHtml(tab, isPlaying);
      if (index === 0) {
        containerElement.insertAdjacentHTML('afterbegin', newEntryHtml);
      } else {
        const previousTabId = state.createdTabs[state.createdTabs.length - index].id;
        const previousEntry = containerElement.querySelector(`.monitor-entry[data-tab-id="${previousTabId}"]`);
        previousEntry?.insertAdjacentHTML('afterend', newEntryHtml);
      }
    } else {
      entry.classList.toggle('playing', isPlaying);
      entry.classList.toggle('is-complete', tab.isComplete);
      entry.querySelector('.btn-play').textContent = isPlaying ? '⏹️ Playing...' : '▶️ Play';
      
      const responseArea = entry.querySelector('.response-area');
      const currentResponse = tab.responseText || '';
      const placeholderEl = responseArea.querySelector('.monitor-response-placeholder');

      if (placeholderEl && currentResponse) {
        responseArea.innerHTML = `
          <details> <!-- REMOVED the 'open' attribute -->
            <summary>View AI Response</summary>
            <div class="monitor-response">
              <h4>AI Response <small>(${tab.responseTimestamp})</small></h4>
              <pre>${escapeHtml(currentResponse)}</pre>
            </div>
          </details>`;
      } 
      else if (!placeholderEl && currentResponse) {
        const preEl = responseArea.querySelector('pre');
        const smallEl = responseArea.querySelector('small');

        if (preEl && preEl.textContent !== currentResponse) {
          preEl.textContent = currentResponse;
        }
        if (smallEl) {
          smallEl.textContent = `(${tab.responseTimestamp})`;
        }
      }
    }
  });
}