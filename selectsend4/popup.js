const list = document.getElementById('list');
const playAllBtn = document.getElementById('play-all');
const port = chrome.runtime.connect({ name: 'popup' });

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
      list.innerHTML = tabs.filter(Boolean).map(tab => 
        `<div class="tab${playing.has(tab.id) ? ' playing' : ''}" 
             data-id="${tab.id}" title="${tab.url}">${tab.title || 'Untitled'}</div>`
      ).join('');
    });
};

list.onclick = e => {
  if (e.target.dataset.id) chrome.runtime.sendMessage({ playTab: +e.target.dataset.id });
};

playAllBtn.onclick = () => chrome.runtime.sendMessage({ playAll: true });
port.onMessage.addListener(renderTabs);
window.addEventListener('beforeunload', () => port.disconnect());