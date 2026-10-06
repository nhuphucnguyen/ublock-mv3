/**
 * Cosmetic Engine - Handles element hiding rules, domain matching, and CSS generation.
 */

export class CosmeticEngine {
  constructor() {
    this.genericRules = new Set();
    this.domainRules = new Map(); // domain -> Set of selectors
    this.domainExceptions = new Map(); // domain -> Set of selectors
    this.domainScriptlets = new Map(); // domain -> Array of { name, args }
  }

  /**
   * Resets all loaded cosmetic rules.
   */
  clear() {
    this.genericRules.clear();
    this.domainRules.clear();
    this.domainExceptions.clear();
    this.domainScriptlets.clear();
  }

  /**
   * Adds parsed cosmetic rules.
   * @param {Array<object>} rules - Array of parsed cosmetic rule objects
   */
  addRules(rules) {
    for (const rule of rules) {
      if (!rule) continue;

      if (rule.type === 'cosmetic') {
        if (rule.isGeneric) {
          this.genericRules.add(rule.selector);
        } else {
          for (const domain of rule.domains) {
            if (!this.domainRules.has(domain)) {
              this.domainRules.set(domain, new Set());
            }
            this.domainRules.get(domain).add(rule.selector);
          }
        }
      } else if (rule.type === 'cosmetic_exception') {
        for (const domain of rule.domains) {
          if (!this.domainExceptions.has(domain)) {
            this.domainExceptions.set(domain, new Set());
          }
          this.domainExceptions.get(domain).add(rule.selector);
        }
      } else if (rule.type === 'scriptlet') {
        for (const domain of rule.domains) {
          if (!this.domainScriptlets.has(domain)) {
            this.domainScriptlets.set(domain, []);
          }
          this.domainScriptlets.get(domain).push({
            name: rule.name,
            args: rule.args
          });
        }
      }
    }
  }

  /**
   * Extracts domain suffixes for hierarchy matching.
   * E.g. "sub.example.co.uk" -> ["sub.example.co.uk", "example.co.uk", "co.uk"]
   * or "news.ycombinator.com" -> ["news.ycombinator.com", "ycombinator.com"]
   */
  getDomainHierarchy(hostname) {
    if (!hostname) return [];
    const clean = hostname.toLowerCase().trim();
    const parts = clean.split('.');
    const domains = [];

    for (let i = 0; i < parts.length - 1; i++) {
      domains.push(parts.slice(i).join('.'));
    }
    return domains;
  }

  /**
   * Resolves active cosmetic filters and scriptlets for a given hostname.
   * @param {string} hostname
   * @param {boolean} [includeGeneric=true]
   * @returns {object} { selectors: string[], scriptlets: Array, css: string }
   */
  getFiltersForHost(hostname, includeGeneric = true) {
    const matchedSelectors = new Set();
    const exceptions = new Set();
    const scriptlets = [];

    const domains = this.getDomainHierarchy(hostname);

    // 1. Collect generic rules
    if (includeGeneric) {
      for (const sel of this.genericRules) {
        matchedSelectors.add(sel);
      }
    }

    // 2. Collect domain-specific rules and exceptions
    for (const d of domains) {
      if (this.domainRules.has(d)) {
        for (const sel of this.domainRules.get(d)) {
          matchedSelectors.add(sel);
        }
      }
      if (this.domainExceptions.has(d)) {
        for (const sel of this.domainExceptions.get(d)) {
          exceptions.add(sel);
        }
      }
      if (this.domainScriptlets.has(d)) {
        scriptlets.push(...this.domainScriptlets.get(d));
      }
    }

    // 3. Remove excepted selectors
    for (const exc of exceptions) {
      matchedSelectors.delete(exc);
    }

    // 4. Separate standard CSS selectors from procedural selectors (:has, :-abp-contains, etc.)
    const standardSelectors = [];
    const proceduralSelectors = [];

    for (const sel of matchedSelectors) {
      if (sel.includes(':-abp-contains(') || sel.includes(':has-text(') || sel.includes(':xpath(')) {
        proceduralSelectors.push(sel);
      } else {
        standardSelectors.push(sel);
      }
    }

    // 5. Generate CSS stylesheet string
    let css = '';
    if (standardSelectors.length > 0) {
      css = standardSelectors.join(',\n') +
        ' {\n  display: none !important;\n  visibility: hidden !important;\n  height: 0 !important;\n  min-height: 0 !important;\n  max-height: 0 !important;\n}\n';
    }

    return {
      selectors: Array.from(matchedSelectors),
      standardSelectors,
      proceduralSelectors,
      scriptlets,
      css
    };
  }

  /**
   * Serializes engine rules to JSON for storage.
   */
  toJSON() {
    return {
      genericRules: Array.from(this.genericRules),
      domainRules: Array.from(this.domainRules.entries()).map(([k, v]) => [k, Array.from(v)]),
      domainExceptions: Array.from(this.domainExceptions.entries()).map(([k, v]) => [k, Array.from(v)]),
      domainScriptlets: Array.from(this.domainScriptlets.entries())
    };
  }

  /**
   * Restores engine state from JSON.
   */
  fromJSON(data) {
    this.clear();
    if (!data) return;
    if (data.genericRules) {
      this.genericRules = new Set(data.genericRules);
    }
    if (data.domainRules) {
      this.domainRules = new Map(data.domainRules.map(([k, v]) => [k, new Set(v)]));
    }
    if (data.domainExceptions) {
      this.domainExceptions = new Map(data.domainExceptions.map(([k, v]) => [k, new Set(v)]));
    }
    if (data.domainScriptlets) {
      this.domainScriptlets = new Map(data.domainScriptlets);
    }
  }
}
