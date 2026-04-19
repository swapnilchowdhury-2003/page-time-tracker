// popup.js

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimeLong(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getHost(url) {
  try {
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return null;
    return new URL(url).hostname;
  } catch { return null; }
}

let liveStart = null;
let liveHost = null;
let liveInterval = null;

async function render() {
  const result = await chrome.storage.local.get("timeData");
  const timeData = result.timeData || {};

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentHost = tab ? getHost(tab.url) : null;

  // Update current site display
  const currentHostEl = document.getElementById("currentHost");
  const currentTimeEl = document.getElementById("currentTime");

  if (currentHost) {
    currentHostEl.textContent = currentHost;
    liveHost = currentHost;
    liveStart = Date.now();

    // Live counter
    clearInterval(liveInterval);
    function updateLive() {
      const saved = timeData[liveHost] || 0;
      const live = Math.floor((Date.now() - liveStart) / 1000);
      currentTimeEl.textContent = formatTimeLong(saved + live);
    }
    updateLive();
    liveInterval = setInterval(updateLive, 1000);
  } else {
    currentHostEl.textContent = "—";
    currentTimeEl.textContent = "00:00:00";
  }

  // Build site list
  const sorted = Object.entries(timeData).sort((a, b) => b[1] - a[1]);
  const listEl = document.getElementById("siteList");
  const totalEl = document.getElementById("totalTime");

  if (sorted.length === 0) {
    listEl.innerHTML = '<div class="empty">No data yet. Start browsing!</div>';
    totalEl.textContent = "0s";
    return;
  }

  const maxTime = sorted[0][1];
  const totalSeconds = sorted.reduce((s, [, v]) => s + v, 0);
  totalEl.textContent = formatTime(totalSeconds);

  listEl.innerHTML = sorted.map(([host, secs], i) => {
    const pct = Math.round((secs / maxTime) * 100);
    const isTop = i === 0;
    return `
      <div class="site-row">
        <div class="bar-bg" style="width:${pct}%"></div>
        <span class="rank">${i + 1}</span>
        <img class="favicon" src="https://www.google.com/s2/favicons?domain=${host}&sz=16" 
             onerror="this.style.display='none'" />
        <span class="site-name">${host}</span>
        <span class="site-time ${isTop ? 'top' : ''}">${formatTime(secs)}</span>
      </div>`;
  }).join('');
}

document.getElementById("clearBtn").addEventListener("click", async () => {
  await chrome.storage.local.set({ timeData: {} });
  clearInterval(liveInterval);
  render();
});

render();
