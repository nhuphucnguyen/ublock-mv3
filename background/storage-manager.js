/**
 * Storage Manager - Handles persistent configuration and state via chrome.storage.local
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  cosmeticFilteringEnabled: true,
  showBadgeCount: true,
  whitelistedDomains: [],
  rulesetsConfig: {
    'ruleset_default': true,
    'ruleset_privacy': true,
    'ruleset_annoyances': true,
    'ruleset_social': false,
    'ruleset_abpvn': true
  },
  customFilters: `! My Custom Filters\n! Add your ABP / uBlock Origin syntax filters here\n! Example: ||example-ad.com^\n! Example: site.com##.sponsor-banner\n`,
  customSubscriptions: [
    {
      id: 'sub_abpvn',
      name: 'ABPVN List (Vietnam)',
      url: 'https://abpvn.com/filter/abpvn-lpQf4a.txt',
      enabled: true,
      ruleCount: 1061,
      lastUpdated: new Date().toLocaleDateString()
    }
  ],
  stats: {
    totalBlocked: 0,
    totalCosmetic: 0
  }
};

export class StorageManager {
  static async get(keys = null) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (items) => {
          resolve(items || {});
        });
      });
    }
    // In-memory fallback (e.g. during testing)
    return { ...DEFAULT_SETTINGS };
  }

  static async set(items) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set(items, () => {
          resolve();
        });
      });
    }
  }

  static async init() {
    const current = await this.get(null);
    const updates = {};
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      if (current[key] === undefined) {
        updates[key] = val;
      }
    }
    if (Object.keys(updates).length > 0) {
      await this.set(updates);
    }
    return { ...DEFAULT_SETTINGS, ...current, ...updates };
  }

  static async getAllSettings() {
    const data = await this.get(null);
    return { ...DEFAULT_SETTINGS, ...data };
  }

  static async isDomainWhitelisted(domain) {
    if (!domain) return false;
    const { whitelistedDomains = [] } = await this.get('whitelistedDomains');
    const clean = domain.toLowerCase().trim();
    return whitelistedDomains.some(d => clean === d || clean.endsWith('.' + d));
  }

  static async addWhitelistedDomain(domain) {
    if (!domain) return;
    const clean = domain.toLowerCase().trim();
    const { whitelistedDomains = [] } = await this.get('whitelistedDomains');
    if (!whitelistedDomains.includes(clean)) {
      whitelistedDomains.push(clean);
      await this.set({ whitelistedDomains });
    }
  }

  static async removeWhitelistedDomain(domain) {
    if (!domain) return;
    const clean = domain.toLowerCase().trim();
    const { whitelistedDomains = [] } = await this.get('whitelistedDomains');
    const filtered = whitelistedDomains.filter(d => d !== clean);
    await this.set({ whitelistedDomains: filtered });
  }

  static async incrementStats(blockedCount = 1, cosmeticCount = 0) {
    const { stats = { totalBlocked: 0, totalCosmetic: 0 } } = await this.get('stats');
    stats.totalBlocked = (stats.totalBlocked || 0) + blockedCount;
    stats.totalCosmetic = (stats.totalCosmetic || 0) + cosmeticCount;
    await this.set({ stats });
  }
}
