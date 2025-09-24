const output = document.getElementById('output');

// Tell background we're ready
chrome.runtime.sendMessage("PAGE_READY");

// Listen for results
chrome.runtime.onMessage.addListener(({ tabId, text }) => {
  let el = document.querySelector(`[data-tab="${tabId}"]`);
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-tab', tabId);
    el.className = 'result';
    output.appendChild(el);
  }
  el.innerHTML = `<strong>Tab ${tabId}:</strong><br><pre>${text}</pre>`;
});