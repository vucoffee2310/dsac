import { addClickedCard, clearClickedCards } from './lib/state.js';
import { renderCards, handleFileSelect } from './lib/utils.js';

const grid = document.getElementById('grid');

document.addEventListener('click', async (event) => {
  const card = event.target.closest('.card');
  if (card && !card.classList.contains('card-clicked')) {
    card.classList.add('card-clicked');
    const { id, name, content } = card.dataset;
    await addClickedCard(id);

    const newTab = await chrome.tabs.create({
      url: "https://aistudio.google.com/prompts/new_chat",
      active: false
    });

    chrome.runtime.sendMessage({
      action: "logTabCreation",
      payload: { id: newTab.id, cardName: name, cardContent: content }
    });
  }
  
  if (event.target.closest('#clearSaved')) {
    await clearClickedCards();
    alert('✅ Cleared all clicked card states.');
    document.querySelectorAll('.card.card-clicked').forEach(c => c.classList.remove('card-clicked'));
  }
});

document.getElementById('fileInput').addEventListener('change', (event) => {
    handleFileSelect(event, (lines) => renderCards(grid, lines));
});