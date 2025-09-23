function render(s) {
  document.getElementById('openTabs').textContent = JSON.stringify(s.openTabIds, null, 2);
  document.getElementById('closedTabs').textContent = JSON.stringify(s.closedTabs, null, 2);
  document.getElementById('createdTabs').textContent = JSON.stringify(s.createdTabs, null, 2);
}

function fetch() {
  chrome.runtime.sendMessage({ action: "getTabState" }, r => {
    if (chrome.runtime.lastError) return;
    render(r);
  });
}

document.getElementById('refreshButton').addEventListener('click', fetch);
fetch();