// FILE: selectedsend3/lib/monitorRenderer.js
import { escapeHtml } from './utils.js';

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