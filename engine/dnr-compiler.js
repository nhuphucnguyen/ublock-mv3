/**
 * DNR Compiler - Translates parsed network rules into Chrome Declarative Net Request format.
 */

export const REDIRECT_MAP = {
  'noopjs': '/resources/noop.js',
  'noop.js': '/resources/noop.js',
  'noeval': '/resources/noop.js',
  'nooptxt': '/resources/noop.txt',
  'noop.txt': '/resources/noop.txt',
  'noophtml': '/resources/noop.html',
  'noop.html': '/resources/noop.html',
  '1x1.png': '/resources/1x1.png',
  '1x1-transparent.png': '/resources/1x1.png'
};

/**
 * Validates whether a regular expression string is safe and supported by Chrome DNR (RE2 syntax).
 * Prevents invalid regex rules from breaking manifest loading or runtime registration.
 */
export function isValidDnrRegex(pattern) {
  if (!pattern || typeof pattern !== 'string' || pattern.length > 1024) return false;
  // Non-ASCII characters are disallowed by Chrome DNR in regexFilter
  if (/[^\x00-\x7F]/.test(pattern)) return false;
  // Must be valid regex syntax
  try {
    new RegExp(pattern);
  } catch {
    return false;
  }
  // RE2 does not support lookarounds or backreferences
  if (/\(\?[=!<]/.test(pattern)) return false; // lookaheads & lookbehinds
  if (/\\[1-9]/.test(pattern)) return false;   // backreferences
  return true;
}

/**
 * Validates and converts a parsed network rule to a DNR Rule object.
 * @param {object} parsedRule - Output of parseFilterLine
 * @param {number} ruleId - Unique rule ID
 * @returns {object|null} Chrome DNR rule or null if invalid
 */
export function compileToDnrRule(parsedRule, ruleId) {
  if (!parsedRule || parsedRule.type !== 'network') {
    return null;
  }

  // 1. Determine Action
  let action;
  if (parsedRule.isException) {
    action = { type: 'allow' };
  } else if (parsedRule.redirect && REDIRECT_MAP[parsedRule.redirect.toLowerCase()]) {
    action = {
      type: 'redirect',
      redirect: {
        extensionPath: REDIRECT_MAP[parsedRule.redirect.toLowerCase()]
      }
    };
  } else if (parsedRule.csp) {
    action = {
      type: 'modifyHeaders',
      responseHeaders: [
        {
          header: 'Content-Security-Policy',
          operation: 'append',
          value: parsedRule.csp
        }
      ]
    };
  } else {
    action = { type: 'block' };
  }

  // 2. Determine Condition
  const condition = {};

  if (parsedRule.isRegex && parsedRule.regexFilter) {
    if (!isValidDnrRegex(parsedRule.regexFilter)) {
      console.warn(`[DNR-Compiler] Skipping invalid/unsupported DNR regex: ${parsedRule.regexFilter}`);
      return null;
    }
    condition.regexFilter = parsedRule.regexFilter;
  } else if (parsedRule.urlFilter) {
    const sanitized = sanitizeUrlFilter(parsedRule.urlFilter);
    if (!isValidDnrUrlFilter(sanitized)) {
      console.warn(`[DNR-Compiler] Skipping invalid DNR urlFilter: "${parsedRule.urlFilter}" (sanitized: "${sanitized}")`);
      return null;
    }
    condition.urlFilter = sanitized;
    condition.isUrlFilterCaseSensitive = false;
  } else {
    condition.urlFilter = '*';
  }

  // Resource Types
  if (parsedRule.resourceTypes && parsedRule.resourceTypes.length > 0) {
    condition.resourceTypes = parsedRule.resourceTypes;
  }

  if (parsedRule.excludedResourceTypes && parsedRule.excludedResourceTypes.length > 0 && !condition.resourceTypes) {
    condition.excludedResourceTypes = parsedRule.excludedResourceTypes;
  }

  // Domains (Initiator domains in DNR)
  if (parsedRule.domains && parsedRule.domains.length > 0) {
    condition.initiatorDomains = parsedRule.domains.map(d => d.toLowerCase());
  }

  if (parsedRule.excludedDomains && parsedRule.excludedDomains.length > 0) {
    condition.excludedInitiatorDomains = parsedRule.excludedDomains.map(d => d.toLowerCase());
  }

  // Domain Type (firstParty / thirdParty)
  if (parsedRule.domainType) {
    condition.domainType = parsedRule.domainType;
  }

  // Priority
  const priority = parsedRule.priority || (parsedRule.isException ? 2 : 1);

  return {
    id: ruleId,
    priority,
    action,
    condition
  };
}

/**
 * Validates whether a urlFilter conforms strictly to Chrome Declarative Net Request constraints.
 */
export function isValidDnrUrlFilter(filter) {
  if (!filter || typeof filter !== 'string') return false;
  if (filter.length === 0 || filter.length > 2048) return false;
  // Must consist of only ASCII characters
  if (/[^\x00-\x7F]/.test(filter)) return false;
  // Chrome DNR specification: A pattern beginning with ||* is not allowed. Use * instead.
  if (filter.startsWith('||*')) return false;
  // Must not contain consecutive wildcards
  if (filter.includes('**')) return false;
  // Misplaced || anchor (allowed only at beginning)
  if (filter.slice(2).includes('||')) return false;
  // Misplaced single | anchor (allowed only at beginning or end)
  const inner = filter.startsWith('||') ? filter.slice(2) : (filter.startsWith('|') ? filter.slice(1) : filter);
  const withoutEnd = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  if (withoutEnd.includes('|')) return false;
  // Must not contain cosmetic/fragment markers
  if (filter.includes('#')) return false;

  return true;
}

/**
 * Normalizes urlFilter to conform to Declarative Net Request constraints.
 */
export function sanitizeUrlFilter(filter) {
  let f = filter.trim();
  if (!f) return '*';

  // Collapse multiple consecutive wildcards
  f = f.replace(/\*{2,}/g, '*');

  // Chrome DNR constraint: A pattern beginning with ||* is not allowed.
  // In ABP syntax, ||*.domain.com matches domain and any subdomains, exactly what ||domain.com does.
  if (f.startsWith('||*.')) {
    f = '||' + f.slice(4);
  } else if (f.startsWith('||*')) {
    f = '*' + f.slice(3);
  }

  return f;
}

/**
 * Compiles a list of parsed network rules into a list of DNR rules with sequential IDs.
 * @param {Array<object>} parsedRules
 * @param {number} [startId=1]
 * @returns {Array<object>} Compiled DNR rules
 */
export function compileRuleList(parsedRules, startId = 1) {
  let currentId = startId;
  const dnrRules = [];

  for (const rule of parsedRules) {
    const compiled = compileToDnrRule(rule, currentId);
    if (compiled) {
      dnrRules.push(compiled);
      currentId++;
    }
  }

  return dnrRules;
}

/**
 * Creates allow rules for trusted/whitelisted domains.
 * @param {Array<string>} domains
 * @param {number} [startId=1000000]
 * @returns {Array<object>}
 */
export function compileWhitelistRules(domains, startId = 1000000) {
  let currentId = startId;
  const rules = [];

  for (const domain of domains) {
    const clean = domain.trim().toLowerCase();
    if (!clean) continue;

    rules.push({
      id: currentId++,
      priority: 100, // High priority override
      action: { type: 'allow' },
      condition: {
        initiatorDomains: [clean],
        resourceTypes: [
          'main_frame',
          'sub_frame',
          'stylesheet',
          'script',
          'image',
          'font',
          'object',
          'xmlhttprequest',
          'ping',
          'csp_report',
          'media',
          'websocket',
          'other'
        ]
      }
    });
  }

  return rules;
}
