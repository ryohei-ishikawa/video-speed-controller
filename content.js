(function () {
  'use strict';

  if (window.__VSC_LOADED__) return;
  window.__VSC_LOADED__ = true;

  const SPEED_STEP = 0.1;
  const MIN_SPEED = 0.07;
  const MAX_SPEED = 16.0;
  const SEEK_SECONDS = 10;
  const VSC_TAG = '__VSC_MSG__';

  const isTop = window.top === window.self;
  const HOST = isTop ? location.hostname : '';
  const STORAGE_SPEED = isTop ? `vsc_speed_${HOST}` : null;
  const STORAGE_VISIBLE = 'vsc_visible';
  const STORAGE_POSITION = isTop ? `vsc_position_${HOST}` : null;

  let currentSpeed = 1.0;
  let widgetVisible = true;
  let widget = null;
  let speedDisplay = null;
  let videoElements = new Set();
  let flashTimer = null;

  init();

  function init() {
    if (isTop) {
      try {
        chrome.storage.local.get([STORAGE_SPEED, STORAGE_VISIBLE, STORAGE_POSITION], (result) => {
          if (typeof result[STORAGE_SPEED] === 'number') {
            currentSpeed = result[STORAGE_SPEED];
          }
          if (typeof result[STORAGE_VISIBLE] === 'boolean') {
            widgetVisible = result[STORAGE_VISIBLE];
          }
          startup();
          if (result[STORAGE_POSITION]) {
            applyPosition(result[STORAGE_POSITION]);
          }
          broadcastDown();
        });
      } catch (e) {
        startup();
      }
    } else {
      startup();
      try {
        window.parent.postMessage({ [VSC_TAG]: true, type: 'REQUEST_SPEED' }, '*');
      } catch (e) {}
    }
  }

  function startup() {
    if (isTop) {
      whenReady(createWidget);
      setupKeyboardShortcuts();
      setupRuntimeMessages();
      setupFullscreenHandler();
      setupStorageSync();
    }
    setupPostMessages();
    startVideoTracking();
  }

  function whenReady(fn) {
    if (document.body) {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  }

  function startVideoTracking() {
    whenReady(() => {
      findVideos(document);
      setupMutationObserver();
    });
  }

  function findVideos(root) {
    try {
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll('video').forEach(trackVideo);
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) findVideos(el.shadowRoot);
      });
    } catch (e) {}
  }

  function trackVideo(video) {
    if (videoElements.has(video)) return;
    videoElements.add(video);
    applySpeedToVideo(video);
    video.addEventListener('loadeddata', () => applySpeedToVideo(video));
    video.addEventListener('play', () => applySpeedToVideo(video));
    video.addEventListener('canplay', () => applySpeedToVideo(video));
  }

  function applySpeedToVideo(video) {
    try {
      if (Math.abs(video.playbackRate - currentSpeed) > 0.001) {
        video.playbackRate = currentSpeed;
      }
    } catch (e) {}
  }

  function applySpeedToAll() {
    videoElements.forEach(applySpeedToVideo);
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let foundNew = false;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (!node || node.nodeType !== 1) continue;
          if (node.tagName === 'VIDEO') {
            trackVideo(node);
            foundNew = true;
          } else if (node.querySelectorAll) {
            const inside = node.querySelectorAll('video');
            inside.forEach((v) => {
              trackVideo(v);
              foundNew = true;
            });
            findVideos(node);
          }
        }
      }
      if (foundNew && isTop) broadcastDown();
    });
    try {
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });
    } catch (e) {}
  }

  function createWidget() {
    if (widget) return;
    widget = document.createElement('div');
    widget.id = 'vsc-widget';
    if (!widgetVisible) widget.classList.add('vsc-hidden');
    widget.innerHTML = `
      <div class="vsc-handle" title="ドラッグで移動">⠿</div>
      <button class="vsc-btn vsc-slower" title="遅く (S)">−</button>
      <span class="vsc-speed">1.00x</span>
      <button class="vsc-btn vsc-faster" title="速く (D)">＋</button>
      <button class="vsc-btn vsc-reset" title="リセット (R)">⟳</button>
      <button class="vsc-btn vsc-close" title="非表示 (V)">×</button>
    `;
    (document.body || document.documentElement).appendChild(widget);

    speedDisplay = widget.querySelector('.vsc-speed');

    widget.querySelector('.vsc-slower').addEventListener('click', (e) => {
      e.stopPropagation();
      adjustSpeed(-SPEED_STEP);
    });
    widget.querySelector('.vsc-faster').addEventListener('click', (e) => {
      e.stopPropagation();
      adjustSpeed(SPEED_STEP);
    });
    widget.querySelector('.vsc-reset').addEventListener('click', (e) => {
      e.stopPropagation();
      setSpeed(1.0);
    });
    widget.querySelector('.vsc-close').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWidget(false);
    });

    setupDrag();
    updateDisplay();
  }

  function setupDrag() {
    if (!widget) return;
    const handle = widget.querySelector('.vsc-handle');
    let startX, startY, startLeft, startTop, dragging = false;

    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = widget.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const w = widget.offsetWidth;
      const h = widget.offsetHeight;
      const left = Math.max(0, Math.min(window.innerWidth - w, startLeft + dx));
      const top = Math.max(0, Math.min(window.innerHeight - h, startTop + dy));
      widget.style.left = `${left}px`;
      widget.style.top = `${top}px`;
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      try {
        chrome.storage.local.set({
          [STORAGE_POSITION]: {
            left: widget.style.left,
            top: widget.style.top,
          },
        });
      } catch (e) {}
    });
  }

  function applyPosition(pos) {
    if (!widget || !pos) {
      if (pos) {
        whenReady(() => applyPosition(pos));
      }
      return;
    }
    if (pos.left) widget.style.left = pos.left;
    if (pos.top) widget.style.top = pos.top;
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }

  function setSpeed(speed) {
    currentSpeed = clampSpeed(speed);
    applySpeedToAll();
    if (isTop) {
      try {
        chrome.storage.local.set({ [STORAGE_SPEED]: currentSpeed });
      } catch (e) {}
      broadcastDown();
    }
    updateDisplay();
    showFlash();
  }

  function adjustSpeed(delta) {
    setSpeed(roundSpeed(currentSpeed + delta));
  }

  function clampSpeed(s) {
    return Math.max(MIN_SPEED, Math.min(MAX_SPEED, s));
  }

  function roundSpeed(s) {
    return Math.round(s * 100) / 100;
  }

  function updateDisplay() {
    if (speedDisplay) {
      speedDisplay.textContent = `${currentSpeed.toFixed(2)}x`;
    }
  }

  function showFlash() {
    if (!widget) return;
    widget.classList.add('vsc-flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => widget.classList.remove('vsc-flash'), 300);
  }

  function toggleWidget(visible) {
    widgetVisible = visible !== undefined ? visible : !widgetVisible;
    if (widget) {
      widget.classList.toggle('vsc-hidden', !widgetVisible);
    }
    try {
      chrome.storage.local.set({ [STORAGE_VISIBLE]: widgetVisible });
    } catch (e) {}
  }

  function setupKeyboardShortcuts() {
    document.addEventListener(
      'keydown',
      (e) => {
        const t = e.target;
        const tag = (t && t.tagName ? t.tagName : '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (t && t.isContentEditable) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.code) {
          case 'KeyS':
            adjustSpeed(-SPEED_STEP);
            e.preventDefault();
            break;
          case 'KeyD':
            adjustSpeed(SPEED_STEP);
            e.preventDefault();
            break;
          case 'KeyR':
            setSpeed(1.0);
            e.preventDefault();
            break;
          case 'KeyZ':
            seek(-SEEK_SECONDS);
            e.preventDefault();
            break;
          case 'KeyX':
            seek(SEEK_SECONDS);
            e.preventDefault();
            break;
          case 'KeyV':
            toggleWidget();
            e.preventDefault();
            break;
        }
      },
      true
    );
  }

  function seek(seconds) {
    const playing = Array.from(videoElements).filter((v) => !v.paused);
    const targets = playing.length > 0 ? playing : Array.from(videoElements);
    targets.forEach((v) => {
      try {
        v.currentTime = Math.max(0, v.currentTime + seconds);
      } catch (e) {}
    });
    if (isTop) {
      postToChildren({ [VSC_TAG]: true, type: 'SEEK', seconds });
    }
  }

  function setupPostMessages() {
    window.addEventListener('message', (e) => {
      if (!e.data || !e.data[VSC_TAG]) return;
      const msg = e.data;
      switch (msg.type) {
        case 'SET_SPEED':
          if (typeof msg.speed === 'number') {
            currentSpeed = clampSpeed(msg.speed);
            applySpeedToAll();
            postToChildren(msg);
          }
          break;
        case 'SEEK':
          if (typeof msg.seconds === 'number') {
            const playing = Array.from(videoElements).filter((v) => !v.paused);
            const targets = playing.length > 0 ? playing : Array.from(videoElements);
            targets.forEach((v) => {
              try {
                v.currentTime = Math.max(0, v.currentTime + msg.seconds);
              } catch (er) {}
            });
            postToChildren(msg);
          }
          break;
        case 'REQUEST_SPEED':
          if (isTop) {
            postToChildren({ [VSC_TAG]: true, type: 'SET_SPEED', speed: currentSpeed });
          } else {
            try {
              window.parent.postMessage({ [VSC_TAG]: true, type: 'REQUEST_SPEED' }, '*');
            } catch (er) {}
          }
          break;
      }
    });
  }

  function postToChildren(message) {
    const frames = window.frames;
    for (let i = 0; i < frames.length; i++) {
      try {
        frames[i].postMessage(message, '*');
      } catch (e) {}
    }
  }

  function broadcastDown() {
    postToChildren({ [VSC_TAG]: true, type: 'SET_SPEED', speed: currentSpeed });
  }

  function setupFullscreenHandler() {
    const reattach = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (!widget) return;
      if (fsEl && !fsEl.contains(widget)) {
        fsEl.appendChild(widget);
      } else if (!fsEl && widget.parentElement !== document.body) {
        (document.body || document.documentElement).appendChild(widget);
      }
    };
    document.addEventListener('fullscreenchange', reattach);
    document.addEventListener('webkitfullscreenchange', reattach);
  }

  function setupStorageSync() {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[STORAGE_SPEED]) {
          const newSpeed = changes[STORAGE_SPEED].newValue;
          if (typeof newSpeed === 'number' && Math.abs(newSpeed - currentSpeed) > 0.001) {
            currentSpeed = newSpeed;
            applySpeedToAll();
            updateDisplay();
            broadcastDown();
          }
        }
      });
    } catch (e) {}
  }

  function setupRuntimeMessages() {
    try {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        switch (msg && msg.type) {
          case 'GET_STATE':
            sendResponse({
              speed: currentSpeed,
              visible: widgetVisible,
              videoCount: videoElements.size,
              host: HOST,
            });
            return true;
          case 'SET_SPEED':
            if (typeof msg.speed === 'number') setSpeed(msg.speed);
            sendResponse({ ok: true });
            return true;
          case 'TOGGLE_WIDGET':
            toggleWidget(msg.visible);
            sendResponse({ ok: true, visible: widgetVisible });
            return true;
          case 'SEEK':
            seek(msg.seconds || 0);
            sendResponse({ ok: true });
            return true;
        }
      });
    } catch (e) {}
  }
})();
