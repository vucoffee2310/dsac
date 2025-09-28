export function automationScript(promptText, cardName) {
  'use strict';

  function waitForElement(selector, { all = false, timeout = 15000 } = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const initial = all ? document.querySelectorAll(selector) : document.querySelector(selector);
      if (all ? initial.length > 0 : initial) return resolve(initial);

      const observer = new MutationObserver(() => {
        const el = all ? document.querySelectorAll(selector) : document.querySelector(selector);
        if (all ? el.length > 0 : el) {
          observer.disconnect();
          resolve(el);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          reject(new Error(`Timeout: ${selector}`));
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
    });
  }

  let reportTimeout = null;
  const DEBOUNCE_DELAY = 800;
  let lastReported = '';

  const report = (txt, done, err = false) => {
    const finalText = err ? `[AUTOMATION ERROR] ${txt}` : txt;
    if (done) {
      if (reportTimeout) clearTimeout(reportTimeout);
      reportTimeout = null;
      lastReported = finalText;
      chrome.runtime.sendMessage({
        action: "updateDashboard",
        responseText: finalText,
        isComplete: true,
        timestamp: new Date().toLocaleString()
      });
      chrome.runtime.sendMessage({ stop: true }).catch(() => {});
    } else {
      if (reportTimeout) clearTimeout(reportTimeout);
      reportTimeout = setTimeout(() => {
        if (finalText !== lastReported) {
          lastReported = finalText;
          chrome.runtime.sendMessage({
            action: "updateDashboard",
            responseText: finalText,
            isComplete: false,
            timestamp: new Date().toLocaleString()
          });
        }
      }, DEBOUNCE_DELAY);
    }
  };

  const badge = (status) => {
    let b = document.getElementById('automation-status-badge');
    if (!b) {
      b = Object.assign(document.body.appendChild(document.createElement('div')), {
        id: 'automation-status-badge',
        style: `position:fixed;top:20px;right:20px;padding:8px 12px;border-radius:20px;font-size:12px;font-weight:bold;color:white;z-index:9999;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.15);transition:all .3s;`
      });
    }
    const cfg = {
      processing: ['Processing...', '#3498db'],
      processed: ['Processed ✅', '#27ae60'],
      'not working': ['Not Working ❌', '#e74c3c']
    };
    const [text, color] = cfg[status] || cfg['not working'];
    b.textContent = text;
    b.style.backgroundColor = color;
  };

  (async () => {
    if (cardName) document.title = cardName;
    report("Initializing...", false);
    badge('processing');

    try {
      report("Selecting model...", false);
      const modelBtn = await waitForElement("ms-model-selector-v3 button");
      modelBtn.click();

      report("Choosing model variant...", false);
      const rows = await waitForElement("ms-model-carousel-row", { all: true });
      if (rows.length > 1) rows[1].querySelector("button")?.click();

      report("Setting parameters...", false);
      const sliders = await waitForElement(".mat-mdc-slider.mdc-slider input[type='range']", { all: true });
      const setSlider = (s, v) => { if (s) { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); } };
      setSlider(sliders[0], 1.15);
      setSlider(sliders[1], 0.9);

      report("Entering prompt...", false);
      const ta = await waitForElement("ms-autosize-textarea textarea");
      ta.value = promptText;
      ta.dispatchEvent(new Event('input', { bubbles: true }));

      report("Running prompt...", false);
      const runBtn = await waitForElement("ms-run-button button");
      runBtn.click();

      report("Waiting for AI response...", false);

      let lastResponse = '';
      let settledCount = 0;
      const MAX_SETTLED = 5;
      const INTERVAL = 500;

      const check = () => {
        const turns = document.querySelectorAll("ms-chat-turn");
        if (turns.length < 3) return false;
        const lastTurn = [...turns].pop();
        const modelEl = lastTurn?.querySelector('[data-turn-role="Model"]');
        const current = modelEl?.innerText.trim() || '';

        if (current && current !== lastResponse) {
          lastResponse = current;
          settledCount = 0;
          report(current, false);
          return false;
        } else if (current) {
          settledCount++;
          if (settledCount >= MAX_SETTLED) {
            report(current, true);
            return true;
          }
        }
        return false;
      };

      while (!check()) await new Promise(r => setTimeout(r, INTERVAL));

      badge('processed');
    } catch (e) {
      badge('not working');
      console.error("Automation failed:", e.message);
      report(e.message, true, true);
      chrome.runtime.sendMessage({ stop: true }).catch(() => {});
    }
  })();
}