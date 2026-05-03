let currentSpeed = 1.0;
let widgetVisible = true;
let activeTab = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupListeners();
  await refreshState();
});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function sendToTab(message) {
  if (!activeTab) activeTab = await getActiveTab();
  if (!activeTab) return null;
  try {
    return await chrome.tabs.sendMessage(activeTab.id, message);
  } catch (e) {
    return null;
  }
}

async function refreshState() {
  activeTab = await getActiveTab();
  const hostEl = document.getElementById('host');
  const statusEl = document.getElementById('status');

  let derivedHost = '';
  if (activeTab && activeTab.url) {
    try {
      derivedHost = new URL(activeTab.url).hostname;
    } catch (e) {}
  }

  const state = await sendToTab({ type: 'GET_STATE' });
  if (state) {
    currentSpeed = state.speed;
    widgetVisible = state.visible;
    hostEl.textContent = state.host || derivedHost || '';
    statusEl.textContent =
      state.videoCount > 0
        ? `${state.videoCount}件の動画を制御中`
        : '動画は検出されていません';
    updateUI();
  } else {
    hostEl.textContent = derivedHost;
    statusEl.textContent = 'このページでは動作しません（リロードが必要かも）';
    updateUI();
  }
}

function updateUI() {
  document.getElementById('speedValue').textContent = `${currentSpeed.toFixed(2)}x`;
  document.querySelectorAll('.presets button').forEach((btn) => {
    const speed = parseFloat(btn.dataset.speed);
    btn.classList.toggle('active', Math.abs(speed - currentSpeed) < 0.005);
  });
}

async function setSpeed(speed) {
  if (isNaN(speed)) return;
  currentSpeed = Math.max(0.07, Math.min(16, Math.round(speed * 100) / 100));
  await sendToTab({ type: 'SET_SPEED', speed: currentSpeed });
  updateUI();
}

function setupListeners() {
  document.getElementById('slower').addEventListener('click', () => setSpeed(currentSpeed - 0.1));
  document.getElementById('faster').addEventListener('click', () => setSpeed(currentSpeed + 0.1));
  document.getElementById('reset').addEventListener('click', () => setSpeed(1.0));

  document.querySelectorAll('.presets button').forEach((btn) => {
    btn.addEventListener('click', () => setSpeed(parseFloat(btn.dataset.speed)));
  });

  const customInput = document.getElementById('customSpeed');
  document.getElementById('applyCustom').addEventListener('click', () => {
    setSpeed(parseFloat(customInput.value));
    customInput.value = '';
  });
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      setSpeed(parseFloat(customInput.value));
      customInput.value = '';
    }
  });

  document.getElementById('toggleWidget').addEventListener('click', async () => {
    widgetVisible = !widgetVisible;
    await sendToTab({ type: 'TOGGLE_WIDGET', visible: widgetVisible });
  });
}
