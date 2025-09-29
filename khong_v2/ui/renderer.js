import { getClickedCards } from '../states/cards.js';

const esc = t => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };

export const downloadJSON = (data, name) => {
  const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const u = URL.createObjectURL(b), l = Object.assign(document.createElement('a'), { href: u, download: name });
  document.body.appendChild(l).click(); l.remove(); URL.revokeObjectURL(u);
};

export async function renderCards(grid, lines, per = 150) { // <-- Changed from 200 to 150
  if (!lines.length) return grid.innerHTML = '<div class="placeholder"><p>No content in file.</p></div>';
  const n = Math.ceil(lines.length / per);
  grid.innerHTML = Array.from({ length: n }, (_, i) => {
    const chunk = lines.slice(i * per, (i + 1) * per), idx = i + 1,
          preview = chunk.slice(0, 3).join('\n'), rem = Math.max(0, chunk.length - 3);
    return `<div class="card" data-id="card_${idx}" data-name="${idx}" data-content="${esc(chunk.join('\n'))}">
      <h3>${idx}</h3><pre>${esc(preview) || '<em>(empty)</em>'}</pre>
      ${rem > 0 ? `<small>+${rem} more</small>` : ''}
    </div>`;
  }).join('');
  const clicked = await getClickedCards();
  Object.keys(clicked).forEach(id => grid.querySelector(`[data-id="${id}"]`)?.classList.add('card-clicked'));
}

const createEntry = (t, playing) => {
  const cancelled = t.cancelled, status = cancelled ? '❌ Cancelled' : (t.isComplete ? '✅' : '');
  return `<div class="monitor-entry ${playing ? 'playing' : ''} ${t.isComplete ? 'is-complete' : ''} ${cancelled ? 'cancelled' : ''}" data-tab-id="${t.id}">
    <div class="monitor-entry-header">
      <p><strong>${esc(t.cardName ?? 'N/A')}</strong>${status ? `<span class="completion-status">${status}</span>` : ''}</p>
      <div class="monitor-buttons">
        <button class="btn btn-play" data-tooltip="${playing ? "Stop Audio" : "Play Audio"}">${playing ? '⏹️ Stop' : '▶️ Play'}</button>
        <button class="btn btn-download" data-tooltip="Download JSON">📥</button>
      </div>
    </div>
    <details>
      <summary>View Prompts</summary>
      <div class="prompt-details">
        <h4>Original Content</h4>
        <pre>${esc(t.originalCardContent ?? '(No original content saved)')}</pre>
        <h4>Final Prompt (Sent to AI)</h4>
        <pre>${esc(t.cardContent ?? '(No final prompt saved)')}</pre>
      </div>
    </details>
    <div class="response-area">
      ${t.responseText ? `<details><summary>View AI Response</summary><div class="monitor-response"><h4>AI Response <small>(${t.responseTimestamp})</small></h4><pre>${esc(t.responseText)}</pre></div></details>` : `<div class="monitor-response-placeholder"><p>🤖 Response pending...</p></div>`}
    </div>
  </div>`;
};

const updateEntry = (el, t, playing) => {
  el.classList.toggle('playing', playing);
  el.classList.toggle('is-complete', t.isComplete);
  const btn = el.querySelector('.btn-play');
  if (btn) { btn.textContent = playing ? '⏹️' : '▶️'; btn.dataset.tooltip = playing ? 'Stop Audio' : 'Play Audio'; }
  const area = el.querySelector('.response-area');
  if (t.responseText) {
    const pre = area.querySelector('.monitor-response pre');
    if (pre) { pre.textContent = t.responseText; const ts = area.querySelector('.monitor-response h4 small'); ts && t.responseTimestamp && (ts.textContent = `(${t.responseTimestamp})`); }
    else area.innerHTML = `<details><summary>View AI Response</summary><div class="monitor-response"><h4>AI Response <small>(${t.responseTimestamp || ''})</small></h4><pre>${esc(t.responseText)}</pre></div></details>`;
  }
};

export function renderMonitor({ createdTabs = [], playingTabs = [] }, cont, pAll, dAll, cAll, prog) {
  const total = createdTabs.length, done = createdTabs.filter(t => t.isComplete).length, has = total > 0;
  [pAll, dAll, cAll].forEach(b => b.disabled = !has);
  prog.textContent = has ? `Progress: ${done} / ${total} completed` : 'Awaiting jobs...';
  const ph = cont.querySelector('.placeholder');
  if (ph) ph.style.display = has ? 'none' : 'block';
  const playingSet = new Set(playingTabs);
  const existing = new Map([...cont.querySelectorAll('.monitor-entry')].map(el => [el.dataset.tabId, el]));
  [...createdTabs].reverse().forEach(t => {
    const id = String(t.id), el = existing.get(id), isPlaying = playingSet.has(t.id);
    if (el) { updateEntry(el, t, isPlaying); existing.delete(id); }
    else cont.insertAdjacentHTML('afterbegin', createEntry(t, isPlaying));
  });
  existing.forEach(el => el.remove());
}