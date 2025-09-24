const injected = new Set();
const playing = new Set();
const ports = new Set();

const notify = () => {
  const msg = { tabs: [...injected], playing: [...playing] };
  ports.forEach(p => {
    try { p.postMessage(msg); } catch { ports.delete(p); }
  });
};

chrome.runtime.onMessage.addListener((req, sender) => {
  const id = sender.tab?.id;
  if (req.injected && id) {
    injected.add(id);
    notify();
  } else if (req.playTab) {
    playing.clear();
    playing.add(req.playTab);
    chrome.tabs.sendMessage(req.playTab, { play: 1 });
    notify();
  } else if (req.playAll) {
    playing.clear();
    injected.forEach(id => {
      playing.add(id);
      chrome.tabs.sendMessage(id, { play: 1 });
    });
    notify();
  }
});

chrome.tabs.onRemoved.addListener(id => {
  (injected.delete(id) | playing.delete(id)) && notify();
});

chrome.tabs.onUpdated.addListener((id, info) => {
  info.status === 'loading' && playing.delete(id) && notify();
});

chrome.runtime.onConnect.addListener(p => {
  ports.add(p);
  p.postMessage({ tabs: [...injected], playing: [...playing] });
  p.onDisconnect.addListener(() => ports.delete(p));
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'monitor.html' });
});