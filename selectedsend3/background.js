const tabState = {
  openTabIds: new Set(),
  closedTabs: [],
  createdTabs: []
};

function isAllowedUrl(url) {
  return url?.startsWith("https://aistudio.google.com/");
}

chrome.tabs.query({}, tabs => {
  tabs.forEach(tab => {
    if (isAllowedUrl(tab.url)) tabState.openTabIds.add(tab.id);
  });
});

chrome.tabs.onCreated.addListener(tab => {
  if (isAllowedUrl(tab.url)) {
    tabState.openTabIds.add(tab.id);
    tabState.createdTabs.push({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      timestamp: Date.now()
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && isAllowedUrl(changeInfo.url) && !tabState.openTabIds.has(tabId)) {
    tabState.openTabIds.add(tabId);
    tabState.createdTabs.push({
      id: tabId,
      url: changeInfo.url,
      timestamp: Date.now()
    });
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  if (tabState.openTabIds.has(tabId)) {
    tabState.openTabIds.delete(tabId);
    tabState.closedTabs.push({ id: tabId, timestamp: Date.now() });
  }
});

chrome.runtime.onMessage.addListener((req, _, send) => {
  if (req.action === "getTabState") {
    send({
      openTabIds: [...tabState.openTabIds],
      closedTabs: [...tabState.closedTabs],
      createdTabs: [...tabState.createdTabs]
    });
  }
  return true;
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("processor.html") });
});