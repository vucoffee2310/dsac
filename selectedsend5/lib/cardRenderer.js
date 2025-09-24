// FILE: selectedsend3/lib/cardRenderer.js
import { escapeHtml } from './utils.js';
import { getClickedCards } from './storage.js';

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