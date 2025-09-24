// popup.js
const list = document.getElementById('list');
const playAllBtn = document.getElementById('play-all');

const port = chrome.runtime.connect({ name: 'popup' });

const renderTabs = (data) => {
  const { tabIds = [], playingTabs = [] } = data;
  const playingSet = new Set(playingTabs); // for fast lookup

  if (!tabIds.length) {
    list.innerHTML = '<div class="empty">No audio tabs</div>';
    playAllBtn.disabled = true;
    return;
  }

  playAllBtn.disabled = false;

  Promise.all(tabIds.map(id => chrome.tabs.get(id).catch(() => null)))
    .then(tabs => {
      list.innerHTML = '';
      tabs
        .filter(tab => tab)
        .forEach(tab => {
          const el = document.createElement('div');
          el.className = 'tab';
          el.textContent = tab.title || 'Untitled';
          el.title = tab.url;

          // ✅ Highlight if in playingTabs
          if (playingSet.has(tab.id)) {
            el.classList.add('playing');
          }

          el.onclick = () => {
            chrome.runtime.sendMessage({ playTab: tab.id });
            // No local highlight — background will push update
          };

          list.appendChild(el);
        });
    });
};

playAllBtn.onclick = () => {
  chrome.runtime.sendMessage({ playAll: true });
  // Background will push updated playingTabs instantly
};

port.onMessage.addListener(renderTabs);

window.addEventListener('beforeunload', () => port.disconnect());