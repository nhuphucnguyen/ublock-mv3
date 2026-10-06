/**
 * Options Dashboard Controller
 */

import { parseFilterList, parseFilterLine } from '../engine/filter-parser.js';
import { compileToDnrRule } from '../engine/dnr-compiler.js';

document.addEventListener('DOMContentLoaded', async () => {
  let currentSettings = null;

  // DOM Elements
  const tabButtons = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const toast = document.getElementById('toast');

  // Tab 1: Settings
  const prefEnabled = document.getElementById('pref-enabled');
  const prefCosmetic = document.getElementById('pref-cosmetic');
  const prefBadge = document.getElementById('pref-badge');
  const btnBackupExport = document.getElementById('btn-backup-export');
  const btnBackupImport = document.getElementById('btn-backup-import');
  const fileImportInput = document.getElementById('file-import-input');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');
  const sbTotalBlocked = document.getElementById('sb-total-blocked');

  // Tab 2: Filter Lists
  const rsDefault = document.getElementById('rs-ruleset_default');
  const rsPrivacy = document.getElementById('rs-ruleset_privacy');
  const rsAnnoyances = document.getElementById('rs-ruleset_annoyances');
  const rsSocial = document.getElementById('rs-ruleset_social');
  const rsAbpvn = document.getElementById('rs-ruleset_abpvn');
  const subUrlInput = document.getElementById('sub-url-input');
  const btnAddSubscription = document.getElementById('btn-add-subscription');
  const customSubsList = document.getElementById('custom-subs-list');

  // Tab 3: My Filters
  const editor = document.getElementById('myfilters-editor');
  const myfiltersStats = document.getElementById('myfilters-stats');
  const btnApplyFilters = document.getElementById('btn-apply-filters');
  const btnRevertFilters = document.getElementById('btn-revert-filters');

  // Tab 4: Trusted Sites
  const trustedInput = document.getElementById('trusted-domain-input');
  const btnAddTrusted = document.getElementById('btn-add-trusted');
  const trustedCount = document.getElementById('trusted-count');
  const trustedContainer = document.getElementById('trusted-list-container');
  const btnClearTrusted = document.getElementById('btn-clear-trusted');

  // Tab 5: Rule Tester
  const testRuleInput = document.getElementById('test-rule-input');
  const btnRunTestRule = document.getElementById('btn-run-test-rule');
  const testRuleOutput = document.getElementById('test-rule-output');

  // Tab navigation
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Load all data
  async function loadData() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_DATA' });
    if (!response || !response.settings) return;

    currentSettings = response.settings;

    // 1. Settings tab
    prefEnabled.checked = currentSettings.enabled !== false;
    prefCosmetic.checked = currentSettings.cosmeticFilteringEnabled !== false;
    prefBadge.checked = currentSettings.showBadgeCount !== false;

    const totalStats = (currentSettings.stats && (currentSettings.stats.totalBlocked + currentSettings.stats.totalCosmetic)) || 0;
    sbTotalBlocked.textContent = totalStats.toLocaleString();

    // 2. Rulesets tab
    const rs = currentSettings.rulesetsConfig || {};
    rsDefault.checked = rs.ruleset_default !== false;
    rsPrivacy.checked = rs.ruleset_privacy !== false;
    rsAnnoyances.checked = rs.ruleset_annoyances !== false;
    rsSocial.checked = rs.ruleset_social === true;
    if (rsAbpvn) rsAbpvn.checked = rs.ruleset_abpvn !== false;
    renderSubscriptions();

    // 3. My Filters
    editor.value = currentSettings.customFilters || '';
    updateFilterStats();

    // 4. Trusted Sites
    renderTrustedSites();
  }

  // Save updated settings
  async function saveSettings() {
    if (!currentSettings) return;

    currentSettings.enabled = prefEnabled.checked;
    currentSettings.cosmeticFilteringEnabled = prefCosmetic.checked;
    currentSettings.showBadgeCount = prefBadge.checked;

    currentSettings.rulesetsConfig = {
      ruleset_default: rsDefault.checked,
      ruleset_privacy: rsPrivacy.checked,
      ruleset_annoyances: rsAnnoyances.checked,
      ruleset_social: rsSocial.checked,
      ruleset_abpvn: rsAbpvn ? rsAbpvn.checked : true
    };

    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: currentSettings
    });

    showToast('Settings updated successfully');
  }

  // Attach Settings events
  prefEnabled.addEventListener('change', saveSettings);
  prefCosmetic.addEventListener('change', saveSettings);
  prefBadge.addEventListener('change', saveSettings);

  rsDefault.addEventListener('change', saveSettings);
  rsPrivacy.addEventListener('change', saveSettings);
  rsAnnoyances.addEventListener('change', saveSettings);
  rsSocial.addEventListener('change', saveSettings);
  if (rsAbpvn) rsAbpvn.addEventListener('change', saveSettings);

  // Backup export
  btnBackupExport.addEventListener('click', () => {
    const backupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings: currentSettings
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ublock-mv3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup file downloaded');
  });

  // Backup import
  btnBackupImport.addEventListener('click', () => {
    fileImportInput.click();
  });

  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.settings) {
          currentSettings = imported.settings;
          await chrome.runtime.sendMessage({
            type: 'SAVE_SETTINGS',
            settings: currentSettings
          });
          if (currentSettings.customFilters) {
            await chrome.runtime.sendMessage({
              type: 'SAVE_CUSTOM_FILTERS',
              customFilters: currentSettings.customFilters
            });
          }
          await loadData();
          showToast('Configuration restored successfully');
        }
      } catch (err) {
        alert('Failed to parse backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Reset to defaults
  btnResetDefaults.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all AdBlock settings and filters to default?')) {
      await chrome.storage.local.clear();
      await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: {} });
      await loadData();
      showToast('Settings reset to defaults');
    }
  });

  // My Filters tab
  function updateFilterStats() {
    const text = editor.value;
    const parsed = parseFilterList(text);
    const netCount = parsed.networkRules.length;
    const cosCount = parsed.cosmeticRules.length + parsed.cosmeticExceptions.length + parsed.scriptlets.length;
    const total = netCount + cosCount;
    myfiltersStats.textContent = `${total} active rule${total === 1 ? '' : 's'} (${netCount} network, ${cosCount} cosmetic)`;
  }

  editor.addEventListener('input', updateFilterStats);

  btnApplyFilters.addEventListener('click', async () => {
    const newFilters = editor.value;
    await chrome.runtime.sendMessage({
      type: 'SAVE_CUSTOM_FILTERS',
      customFilters: newFilters
    });
    currentSettings.customFilters = newFilters;
    showToast('Custom filters saved & compiled');
    updateFilterStats();
  });

  btnRevertFilters.addEventListener('click', () => {
    editor.value = currentSettings.customFilters || '';
    updateFilterStats();
    showToast('Reverted custom filters');
  });

  // Trusted Sites tab
  function renderTrustedSites() {
    const domains = currentSettings.whitelistedDomains || [];
    trustedCount.textContent = domains.length;
    trustedContainer.innerHTML = '';

    if (domains.length === 0) {
      trustedContainer.innerHTML = '<p class="empty-state">No trusted domains yet. All sites are protected.</p>';
      return;
    }

    domains.forEach(domain => {
      const tag = document.createElement('div');
      tag.className = 'trusted-tag';
      tag.innerHTML = `
        <span>${domain}</span>
        <button class="remove-btn" title="Remove">&times;</button>
      `;

      tag.querySelector('.remove-btn').addEventListener('click', async () => {
        await chrome.runtime.sendMessage({
          type: 'TOGGLE_DOMAIN',
          domain
        });
        currentSettings.whitelistedDomains = currentSettings.whitelistedDomains.filter(d => d !== domain);
        renderTrustedSites();
        showToast(`Removed ${domain} from trusted sites`);
      });

      trustedContainer.appendChild(tag);
    });
  }

  btnAddTrusted.addEventListener('click', async () => {
    const val = trustedInput.value.trim().toLowerCase();
    if (!val) return;

    // Strip http/https or paths
    let clean = val;
    try {
      if (val.includes('://')) {
        clean = new URL(val).hostname;
      } else if (val.includes('/')) {
        clean = val.split('/')[0];
      }
    } catch (e) {}

    await chrome.runtime.sendMessage({
      type: 'TOGGLE_DOMAIN',
      domain: clean
    });

    if (!currentSettings.whitelistedDomains.includes(clean)) {
      currentSettings.whitelistedDomains.push(clean);
    }
    trustedInput.value = '';
    renderTrustedSites();
    showToast(`Added ${clean} to trusted sites`);
  });

  btnClearTrusted.addEventListener('click', async () => {
    if (confirm('Clear all trusted sites?')) {
      for (const d of [...currentSettings.whitelistedDomains]) {
        await chrome.runtime.sendMessage({ type: 'TOGGLE_DOMAIN', domain: d });
      }
      currentSettings.whitelistedDomains = [];
      renderTrustedSites();
      showToast('Trusted sites cleared');
    }
  });

  // Subscriptions
  function renderSubscriptions() {
    const subs = currentSettings.customSubscriptions || [];
    customSubsList.innerHTML = '';

    if (subs.length === 0) {
      customSubsList.innerHTML = '<p class="empty-state">No custom subscriptions added yet.</p>';
      return;
    }

    subs.forEach(sub => {
      const item = document.createElement('div');
      item.className = 'ruleset-card';
      item.innerHTML = `
        <div class="ruleset-meta">
          <h4>${sub.name || 'Custom List'}</h4>
          <p>${sub.url}</p>
          <div class="ruleset-tags">
            <span class="mini-tag">${sub.ruleCount || 0} rules</span>
            <span class="mini-tag">Updated: ${sub.lastUpdated || 'Recently'}</span>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm btn-update-sub">Update</button>
          <button class="btn btn-danger btn-sm btn-del-sub">Delete</button>
        </div>
      `;

      const updateBtn = item.querySelector('.btn-update-sub');
      updateBtn.addEventListener('click', async () => {
        updateBtn.disabled = true;
        updateBtn.textContent = 'Updating...';
        showToast(`Updating ${sub.name}...`);

        try {
          const res = await chrome.runtime.sendMessage({
            type: 'UPDATE_SUBSCRIPTION',
            url: sub.url
          });

          if (res && res.success) {
            showToast(`Updated ${sub.name} (${res.networkCount + res.cosmeticCount} rules)`);
            await loadData();
          } else {
            showToast(`Update failed: ${res?.error || 'Network error'}`);
            updateBtn.disabled = false;
            updateBtn.textContent = 'Update';
          }
        } catch (e) {
          showToast(`Update failed: ${e.message}`);
          updateBtn.disabled = false;
          updateBtn.textContent = 'Update';
        }
      });

      item.querySelector('.btn-del-sub').addEventListener('click', async () => {
        currentSettings.customSubscriptions = currentSettings.customSubscriptions.filter(s => s.url !== sub.url);
        await saveSettings();
        renderSubscriptions();
      });

      customSubsList.appendChild(item);
    });
  }

  btnAddSubscription.addEventListener('click', async () => {
    const url = subUrlInput.value.trim();
    if (!url) return;

    const newSub = {
      id: 'sub_' + Date.now(),
      name: url.split('/').pop() || 'Custom Subscription',
      url,
      enabled: true,
      ruleCount: 0,
      lastUpdated: new Date().toLocaleDateString()
    };

    if (!currentSettings.customSubscriptions) {
      currentSettings.customSubscriptions = [];
    }
    currentSettings.customSubscriptions.push(newSub);
    await saveSettings();
    subUrlInput.value = '';
    renderSubscriptions();
    showToast('Filter subscription added');
  });

  // Rule Tester / Inspector
  function runTestRule() {
    const line = testRuleInput.value.trim();
    if (!line) {
      testRuleOutput.textContent = 'Please enter a rule to analyze.';
      return;
    }

    const parsed = parseFilterLine(line);
    if (!parsed) {
      testRuleOutput.textContent = `// Rule is ignored, empty, or invalid comment\nRule: "${line}"`;
      return;
    }

    let dnrResult = null;
    if (parsed.type === 'network') {
      dnrResult = compileToDnrRule(parsed, 12345);
    }

    const outputObj = {
      originalLine: line,
      parsedSyntax: parsed,
      declarativeNetRequestRule: dnrResult
    };

    testRuleOutput.textContent = JSON.stringify(outputObj, null, 2);
  }

  btnRunTestRule.addEventListener('click', runTestRule);
  testRuleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runTestRule();
  });

  // Initial load
  await loadData();
  runTestRule();
});
