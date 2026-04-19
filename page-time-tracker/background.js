// background.js - tracks time per tab/URL

let activeTabId = null;
let activeUrl = null;
let startTime = null;

// Get clean hostname from URL
function getHost(url) {
  try {
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Save elapsed time for the current active site
async function saveCurrentTime() {
  if (!activeUrl || !startTime) return;
  const host = getHost(activeUrl);
  if (!host) return;

  const elapsed = Math.floor((Date.now() - startTime) / 1000); // seconds
  if (elapsed <= 0) return;

  const result = await chrome.storage.local.get("timeData");
  const timeData = result.timeData || {};
  timeData[host] = (timeData[host] || 0) + elapsed;
  await chrome.storage.local.set({ timeData });
}

// Start tracking a new tab/url
function startTracking(tabId, url) {
  activeTabId = tabId;
  activeUrl = url;
  startTime = Date.now();
}

// When user switches tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentTime();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  startTracking(activeInfo.tabId, tab.url);
});

// When tab URL changes (navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tabId === activeTabId) {
    await saveCurrentTime();
    startTracking(tabId, tab.url);
  }
});

// When tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === activeTabId) {
    await saveCurrentTime();
    activeTabId = null;
    activeUrl = null;
    startTime = null;
  }
});

// When window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus — pause tracking
    await saveCurrentTime();
    startTime = null;
  } else {
    // Browser gained focus — resume tracking
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      startTracking(tab.id, tab.url);
    }
  }
});

// Periodic save every 10 seconds so data is not lost
chrome.alarms.create("periodicSave", { periodInMinutes: 1 / 6 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "periodicSave") {
    await saveCurrentTime();
    if (startTime !== null) {
      startTime = Date.now(); // reset so we don't double-count
    }
  }
});

// Init on startup
chrome.runtime.onStartup.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) startTracking(tab.id, tab.url);
});

chrome.runtime.onInstalled.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) startTracking(tab.id, tab.url);
});
