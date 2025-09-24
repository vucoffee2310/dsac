let readerTabId = null;
const results = {};
const pollers = {};
const audioPopups = {}; // Track audio capture popups

function sendToReader(tabId, text) {
  results[tabId] = text;
  if (readerTabId) {
    chrome.tabs.sendMessage(readerTabId, { tabId, text })
      .catch(() => {}); // ignore if reader not listening
  }
}

// Function to start audio capture for a tab
function startAudioCapture(tabId, tabTitle) {
  // Wait a bit more before starting audio capture
  setTimeout(() => {
    chrome.windows.create({
      type: "popup",
      url: chrome.runtime.getURL(`popup.html?tabId=${tabId}&title=${encodeURIComponent(tabTitle)}`),
      focused: false, // Don't steal focus from the AI Studio tab
      width: 200,
      height: 150
    }).then(window => {
      audioPopups[tabId] = window.id;
      console.log(`✅ Audio capture popup created for tab ${tabId}`);
    }).catch(err => {
      console.error(`❌ Failed to start audio capture for tab ${tabId}:`, err);
    });
  }, 2000); // Wait 2 seconds for tab to be ready
}

// Listen for messages from:
// 1. Content script (automation result)
// 2. page.html ("PAGE_READY")
chrome.runtime.onMessage.addListener((msg, sender) => {
  // From automation script: result ready
  if (msg.tabId !== undefined && msg.text !== undefined) {
    sendToReader(msg.tabId, msg.text);
    return true;
  }

  // From page.html: reader is ready
  if (msg === "PAGE_READY") {
    readerTabId = sender.tab.id;
    // Send any cached results
    for (let id in results) {
      chrome.tabs.sendMessage(readerTabId, { tabId: id, text: results[id] })
        .catch(() => {});
    }
    return true;
  }
});

// Clean up pollers and audio popups if tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  if (pollers[tabId]) {
    clearInterval(pollers[tabId]);
    delete pollers[tabId];
  }
  
  // Close audio popup if the target tab is closed
  if (audioPopups[tabId]) {
    chrome.windows.remove(audioPopups[tabId]).catch(() => {});
    delete audioPopups[tabId];
  }
});

// Clean up audio popup tracking when popup window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  // Find and remove the tab ID associated with this popup window
  for (const [tabId, popupWindowId] of Object.entries(audioPopups)) {
    if (popupWindowId === windowId) {
      delete audioPopups[tabId];
      break;
    }
  }
});

// Main extension action
chrome.action.onClicked.addListener(async () => {

  // ✅ STEP 1: OPEN/FOCUS READER TAB
  if (!readerTabId) {
    const rTab = await chrome.tabs.create({ url: chrome.runtime.getURL("page.html") });
    readerTabId = rTab.id;
  } else {
    await chrome.tabs.update(readerTabId, { active: true });
  }

  // ✅ STEP 2: OPEN AI STUDIO CHAT PAGE
  const tab = await chrome.tabs.create({ url: "https://aistudio.google.com/prompts/new_chat" });

  // Wait for page to fully load and become interactive
  const waitForLoad = new Promise(resolve => {
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Additional wait for page to be fully interactive
        setTimeout(resolve, 1000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  await waitForLoad;

  // ✅ STEP 3: INJECT AUTOMATION SCRIPT FIRST
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (currentTabId) => {
        (() => {
          'use strict';

          // Only run on correct page
          if (!window.location.href.startsWith('https://aistudio.google.com/prompts/new_chat')) {
            return console.log('🚫 Not running on this page.');
          }

          // --- UTILITIES ---
          const wait = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

          const waitFor = async (selector, { all = false, retries = 6 } = {}) => {
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
              idle:        { text: 'Idle',          color: '#95a5a6' },
              processing:  { text: 'Processing...', color: '#3498db' },
              processed:   { text: 'Processed ✅',   color: '#27ae60' },
              'not working':{ text: 'Not Working ❌',color: '#e74c3c' }
            };
            const { text, color } = config[status] || config['not working'];
            badge.textContent = text;
            badge.style.backgroundColor = color;
          };

          // Send result to background (instead of downloading)
          const sendResponseToExtension = (text) => {
            chrome.runtime.sendMessage({
              tabId: currentTabId,
              text: text || "[empty response]"
            });
            console.log("✅ Response sent to extension!");
          };

          // Wait for AI response to stabilize
          const monitorAndDownload = async () => {
            // Wait until at least 3 chat turns exist
            while (document.querySelectorAll("ms-chat-turn").length < 3) await wait();

            let previousContent, stableChecks = 0;
            // Wait for content to stabilize (3 identical readings)
            while (stableChecks < 3) {
              const lastTurn = [...document.querySelectorAll("ms-chat-turn")].pop();
              const currentContent = lastTurn?.outerHTML;
              stableChecks = currentContent === previousContent ? stableChecks + 1 : 0;
              previousContent = currentContent;
              await wait();
            }

            // Extract and send final response
            const lastTurn = [...document.querySelectorAll("ms-chat-turn")].pop();
            const responseText = lastTurn?.querySelector('.model-prompt-container, [data-turn-role="Model"]')?.innerText;

            sendResponseToExtension(responseText);
          };

          // Main automation sequence
          const runAutomation = async () => {
            updateStatus('processing');
            try {
              console.log("🚀 Starting automation...");

              // 1. Open model selector
              (await waitFor("ms-model-selector-v3 button")).click();
              await wait();

              // 2. Select model (2nd row)
              const carouselRows = await waitFor("ms-model-carousel-row", { all: true });
              carouselRows[1]?.querySelector("button")?.click();
              await wait();

              // 3. Set sliders
              const sliders = await waitFor(".mat-mdc-slider.mdc-slider input[type='range']", { all: true });
              const setSlider = (slider, value) => {
                slider.value = value;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
              };
              setSlider(sliders[0], 1.15); // Temperature
              await wait();
              setSlider(sliders[1], 0.9);  // Top P
              await wait();
              
              // 4. Type prompt
              const textarea = await waitFor("ms-autosize-textarea textarea");
              textarea.value = "hello";
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              await wait();

              // 5. Click Run
              (await waitFor("ms-run-button button")).click();
              await wait();

              // 6. Monitor and send result
              await monitorAndDownload();

              updateStatus('processed');
              console.log("✅ Automation completed!");

            } catch (error) {
              updateStatus('not working');
              console.error("❌ Automation failed:", error.message);
              // Send error to reader
              chrome.runtime.sendMessage({
                tabId: currentTabId,
                text: `[ERROR] ${error.message}`
              });
            }
          };

          // Initialize
          updateStatus('idle');
          if (document.readyState === 'loading') {
            window.addEventListener('load', runAutomation, { once: true });
          } else {
            runAutomation();
          }

        })();
      },
      args: [tab.id] // Pass tab ID to script
    });

    console.log("✅ Automation script injected into tab", tab.id);

  } catch (err) {
    console.error("❌ Failed to inject automation script:", err);
    sendToReader(tab.id, `[INJECTION ERROR] ${err.message}`);
  }

  // ✅ STEP 4: START AUDIO CAPTURE AFTER EVERYTHING IS READY
  startAudioCapture(tab.id, tab.title || "AI Studio Chat");

});