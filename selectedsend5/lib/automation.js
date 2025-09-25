export function automationScript(promptText, cardName) {
    'use strict';
    const wait = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
    const waitFor = async (selector, { all = false, retries = 10 } = {}) => {
        for (let i = 0; i < retries; i++) {
            const result = all ? document.querySelectorAll(selector) : document.querySelector(selector);
            if (all ? result.length : result) return result;
            await wait();
        }
        throw new Error(`Element(s) not found: ${selector}`);
    };
    const updateStatus = (status) => {
        let badge = document.getElementById('automation-status-badge');
        if (!badge) {
            badge = document.body.appendChild(document.createElement('div'));
            badge.id = 'automation-status-badge';
            badge.style.cssText = `position:fixed;top:20px;right:20px;padding:8px 12px;border-radius:20px;font-size:12px;font-weight:bold;color:white;z-index:99999;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.15);transition:all .3s;`;
        }
        const config = {
            idle: { text: 'Idle', color: '#95a5a6' },
            processing: { text: 'Processing...', color: '#3498db' },
            processed: { text: 'Processed ✅', color: '#27ae60' },
            'not working': { text: 'Not Working ❌', color: '#e74c3c' }
        };
        const { text, color } = config[status] || config['not working'];
        badge.textContent = text;
        badge.style.backgroundColor = color;
    };
    const monitorAndReportResponse = () => new Promise(async (resolve, reject) => {
        while (document.querySelectorAll("ms-chat-turn").length < 3) {
            await wait(500);
        }

        let previousText = '';
        let stableChecks = 0;
        const maxStableChecks = 5;
        const intervalMs = 500;

        const intervalId = setInterval(() => {
            const responseEl = [...document.querySelectorAll("ms-chat-turn")].pop()?.querySelector('[data-turn-role="Model"]');
            const currentText = responseEl ? responseEl.innerText.trim() : '';

            if (currentText !== previousText) {
                previousText = currentText;
                stableChecks = 0;
                chrome.runtime.sendMessage({
                    action: "updateDashboard",
                    responseText: currentText,
                    isComplete: false, // Mark as in-progress
                    timestamp: new Date().toLocaleString()
                });
            } else {
                stableChecks++;
            }

            if (stableChecks >= maxStableChecks) {
                clearInterval(intervalId);
                chrome.runtime.sendMessage({
                    action: "updateDashboard",
                    responseText: previousText,
                    isComplete: true, // Send one final message marking it as complete
                    timestamp: new Date().toLocaleString()
                });

                if (!previousText) {
                    reject(new Error("No response text found to report."));
                } else {
                    resolve();
                }
            }
        }, intervalMs);
    });
    
    const runAutomation = async () => {
        if (cardName) {
            document.title = cardName;
        }
        updateStatus('processing');
        try {
            (await waitFor("ms-model-selector-v3 button")).click(); await wait();
            const carouselRows = await waitFor("ms-model-carousel-row", { all: true });
            if (carouselRows.length > 1) carouselRows[1].querySelector("button")?.click(); await wait();
            const sliders = await waitFor(".mat-mdc-slider.mdc-slider input[type='range']", { all: true });
            const setSlider = (slider, value) => { if (slider) { slider.value = value; slider.dispatchEvent(new Event('input', { bubbles: true })); } };
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
            chrome.runtime.sendMessage({ 
                action: "updateDashboard", 
                responseText: `[AUTOMATION ERROR] ${error.message}`,
                isComplete: true, // Mark errors as complete too
                timestamp: new Date().toLocaleString() 
            });
        }
    };
    runAutomation();
}