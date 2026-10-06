/**
 * Popup Script - Controls uBlock Lite Popup UI
 */

document.addEventListener('DOMContentLoaded', async () => {
  const domainEl = document.getElementById('site-domain');
  const statusEl = document.getElementById('site-status');
  const btnPower = document.getElementById('btn-power');
  const statPageBlocked = document.getElementById('stat-page-blocked');
  const statReqBlocked = document.getElementById('stat-req-blocked');
  const statElemBlocked = document.getElementById('stat-elem-blocked');
  const statTotalBlocked = document.getElementById('stat-total-blocked');
  const btnDashboard = document.getElementById('btn-dashboard');
  const btnPickElement = document.getElementById('btn-pick-element');
  const btnReloadTab = document.getElementById('btn-reload-tab');
  const btnToggleGlobal = document.getElementById('btn-toggle-global');
  const globalToggleText = document.getElementById('global-toggle-text');

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    domainEl.textContent = 'No active page';
    statusEl.textContent = 'Inactive';
    btnPower.classList.add('inactive');
    return;
  }

  let domain = '';
  try {
    const url = new URL(tab.url);
    if (url.protocol.startsWith('http')) {
      domain = url.hostname;
    } else {
      domain = url.protocol.replace(':', '');
    }
  } catch (e) {
    domain = 'Special Page';
  }

  domainEl.textContent = domain;

  const isSpecialPage = !tab.url.startsWith('http://') && !tab.url.startsWith('https://');

  if (isSpecialPage) {
    statusEl.textContent = 'Cannot filter browser pages';
    statusEl.classList.add('disabled');
    btnPower.classList.add('inactive');
    btnPower.disabled = true;
    btnPickElement.disabled = true;
    return;
  }

  // Fetch tab state
  async function refreshState() {
    try {
      const state = await chrome.runtime.sendMessage({
        type: 'GET_TAB_STATE',
        tabId: tab.id,
        domain
      });

      if (!state) return;

      const isProtected = state.enabled && !state.isWhitelisted;

      // Update Power button & Status
      if (!state.enabled) {
        btnPower.classList.remove('active');
        btnPower.classList.add('inactive');
        statusEl.textContent = 'AdBlock is turned off globally';
        statusEl.classList.add('disabled');
      } else if (state.isWhitelisted) {
        btnPower.classList.remove('active');
        btnPower.classList.add('inactive');
        statusEl.textContent = 'Disabled on this site';
        statusEl.classList.add('disabled');
      } else {
        btnPower.classList.add('active');
        btnPower.classList.remove('inactive');
        statusEl.textContent = 'Protected';
        statusEl.classList.remove('disabled');
      }

      // Update Stats
      const pageTotal = (state.tabBlockedRequests || 0) + (state.tabBlockedElements || 0);
      statPageBlocked.textContent = pageTotal;
      statReqBlocked.textContent = state.tabBlockedRequests || 0;
      statElemBlocked.textContent = state.tabBlockedElements || 0;

      const totalLifetime = (state.totalBlocked || 0) + (state.totalCosmetic || 0);
      statTotalBlocked.textContent = totalLifetime.toLocaleString();

      // Update Global button state
      if (!state.enabled) {
        btnToggleGlobal.classList.remove('active');
        globalToggleText.textContent = 'Off';
      } else {
        btnToggleGlobal.classList.add('active');
        globalToggleText.textContent = 'On';
      }
    } catch (err) {
      console.warn('[Popup] Error refreshing state:', err);
    }
  }

  await refreshState();

  // Power Button toggle (site-level)
  btnPower.addEventListener('click', async () => {
    btnPower.style.transform = 'scale(0.92)';
    setTimeout(() => { btnPower.style.transform = ''; }, 150);

    await chrome.runtime.sendMessage({
      type: 'TOGGLE_DOMAIN',
      domain
    });

    await refreshState();

    // Reload tab to immediately apply
    chrome.tabs.reload(tab.id);
  });

  // Global toggle
  btnToggleGlobal.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'TOGGLE_GLOBAL' });
    await refreshState();
    chrome.tabs.reload(tab.id);
  });

  // Reload current tab
  btnReloadTab.addEventListener('click', () => {
    chrome.tabs.reload(tab.id);
    window.close();
  });

  // Start Element Picker
  btnPickElement.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' });
    } catch (e) {
      // Content script might not be injected, inject programmatically
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/element-picker.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/element-picker.js']
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' });
    }
    window.close();
  });

  // Open Dashboard Options page
  btnDashboard.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
});
