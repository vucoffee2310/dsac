export function automationScript(promptText, cardName) {
  'use strict';
  const w = (ms = 500) => new Promise(r => setTimeout(r, ms));
  const wf = async (s, { all = false, retries = 10 } = {}) => {
    for (let i = 0; i < retries; i++) {
      const r = all ? document.querySelectorAll(s) : document.querySelector(s);
      if (all ? r.length : r) return r;
      await w();
    }
    throw new Error(`Element(s) not found: ${s}`);
  };
  const report = (txt, done, err = false) => {
    chrome.runtime.sendMessage({ action: "updateDashboard", responseText: err ? `[AUTOMATION ERROR] ${txt}` : txt, isComplete: done, timestamp: new Date().toLocaleString() });
  };
  const badge = (status) => {
    let b = document.getElementById('automation-status-badge');
    if (!b) {
      b = Object.assign(document.body.appendChild(document.createElement('div')), {
        id: 'automation-status-badge',
        style: `position:fixed;top:20px;right:20px;padding:8px 12px;border-radius:20px;font-size:12px;font-weight:bold;color:white;z-index:9999;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.15);transition:all .3s;`
      });
    }
    const cfg = { processing: ['Processing...', '#3498db'], processed: ['Processed ✅', '#27ae60'], 'not working': ['Not Working ❌', '#e74c3c'] };
    const [t, c] = cfg[status] || cfg['not working'];
    b.textContent = t;
    b.style.backgroundColor = c;
  };
  const monitor = async () => {
    while (document.querySelectorAll("ms-chat-turn").length < 3) await w();
    let prev = '', checks = 0;
    // Check interval is 3 seconds (3000ms).
    // Inactivity timeout is 12 seconds (4 checks * 3000ms), which satisfies the
    // requirement for a timeout of at least 10 seconds.
    while (checks < 4) {
      const el = [...document.querySelectorAll("ms-chat-turn")].pop()?.querySelector('[data-turn-role="Model"]');
      const cur = el?.innerText.trim() || '';
      if (cur !== prev) { prev = cur; checks = 0; report(cur, false); } else checks++;
      await w(5000); // <-- MODIFIED: Changed to 5-second interval
    }
    if (!prev) throw new Error("No response text found.");
    report(prev, true);
  };
  (async () => {
    if (cardName) document.title = cardName;
    badge('processing');
    try {
      (await wf("ms-model-selector-v3 button")).click(); await w();
      const rows = await wf("ms-model-carousel-row", { all: true });
      if (rows.length > 1) rows[1].querySelector("button")?.click(); await w();
      const sliders = await wf(".mat-mdc-slider.mdc-slider input[type='range']", { all: true });
      const set = (s, v) => { if (s) { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); } };
      set(sliders[0], 1.15); await w();
      set(sliders[1], 0.9); await w();
      const ta = await wf("ms-autosize-textarea textarea");
      ta.value = promptText;
      ta.dispatchEvent(new Event('input', { bubbles: true })); await w();
      (await wf("ms-run-button button")).click();
      await monitor();
      badge('processed');
    } catch (e) {
      badge('not working');
      console.error("❌ Automation failed:", e.message);
      report(e.message, true, true);
    }
  })();

}
