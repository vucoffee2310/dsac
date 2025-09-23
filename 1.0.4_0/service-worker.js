var gainNode;
var os;
var audioCtx;
var streamer;
var source;
var prevFullScreen = false;
var val = 2;
//EACH TAB CAN HAVE A CONTEXT


chrome.runtime.getPlatformInfo(function (info) {
    os = info.os;
});


chrome.runtime.onConnect.addListener(async (tab) => {
    chrome.runtime.onMessage.addListener(function (msg) {
        if (msg.action === 'give value') {
            port.postMessage(val);
            console.error('sent val' + val);
        }
        if (msg.action === 'start') {
            console.error("prev sound level = " + val);
        }



        if (isNumeric(msg.action)) {
            console.error("adjust volume");
            val = msg.action;
            console.error("new sound level = " + val)
            gainNode.gain.value = 2 ** (val);
        }

        if (off(msg.faction)) {
            console.error("OFF");
        }
    });

    const existingContexts = await chrome.runtime.getContexts({});
    let streamer = false;

    const offscreenDocument = existingContexts.find(
        (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
    );

    // If an offscreen document is not already open, create one.
    if (!offscreenDocument) {
        // Create an offscreen document.
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA'],
            justification: 'Streaming from chrome.tabCapture API'
        });
    } else {
        streamer = offscreenDocument.documentUrl.endsWith('#streaming');
    }


    // Get a MediaStream for the active tab.
    const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tab.id
    });

    // Send the stream ID to the offscreen document to start streaming.
    chrome.runtime.sendMessage({
        type: 'start-streaming',
        target: 'offscreen',
        data: streamId
    });

    //full screen
    chrome.tabCapture.onStatusChanged.addListener(function (info) {

        if (info.fullscreen) {
            if (!prevFullScreen) {
                // Automatically make the Chrome window fullscreen
                chrome.windows.getCurrent((window) => {
                    chrome.windows.update(window.id, { state: 'fullscreen' }, (updatedWindow) => {
                        if (chrome.runtime.lastError) {
                            console.error("Error entering fullscreen:", chrome.runtime.lastError.message);
                        } else {
                            console.log("Window entered fullscreen mode");
                        }
                    });
                });

                if (os === 'mac') {
                    console.error("fullmac - window set to fullscreen");
                }
                if (os === 'win') {
                    console.error("fullwin - window set to fullscreen");
                }
            }
        } else {
            // Optional: Exit fullscreen when tab exits fullscreen
            if (prevFullScreen) {
                chrome.windows.getCurrent((window) => {
                    // Only exit fullscreen if the window is currently in fullscreen state
                    if (window.state === 'fullscreen') {
                        chrome.windows.update(window.id, { state: 'normal' }, (updatedWindow) => {
                            if (chrome.runtime.lastError) {
                                console.error("Error exiting fullscreen:", chrome.runtime.lastError.message);
                            } else {
                                console.log("Window exited fullscreen mode");
                            }
                        });
                    }
                });
            }
        }
        prevFullScreen = info.fullscreen;
    });

});


if (chrome.webRequest) {

    chrome.webRequest.onBeforeRequest.addListener(async (details) => {
        var isDebugEnabled = await chrome.storage.local.get("vmdebug");
        // Log to the console every media (video and audio) resource requested by the browser
        if (isDebugEnabled?.vmdebug === "true" && details.type === "media") {
            console.log(details);
        }
    },
        {
            urls: ['<all_urls>'],
        });
}


//Give Freely initialization
self.importScripts('vendor/GiveFreely-background.umd.js');
const giveFreely = new GiveFreely.GiveFreelyService('volumeboosterprod');
void giveFreely.initialize();


