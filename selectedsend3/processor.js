function escapeHtml(t) {
  let d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

document.getElementById('fileInput').addEventListener('change', e => {
  let file = e.target.files[0];
  if (!file) return;

  let reader = new FileReader();
  reader.onload = e => {
    let lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    let grid = document.getElementById('grid');
    grid.innerHTML = '';

    if (!lines.length) {
      grid.innerHTML = '<div class="card"><p class="empty">No content.</p></div>';
      return;
    }

    const L = 200, P = 3;
    for (let i = 0; i < lines.length; i += L) {
      let chunk = lines.slice(i, i + L);
      let preview = chunk.slice(0, P);
      let rem = chunk.length - P;
      let idx = Math.floor(i / L) + 1;

      let card = document.createElement('div');
      card.className = 'card';
      let txt = escapeHtml(preview.join('\n')).replace(/\n/g, '<br>') || '<em>(empty)</em>';
      let more = rem > 0 ? `<small>+${rem} more</small>` : '';

      card.innerHTML = `<h3>Card ${idx}</h3><pre>${txt}</pre>${more}`;
      card.addEventListener('click', () => {
        chrome.tabs.create({ url: "https://aistudio.google.com/" }, () => {
          document.getElementById('refreshButton').click();
        });
      });
      grid.appendChild(card);
    }
  };

  // ✅ EXPLICITLY READ AS UTF-8
  reader.readAsText(file, 'UTF-8');
});