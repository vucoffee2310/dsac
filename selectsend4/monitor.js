const l = document.getElementById('l');
const b = document.getElementById('b');
const port = chrome.runtime.connect();

port.onMessage.addListener(async ({ tabs = [], playing = [] }) => {
  const p = new Set(playing);
  if (!tabs.length) {
    l.innerHTML = '<div class="e">No audio tabs</div>';
    b.disabled = 1;
    return;
  }
  b.disabled = 0;
  const t = await Promise.all(tabs.map(id => chrome.tabs.get(id).catch(() => 0)));
  const v = t.filter(Boolean);
  l.innerHTML = v.length ? v.map(t =>
    `<div class="t${p.has(t.id) ? ' p' : ''}" data-id="${t.id}">${t.title || 'Untitled'}</div>`
  ).join('') : '<div class="e">No active tabs</div>';
  b.disabled = !v.length;
});

l.onclick = e => e.target.dataset.id && chrome.runtime.sendMessage({ playTab: +e.target.dataset.id });
b.onclick = () => chrome.runtime.sendMessage({ playAll: 1 });