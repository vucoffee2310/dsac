export function automationScript(promptText, cardName) {
    'use strict';
    const wait = (ms = 500) => new Promise(r => setTimeout(r, ms));
    const waitFor = async (selector, { all = false, retries = 10 } = {}) => {
        for (let i = 0; i < retries; i++) {
            const result = all ? document.querySelectorAll(selector) : document.querySelector(selector);
            if (all ? result.length : result) return result;
            await wait();
        }
        throw new Error(`Element(s) not found: ${selector}`);
    };

    const report = (responseText, isComplete, isError = false) => {
        const message = isError ? `[AUTOMATION ERROR] ${responseText}` : responseText;
        chrome.runtime.sendMessage({ action: "updateDashboard", responseText: message, isComplete, timestamp: new Date().toLocaleString() });
    };

    const updateStatus = (status) => {
        const badge = document.getElementById('automation-status-badge') || Object.assign(document.body.appendChild(document.createElement('div')), {
            id: 'automation-status-badge',
            style: `position:fixed;top:20px;right:20px;padding:8px 12px;border-radius:20px;font-size:12px;font-weight:bold;color:white;z-index:9999;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.15);transition:all .3s;`
        });
        const config = {
            processing: ['Processing...', '#3498db'],
            processed: ['Processed ✅', '#27ae60'],
            'not working': ['Not Working ❌', '#e74c3c']
        };
        const [text, color] = config[status] || config['not working'];
        badge.textContent = text;
        badge.style.backgroundColor = color;
    };

    const monitorAndReportResponse = async () => {
        while (document.querySelectorAll("ms-chat-turn").length < 3) await wait();

        let prevText = '', stableChecks = 0;
        while (stableChecks < 5) {
            const responseEl = [...document.querySelectorAll("ms-chat-turn")].pop()?.querySelector('[data-turn-role="Model"]');
            const currentText = responseEl?.innerText.trim() || '';
            if (currentText !== prevText) {
                prevText = currentText;
                stableChecks = 0;
                report(currentText, false);
            } else {
                stableChecks++;
            }
            await wait(500);
        }
        if (!prevText) throw new Error("No response text found to report.");
        report(prevText, true);
    };
    
    (async () => {
        if (cardName) document.title = cardName;
        updateStatus('processing');
        try {
            (await waitFor("ms-model-selector-v3 button")).click(); await wait();
            const carouselRows = await waitFor("ms-model-carousel-row", { all: true });
            if (carouselRows.length > 1) carouselRows[1].querySelector("button")?.click(); await wait();
            
            const sliders = await waitFor(".mat-mdc-slider.mdc-slider input[type='range']", { all: true });
            const setSlider = (slider, value) => {
                if (slider) { slider.value = value; slider.dispatchEvent(new Event('input', { bubbles: true })); }
            };
            setSlider(sliders[0], 1.15); await wait();
            setSlider(sliders[1], 0.9); await wait();

            const textarea = await waitFor("ms-autosize-textarea textarea");
            textarea.value = promptText;
            textarea.dispatchEvent(new Event('input', { bubbles: true })); await wait();
            
            (await waitFor("ms-run-button button")).click();
            await monitorAndReportResponse();
            updateStatus('processed');
        } catch (error) {
            updateStatus('not working');
            console.error("❌ Automation failed:", error.message);
            report(error.message, true, true);
        }
    })();
}