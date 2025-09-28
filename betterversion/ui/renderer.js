import { getClickedCards } from '../states/cards.js';

const esc = t => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };

export const downloadJSON = (data, name) => {
  const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const u = URL.createObjectURL(b);
  const l = Object.assign(document.createElement('a'), { href: u, download: name });
  document.body.appendChild(l).click();
  l.remove();
  URL.revokeObjectURL(u);
};

export async function renderCards(grid, lines, per = 200) {
  if (!lines.length) return grid.innerHTML = '<div class="placeholder"><p>No content in file.</p></div>';
  const n = Math.ceil(lines.length / per);
  grid.innerHTML = Array.from({ length: n }, (_, i) => {
    const chunk = lines.slice(i * per, (i + 1) * per);
    const idx = i + 1;
    const preview = chunk.slice(0, 3).join('\n');
    const rem = Math.max(0, chunk.length - 3);
    return `<div class="card" data-id="card_${idx}" data-name="${idx}" data-content="${esc(chunk.join('\n'))}">
      <h3>${idx}</h3><pre>${esc(preview) || '<em>(empty)</em>'}</pre>
      ${rem > 0 ? `<small>+${rem} more</small>` : ''}
    </div>`;
  }).join('');
  const clicked = await getClickedCards();
  Object.keys(clicked).forEach(id => grid.querySelector(`[data-id="${id}"]`)?.classList.add('card-clicked'));
}

// ===== MONITOR RENDERING =====

const createEntry = (t, playing) => {
  const cancelled = t.cancelled;
  const status = cancelled ? '❌ Cancelled' : (t.isComplete ? '✅' : '');
  let responseDisplay = '';

  if (t.isComplete) {
    if (t.responseText) {
      responseDisplay = `<details><summary>View AI Response</summary><div class="monitor-response"><h4>AI Response <small>(${t.responseTimestamp})</small></h4><pre>${esc(t.responseText)}</pre></div></details>`;
    } else {
      responseDisplay = `<div class="monitor-response-placeholder"><p>✅ Completed</p></div>`;
    }
  } else {
    const progress = t.responseText || "Preparing...";
    responseDisplay = `<div class="monitor-response-placeholder"><p>⏳ ${esc(progress)}</p></div>`;
  }

  return `<div class="monitor-entry ${playing ? 'playing' : ''} ${t.isComplete ? 'is-complete' : ''} ${cancelled ? 'cancelled' : ''}" data-tab-id="${t.id}">
    <div class="monitor-entry-header">
      <p><strong>${esc(t.cardName ?? 'N/A')}</strong>${status ? `<span class="completion-status">${status}</span>` : ''}</p>
      <div class="monitor-buttons">
        <button class="btn btn-play" data-tooltip="${playing ? "Stop Audio" : "Play Audio"}">${playing ? '⏹️ Stop' : '▶️ Play'}</button>
        <button class="btn btn-download" data-tooltip="Download JSON">📥</button>
      </div>
    </div>
    <details><summary>View Original Prompt</summary><pre>${esc(t.cardContent ?? '(No content)')}</pre></details>
    <div class="response-area">
      ${responseDisplay}
    </div>
  </div>`;
};

const updateEntry = (el, t, playing) => {
  el.classList.toggle('playing', playing);
  el.classList.toggle('is-complete', t.isComplete);
  el.classList.toggle('cancelled', !!t.cancelled);

  const btn = el.querySelector('.btn-play');
  if (btn) {
    btn.textContent = playing ? '⏹️ Stop' : '▶️ Play';
    btn.dataset.tooltip = playing ? 'Stop Audio' : 'Play Audio';
  }

  const area = el.querySelector('.response-area');
  let responseDisplay = '';

  if (t.isComplete) {
    if (t.responseText) {
      const pre = area.querySelector('.monitor-response pre');
      const ts = area.querySelector('.monitor-response h4 small');
      if (pre && ts) {
        pre.textContent = t.responseText;
        if (t.responseTimestamp) ts.textContent = `(${t.responseTimestamp})`;
        return;
      } else {
        responseDisplay = `<details><summary>View AI Response</summary><div class="monitor-response"><h4>AI Response <small>(${t.responseTimestamp || ''})</small></h4><pre>${esc(t.responseText)}</pre></div></details>`;
      }
    } else {
      responseDisplay = `<div class="monitor-response-placeholder"><p>✅ Completed</p></div>`;
    }
  } else {
    const progress = t.responseText || "Preparing...";
    responseDisplay = `<div class="monitor-response-placeholder"><p>⏳ ${esc(progress)}</p></div>`;
  }
  area.innerHTML = responseDisplay;
};

// Granular DOM functions
export function appendMonitorEntry(tab, isPlaying) {
  const container = document.getElementById('createdTabs');
  const placeholder = container.querySelector('.placeholder');
  if (placeholder) placeholder.style.display = 'none';
  container.insertAdjacentHTML('afterbegin', createEntry(tab, isPlaying));
}

export function updateMonitorEntry(tab, isPlaying) {
  const el = document.querySelector(`.monitor-entry[data-tab-id="${tab.id}"]`);
  if (el) updateEntry(el, tab, isPlaying);
}

export function removeMonitorEntry(tabId) {
  const el = document.querySelector(`.monitor-entry[data-tab-id="${tabId}"]`);
  if (el) el.remove();
}

export function renderMonitorFull({ createdTabs = [], playingTabs = [] }, cont, pAll, dAll, cAll, prog) {
  const total = createdTabs.length;
  const done = createdTabs.filter(t => t.isComplete).length;
  const has = total > 0;

  [pAll, dAll, cAll].forEach(b => b.disabled = !has);
  prog.textContent = has ? `Progress: ${done} / ${total} completed` : 'Awaiting jobs...';

  const ph = cont.querySelector('.placeholder');
  if (ph) ph.style.display = has ? 'none' : 'block';

  const playingSet = new Set(playingTabs);
  cont.innerHTML = '';
  if (!has) {
    cont.innerHTML = '<div class="placeholder"><p>Click a card to monitor its tab.</p></div>';
    return;
  }

  [...createdTabs].reverse().forEach(t => {
    cont.insertAdjacentHTML('afterbegin', createEntry(t, playingSet.has(t.id)));
  });
}

export function updateGlobalControls(createdTabs, playingTabs, pAll, dAll, cAll, prog) {
  const total = createdTabs.length;
  const done = createdTabs.filter(t => t.isComplete).length;
  const has = total > 0;

  [pAll, dAll, cAll].forEach(b => b.disabled = !has);
  prog.textContent = has ? `Progress: ${done} / ${total} completed` : 'Awaiting jobs...';

  const cont = document.getElementById('createdTabs');
  const ph = cont.querySelector('.placeholder');
  if (has && ph) ph.style.display = 'none';
  else if (!has && !ph) {
    cont.innerHTML = '<div class="placeholder"><p>Click a card to monitor its tab.</p></div>';
  }

  pAll.textContent = playingTabs.length ? '⏹️ Stop All' : '▶️ Play All';
}