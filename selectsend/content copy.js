(() => {
    'use strict';

    if (!window.location.href.startsWith('https://aistudio.google.com/prompts/new_chat')) {
        return console.log('🚫 Not running on AI Studio page.');
    }

    // --- UTILITIES ---

    const wait = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

    const waitFor = async (selector, { all = false, retries = 6 } = {}) => {
        for (let i = 0; i < retries; i++) {
            const result = all ? document.querySelectorAll(selector) : document.querySelector(selector);
            if (all ? result.length : result) return result;
            await wait();
        }
        throw new Error(`Element not found: ${selector}`);
    };

    // --- AUTOMATION ---

    const runAutomation = async () => {
        try {
            console.log("🤖 Worker: Starting automation...");

            // Click model selector
            (await waitFor("ms-model-selector-v3 button")).click();
            await wait();

            // Select model (row 2)
            const carouselRows = await waitFor("ms-model-carousel-row", { all: true });
            carouselRows[1]?.querySelector("button")?.click();
            await wait();

            // Set sliders
            const sliders = await waitFor(".mat-mdc-slider.mdc-slider input[type='range']", { all: true });
            const setSlider = (slider, value) => {
                slider.value = value;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            };
            setSlider(sliders[0], 1.15); // Temperature
            await wait();
            setSlider(sliders[1], 0.9);  // Top-P
            await wait();

            // Set prompt
            const textarea = await waitFor("ms-autosize-textarea textarea");
            textarea.value = "hello";
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            await wait();

            // Click Run
            (await waitFor("ms-run-button button")).click();
            await wait();

            // Wait for response
            while (document.querySelectorAll("ms-chat-turn").length < 3) await wait();

            let previousContent, stableChecks = 0;
            while (stableChecks < 3) {
                const lastTurn = [...document.querySelectorAll("ms-chat-turn")].pop();
                const currentContent = lastTurn?.outerHTML;
                stableChecks = currentContent === previousContent ? stableChecks + 1 : 0;
                previousContent = currentContent;
                await wait(300);
            }

            const lastTurn = [...document.querySelectorAll("ms-chat-turn")].pop();
            const responseText = lastTurn?.querySelector('.model-prompt-container, [data-turn-role="Model"]')?.innerText;

            if (responseText) {
                console.log("✅ Worker: Response ready. Sending to dashboard...");

                // Send to background to update dashboard
                chrome.runtime.sendMessage({
                    action: "updateDashboard",
                    responseText: responseText,
                    timestamp: new Date().toLocaleString()
                });
            } else {
                console.warn("⚠️ Worker: No response text found.");
            }

        } catch (error) {
            console.error("❌ Worker: Automation failed:", error.message);
        }
    };

    // Start when page is ready
    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", runAutomation, { once: true });
    } else {
        runAutomation();
    }

})();