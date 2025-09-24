const list = document.getElementById('list');
const playAllBtn = document.getElementById('play-all');

// Connect to background
const port = chrome.runtime.connect({ name: 'monitor' });

const renderTabs = ({ tabIds = [], playingTabs = [] }) => {
  const playing = new Set(playingTabs);

  if (!tabIds.length) {
    list.innerHTML = '<div class="empty">No audio tabs</div>';
    playAllBtn.disabled = true;
    return;
  }

  playAllBtn.disabled = false;
  Promise.all(tabIds.map(id => chrome.tabs.get(id).catch(() => null)))
    .then(tabs => {
      const validTabs = tabs.filter(Boolean);
      if (validTabs.length === 0) {
        list.innerHTML = '<div class="empty">No active audio tabs</div>';
        playAllBtn.disabled = true;
        return;
      }

      list.innerHTML = validTabs.map(tab =>
        `<div class="tab${playing.has(tab.id) ? ' playing' : ''}"
             data-id="${tab.id}" title="${tab.url}">${tab.title || 'Untitled'}</div>`
      ).join('');
    });
};

list.addEventListener('click', (e) => {
  if (e.target.dataset.id) {
    chrome.runtime.sendMessage({ playTab: +e.target.dataset.id });
  }
});

playAllBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ playAll: true });
});

port.onMessage.addListener(renderTabs);