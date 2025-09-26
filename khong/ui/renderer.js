// ui/renderer.js
import { getClickedCards } from '../lib/cardState.js';

const escapeHtml = (text = '') => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const downloadJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link).click();
  link.remove();
  URL.revokeObjectURL(url);
};

export async function renderCards(grid, lines, linesPerCard = 200) {
  if (!lines.length) {
    grid.innerHTML = '<div class="placeholder"><p>No content in file.</p></div>';
    return;
  }
  const numCards = Math.ceil(lines.length / linesPerCard);
  grid.innerHTML = Array.from({ length: numCards }, (_, i) => {
    const chunk = lines.slice(i * linesPerCard, (i + 1) * linesPerCard);
    const idx = i + 1;
    const preview = chunk.slice(0, 3).join('\n');
    const remaining = Math.max(0, chunk.length - 3);
    return `
      <div class="card" data-id="card_${idx}" data-name="${idx}" data-content="${escapeHtml(chunk.join('\n'))}">
        <h3>${idx}</h3>
        <pre>${escapeHtml(preview) || '<em>(empty)</em>'}</pre>
        ${remaining > 0 ? `<small>+${remaining} more</small>` : ''}
      </div>`;
  }).join('');
  const clicked = await getClickedCards();
  Object.keys(clicked).forEach(id => {
    grid.querySelector(`[data-id="${id}"]`)?.classList.add('card-clicked');
  });
}

// --- Monitor Rendering ---
const createMonitorEntry = (tab, isPlaying) => `
  <div class="monitor-entry ${isPlaying ? 'playing' : ''} ${tab.isComplete ? 'is-complete' : ''}" data-tab-id="${tab.id}">
    <div class="monitor-entry-header">
      <p><strong>${escapeHtml(tab.cardName ?? 'N/A')}</strong><span class="completion-status">✅</span></p>
      <div class="monitor-buttons">
        <button class="btn btn-play" data-tooltip="${isPlaying ? "Stop Audio" : "Play Audio"}">${isPlaying ? '⏹️ Stop' : '▶️ Play'}</button>
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

const updateEntry = (el, tab, isPlaying) => {
  el.classList.toggle('playing', isPlaying);
  el.classList.toggle('is-complete', tab.isComplete);

  const btn = el.querySelector('.btn-play');
  if (btn) {
    btn.textContent = isPlaying ? '⏹️' : '▶️';
    btn.dataset.tooltip = isPlaying ? 'Stop Audio' : 'Play Audio';
  }

  const area = el.querySelector('.response-area');
  if (tab.responseText && area.querySelector('.monitor-response-placeholder')) {
    area.innerHTML = `<details><summary>View AI Response</summary>
      <div class="monitor-response">
        <h4>AI Response <small>(${tab.responseTimestamp})</small></h4>
        <pre>${escapeHtml(tab.responseText)}</pre>
      </div>
    </details>`;
  }
};

export function renderMonitor(state, container, playAllBtn, downloadAllBtn, clearAllBtn, progress) {
  const { createdTabs = [], playingTabs = [] } = state;
  const total = createdTabs.length;
  const finished = createdTabs.filter(t => t.isComplete).length;
  const hasTabs = total > 0;

  [playAllBtn, downloadAllBtn, clearAllBtn].forEach(btn => btn.disabled = !hasTabs);
  progress.textContent = hasTabs ? `Progress: ${finished} / ${total} completed` : 'Awaiting jobs...';

  const placeholder = container.querySelector('.placeholder');
  if (placeholder) placeholder.style.display = hasTabs ? 'none' : 'block';

  const playingSet = new Set(playingTabs);
  const existing = new Map(Array.from(container.querySelectorAll('.monitor-entry'), el => [el.dataset.tabId, el]));

  [...createdTabs].reverse().forEach(tab => {
    const id = String(tab.id);
    const entry = existing.get(id);
    const isPlaying = playingSet.has(tab.id);
    if (entry) {
      updateEntry(entry, tab, isPlaying);
      existing.delete(id);
    } else {
      container.insertAdjacentHTML('afterbegin', createMonitorEntry(tab, isPlaying));
    }
  });

  existing.forEach(el => el.remove());
}