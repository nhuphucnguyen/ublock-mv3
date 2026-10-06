/**
 * Background Service Worker for Manifest V3 Ad Blocker
 */

import { StorageManager } from './storage-manager.js';
import { RuleManager } from './rule-manager.js';
import { parseFilterLine } from '../engine/filter-parser.js';

const ruleManager = new RuleManager();
// Map: tabId -> { blockedRequests: 0, blockedElements: 0, domain: '' }
const tabStats = new Map();

/**
 * Initialize on extension load / startup
 */
let initPromise = null;

/**
 * Initialize on extension load / startup
 */
function initialize() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await StorageManager.init();
    await ruleManager.init();
    console.log('[AdBlock MV3] Service worker initialized successfully.');
  })();
  return initPromise;
}

initialize();

chrome.runtime.onInstalled.addListener(async (details) => {
  await initialize();
  setupContextMenus();
  if (details.reason === 'install') {
    // Set initial badge colors
    chrome.action.setBadgeBackgroundColor({ color: '#851414' });
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await initialize();
});

/**
 * Track blocked network requests in MV3 via Declarative Net Request debug event
 * (available in developer mode/unpacked extensions)
 */
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const tabId = info.request.tabId;
    if (tabId < 0) return;

    if (!tabStats.has(tabId)) {
      tabStats.set(tabId, { blockedRequests: 0, blockedElements: 0, domain: '' });
    }

    const stat = tabStats.get(tabId);
    stat.blockedRequests++;

    updateTabBadge(tabId);
    StorageManager.incrementStats(1, 0);
  });
}

/**
 * Updates badge count for a tab
 */
async function updateTabBadge(tabId) {
  try {
    const settings = await StorageManager.getAllSettings();
    if (!settings.showBadgeCount || !settings.enabled) {
      await chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    const stat = tabStats.get(tabId);
    if (!stat) {
      await chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    // Check if domain is whitelisted
    if (stat.domain) {
      const isWhitelisted = await StorageManager.isDomainWhitelisted(stat.domain);
      if (isWhitelisted) {
        await chrome.action.setBadgeText({ tabId, text: 'OFF' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6c757d' });
        return;
      }
    }

    const total = (stat.blockedRequests || 0) + (stat.blockedElements || 0);
    const text = total > 0 ? (total > 999 ? '999+' : String(total)) : '';
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#851414' });
  } catch (e) {
    // Tab might have closed
  }
}

/**
 * Handle tab life cycle
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      tabStats.set(tabId, {
        blockedRequests: 0,
        blockedElements: 0,
        domain
      });
      updateTabBadge(tabId);
    } catch (e) {
      tabStats.delete(tabId);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStats.delete(tabId);
});

/**
 * Context Menus Setup
 */
function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      // Ignored
    }
    chrome.contextMenus.create({
      id: 'adblock_pick_element',
      title: '⚡ Block element on this page...',
      contexts: ['all']
    }, () => {
      if (chrome.runtime.lastError) {
        // Safely consume lastError to prevent unchecked errors
      }
    });

    chrome.contextMenus.create({
      id: 'adblock_open_options',
      title: '⚙️ Open AdBlock Dashboard',
      contexts: ['action']
    }, () => {
      if (chrome.runtime.lastError) {
        // Safely consume lastError to prevent unchecked errors
      }
    });
  });
}

if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'adblock_pick_element' && tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' });
    } else if (info.menuItemId === 'adblock_open_options') {
      chrome.runtime.openOptionsPage();
    }
  });
}

/**
 * Central Message Router
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleAsync = async () => {
    switch (message.type) {
      case 'GET_TAB_STATE': {
        const tabId = message.tabId;
        const domain = message.domain;
        const settings = await StorageManager.getAllSettings();
        const isWhitelisted = domain ? await StorageManager.isDomainWhitelisted(domain) : false;
        const stat = tabStats.get(tabId) || { blockedRequests: 0, blockedElements: 0 };

        return {
          enabled: settings.enabled,
          isWhitelisted,
          cosmeticEnabled: settings.cosmeticFilteringEnabled,
          tabBlockedRequests: stat.blockedRequests,
          tabBlockedElements: stat.blockedElements,
          totalBlocked: (settings.stats && settings.stats.totalBlocked) || 0,
          totalCosmetic: (settings.stats && settings.stats.totalCosmetic) || 0
        };
      }

      case 'TOGGLE_GLOBAL': {
        const settings = await StorageManager.getAllSettings();
        const newEnabled = !settings.enabled;
        await StorageManager.set({ enabled: newEnabled });
        await ruleManager.applyRulesetsConfig(settings.rulesetsConfig, newEnabled);
        await ruleManager.reloadDynamicRules();

        // Update all badges
        for (const [tabId] of tabStats.entries()) {
          updateTabBadge(tabId);
        }

        return { enabled: newEnabled };
      }

      case 'TOGGLE_DOMAIN': {
        const domain = message.domain;
        if (!domain) return { success: false };

        const isWhitelisted = await StorageManager.isDomainWhitelisted(domain);
        if (isWhitelisted) {
          await StorageManager.removeWhitelistedDomain(domain);
        } else {
          await StorageManager.addWhitelistedDomain(domain);
        }

        await ruleManager.reloadDynamicRules();

        // Update badge for matching tabs
        for (const [tabId, stat] of tabStats.entries()) {
          if (stat.domain === domain) {
            updateTabBadge(tabId);
          }
        }

        return { isWhitelisted: !isWhitelisted };
      }

      case 'GET_COSMETIC_FILTERS': {
        const domain = message.domain || (sender.tab && sender.tab.url ? new URL(sender.tab.url).hostname : '');
        const result = await ruleManager.getCosmeticFiltersForDomain(domain);
        return result;
      }

      case 'REPORT_BLOCKED_ELEMENTS': {
        const count = message.count || 0;
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        if (tabId && tabStats.has(tabId)) {
          const stat = tabStats.get(tabId);
          stat.blockedElements = (stat.blockedElements || 0) + count;
          updateTabBadge(tabId);
        }
        await StorageManager.incrementStats(0, count);
        return { success: true };
      }

      case 'ADD_CUSTOM_FILTER': {
        const filter = message.filter;
        const success = await ruleManager.addFilter(filter);
        return { success };
      }

      case 'SAVE_CUSTOM_FILTERS': {
        await StorageManager.set({ customFilters: message.customFilters });
        await ruleManager.reloadDynamicRules();
        return { success: true };
      }

      case 'GET_ALL_DATA': {
        const settings = await StorageManager.getAllSettings();
        return { settings };
      }

      case 'SAVE_SETTINGS': {
        const { settings } = message;
        await StorageManager.set(settings);
        await ruleManager.applyRulesetsConfig(settings.rulesetsConfig, settings.enabled);
        await ruleManager.reloadDynamicRules();
        return { success: true };
      }

      case 'TEST_FILTER_RULE': {
        const line = message.line;
        const parsed = parseFilterLine(line);
        return { parsed };
      }

      default:
        return { error: 'Unknown message type' };
    }
  };

  handleAsync().then(sendResponse).catch(err => {
    sendResponse({ error: err.message });
  });

  return true; // Keep message port open for async response
});
