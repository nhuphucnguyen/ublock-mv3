/**
 * Rule Manager - Coordinates Declarative Net Request rules and Cosmetic Engine
 */

import { parseFilterList, parseFilterLine } from '../engine/filter-parser.js';
import { compileRuleList, compileWhitelistRules } from '../engine/dnr-compiler.js';
import { CosmeticEngine } from '../engine/cosmetic-engine.js';
import {
  DEFAULT_ADS_RULES,
  DEFAULT_PRIVACY_RULES,
  DEFAULT_ANNOYANCES_RULES,
  DEFAULT_SOCIAL_RULES
} from '../engine/default-rules.js';
import { ABPVN_RULES } from '../engine/abpvn-rules.js';
import { StorageManager } from './storage-manager.js';

export class RuleManager {
  constructor() {
    this.cosmeticEngine = new CosmeticEngine();
    this.customDnrRules = [];
    this.whitelistDnrRules = [];
  }

  /**
   * Initializes rule manager, static rulesets, and cosmetic engine.
   */
  async init() {
    const settings = await StorageManager.getAllSettings();

    // 1. Initialize static rulesets
    await this.applyRulesetsConfig(settings.rulesetsConfig, settings.enabled);

    // 2. Load default cosmetic rules into engine
    this.cosmeticEngine.clear();
    const defaultAds = parseFilterList(DEFAULT_ADS_RULES);
    const defaultAnnoyances = parseFilterList(DEFAULT_ANNOYANCES_RULES);
    const abpvnParsed = parseFilterList(ABPVN_RULES);

    this.cosmeticEngine.addRules([
      ...defaultAds.cosmeticRules,
      ...defaultAds.cosmeticExceptions,
      ...defaultAds.scriptlets,
      ...defaultAnnoyances.cosmeticRules,
      ...defaultAnnoyances.cosmeticExceptions,
      ...defaultAnnoyances.scriptlets,
      ...abpvnParsed.cosmeticRules,
      ...abpvnParsed.cosmeticExceptions,
      ...abpvnParsed.scriptlets
    ]);

    // 3. Load custom rules and whitelist
    await this.reloadDynamicRules();
  }

  /**
   * Configures enabled static rulesets in DNR.
   */
  async applyRulesetsConfig(rulesetsConfig = {}, globalEnabled = true) {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) return;

    const enableRulesetIds = [];
    const disableRulesetIds = [];

    const allRulesets = [
      'ruleset_default',
      'ruleset_privacy',
      'ruleset_annoyances',
      'ruleset_social',
      'ruleset_abpvn'
    ];

    for (const id of allRulesets) {
      if (globalEnabled && rulesetsConfig[id]) {
        enableRulesetIds.push(id);
      } else {
        disableRulesetIds.push(id);
      }
    }

    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds,
        disableRulesetIds
      });
    } catch (err) {
      console.warn('[AdBlock] Error updating static rulesets:', err);
    }
  }

  /**
   * Reloads dynamic rules: custom filters + whitelisted domains.
   */
  async reloadDynamicRules() {
    const settings = await StorageManager.getAllSettings();

    // Parse custom filters
    const parsedCustom = parseFilterList(settings.customFilters || '');

    // Add custom cosmetic rules and scriptlets to cosmetic engine
    this.cosmeticEngine.addRules([
      ...parsedCustom.cosmeticRules,
      ...parsedCustom.cosmeticExceptions,
      ...parsedCustom.scriptlets
    ]);

    // Compile network custom rules (IDs start at 50000)
    const customDnr = compileRuleList(parsedCustom.networkRules, 50000);

    // Compile whitelisted domain allow rules (IDs start at 80000)
    const whitelistDnr = compileWhitelistRules(settings.whitelistedDomains || [], 80000);

    const newRules = settings.enabled ? [...customDnr, ...whitelistDnr] : [...whitelistDnr];

    // Update dynamic rules in Chrome
    if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
      try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = existingRules.map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules: newRules
        });
      } catch (err) {
        console.warn('[AdBlock] Error updating dynamic rules:', err);
      }
    }
  }

  /**
   * Appends a new filter rule (e.g. from Element Picker or UI)
   */
  async addFilter(ruleText) {
    if (!ruleText || !ruleText.trim()) return false;
    const clean = ruleText.trim();

    const { customFilters = '' } = await StorageManager.get('customFilters');
    const updated = customFilters + '\n' + clean;
    await StorageManager.set({ customFilters: updated });

    // Instantly add to cosmetic engine if cosmetic
    const parsed = parseFilterLine(clean);
    if (parsed) {
      if (parsed.type === 'cosmetic' || parsed.type === 'cosmetic_exception' || parsed.type === 'scriptlet') {
        this.cosmeticEngine.addRules([parsed]);
      } else if (parsed.type === 'network') {
        await this.reloadDynamicRules();
      }
    }

    return true;
  }

  /**
   * Retrieves matching cosmetic filters and scriptlets for a hostname.
   */
  async getCosmeticFiltersForDomain(hostname) {
    const settings = await StorageManager.getAllSettings();

    // Check if globally disabled or domain is whitelisted
    if (!settings.enabled || !settings.cosmeticFilteringEnabled) {
      return { disabled: true, selectors: [], scriptlets: [], css: '' };
    }

    const isWhitelisted = await StorageManager.isDomainWhitelisted(hostname);
    if (isWhitelisted) {
      return { disabled: true, whitelisted: true, selectors: [], scriptlets: [], css: '' };
    }

    const filters = this.cosmeticEngine.getFiltersForHost(hostname);
    return {
      disabled: false,
      whitelisted: false,
      ...filters
    };
  }

  /**
   * Fetches an external filter subscription and applies updates.
   */
  async updateSubscription(url) {
    if (!url) return { success: false, error: 'No URL provided' };
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const parsed = parseFilterList(text);

      // Add cosmetic rules into engine
      this.cosmeticEngine.addRules([
        ...parsed.cosmeticRules,
        ...parsed.cosmeticExceptions,
        ...parsed.scriptlets
      ]);

      // Compile dynamic DNR rules
      const dynamicDnr = compileRuleList(parsed.networkRules, 60000);
      if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingSubRuleIds = existingRules.filter(r => r.id >= 60000 && r.id < 80000).map(r => r.id);
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingSubRuleIds,
          addRules: dynamicDnr
        });
      }

      // Update storage subscription record
      const settings = await StorageManager.getAllSettings();
      const subs = settings.customSubscriptions || [];
      const totalRules = parsed.networkRules.length + parsed.cosmeticRules.length;
      const targetSub = subs.find(s => s.url === url);
      if (targetSub) {
        targetSub.ruleCount = totalRules;
        targetSub.lastUpdated = new Date().toLocaleDateString();
      }
      await StorageManager.set({ customSubscriptions: subs });

      return {
        success: true,
        networkCount: parsed.networkRules.length,
        cosmeticCount: parsed.cosmeticRules.length
      };
    } catch (err) {
      console.warn('[AdBlock] Failed to update subscription:', err);
      return { success: false, error: err.message };
    }
  }
}
