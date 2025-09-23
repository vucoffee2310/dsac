chrome.action.onClicked.addListener(tab => {
    chrome.windows.create({
        type: "popup",
        url: `html/popup.html?tabId=${tab.id}`,
        focused: true,
        width: 310,
        height: 320
    });
});