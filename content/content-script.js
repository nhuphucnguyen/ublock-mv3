/**
 * Content Script - Injected into pages for Cosmetic Filtering and Scriptlet Execution
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__ublockMv3Injected) return;
  window.__ublockMv3Injected = true;

  let activeStyleEl = null;
  let hiddenElementCount = 0;
  let activeSelectors = [];

  /**
   * Request cosmetic filters from service worker
   */
  async function initCosmeticFiltering(retries = 3) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_COSMETIC_FILTERS',
        domain: window.location.hostname
      });

      if (!response) {
        if (retries > 0) {
          setTimeout(() => initCosmeticFiltering(retries - 1), 250);
        }
        return;
      }

      if (response.disabled || response.whitelisted) {
        return;
      }

      // 1. Inject CSS rules
      if (response.css && response.css.trim()) {
        injectStyleSheet(response.css);
      }

      activeSelectors = response.standardSelectors || [];

      // 2. Execute Scriptlets if present
      if (response.scriptlets && response.scriptlets.length > 0) {
        injectScriptlets(response.scriptlets);
      }

      // 3. Count hidden elements and observe dynamic mutations
      setupDOMObservation(activeSelectors, response.proceduralSelectors || []);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => initCosmeticFiltering(retries - 1), 300);
      }
    }
  }

  /**
   * Fast CSS injection into DOM
   */
  function injectStyleSheet(cssText) {
    if (!activeStyleEl) {
      activeStyleEl = document.createElement('style');
      activeStyleEl.id = 'ublock-mv3-cosmetic-styles';
      activeStyleEl.type = 'text/css';
    }

    activeStyleEl.textContent = cssText;

    const append = () => {
      const target = document.head || document.documentElement || document.body;
      if (target && !document.getElementById('ublock-mv3-cosmetic-styles')) {
        target.appendChild(activeStyleEl);
      }
    };

    append();
    if (!document.getElementById('ublock-mv3-cosmetic-styles')) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', append, { once: true });
      }
    }
  }

  /**
   * Safely inject scriptlets into page execution world
   */
  function injectScriptlets(scriptlets) {
    // In MV3, scriptlets can be appended via inline script element or world: MAIN
    for (const item of scriptlets) {
      try {
        const script = document.createElement('script');
        script.textContent = `/* AdBlock Scriptlet: ${item.name} */\n`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      } catch (e) {}
    }
  }

  /**
   * Monitor DOM to count hidden elements and handle procedural selectors
   */
  function setupDOMObservation(selectors, proceduralSelectors) {
    let reportTimer = null;

    function evaluateDOM() {
      if (selectors.length === 0 && proceduralSelectors.length === 0) return;

      let newCount = 0;

      // Sample common selectors for element counting
      const sample = selectors.slice(0, 30);
      for (const sel of sample) {
        try {
          const els = document.querySelectorAll(sel);
          newCount += els.length;
        } catch (e) {}
      }

      // Handle procedural selectors like :-abp-contains()
      for (const pSel of proceduralSelectors) {
        try {
          applyProceduralSelector(pSel);
        } catch (e) {}
      }

      if (newCount !== hiddenElementCount) {
        hiddenElementCount = newCount;
        if (reportTimer) clearTimeout(reportTimer);
        reportTimer = setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'REPORT_BLOCKED_ELEMENTS',
            count: hiddenElementCount
          }).catch(() => {});
        }, 500);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', evaluateDOM, { once: true });
    } else {
      evaluateDOM();
    }

    // Debounced MutationObserver for dynamically loaded ads
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        evaluateDOM();
      }, 1000);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Evaluates procedural selector on DOM elements
   */
  function applyProceduralSelector(selector) {
    const match = selector.match(/^(.*?):-abp-contains\((.*?)\)$/);
    if (!match) return;

    const baseSel = match[1].trim() || '*';
    const textToMatch = match[2].trim().replace(/^['"]|['"]$/g, '');

    const candidates = document.querySelectorAll(baseSel);
    for (const el of candidates) {
      if (el.textContent && el.textContent.includes(textToMatch)) {
        el.style.setProperty('display', 'none', 'important');
      }
    }
  }

  // Handle runtime messages (e.g. from popup or context menu)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_ELEMENT_PICKER') {
      if (window.UBlockElementPicker) {
        window.UBlockElementPicker.start();
        sendResponse({ started: true });
      }
    } else if (message.type === 'PREVIEW_SELECTOR') {
      previewSelector(message.selector);
      sendResponse({ success: true });
    } else if (message.type === 'CLEAR_PREVIEW') {
      clearPreview();
      sendResponse({ success: true });
    }
  });

  let previewStyleEl = null;

  function previewSelector(selector) {
    clearPreview();
    if (!selector) return;
    previewStyleEl = document.createElement('style');
    previewStyleEl.id = 'ublock-preview-style';
    previewStyleEl.textContent = `${selector} { display: none !important; }`;
    (document.head || document.documentElement).appendChild(previewStyleEl);
  }

  function clearPreview() {
    if (previewStyleEl) {
      previewStyleEl.remove();
      previewStyleEl = null;
    }
  }

  // Run initialization
  initCosmeticFiltering();
})();
