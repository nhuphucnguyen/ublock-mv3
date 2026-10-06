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

    this.cosmeticEngine.addRules([
      ...defaultAds.cosmeticRules,
      ...defaultAds.cosmeticExceptions,
      ...defaultAds.scriptlets,
      ...defaultAnnoyances.cosmeticRules,
      ...defaultAnnoyances.cosmeticExceptions,
      ...defaultAnnoyances.scriptlets
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
      'ruleset_social'
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
}
