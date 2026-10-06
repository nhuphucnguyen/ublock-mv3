/**
 * Filter Parser for uBlock Origin / Adblock Plus syntax to MV3 DNR & Cosmetic rules.
 * Supports:
 * - Network rules (blocking, exceptions @@, modifiers: $script, $image, $third-party, $domain=..., $important, etc.)
 * - Cosmetic rules (##selector, #@#selector, ##+js(...))
 */

export const RESOURCE_TYPE_MAP = {
  'image': 'image',
  'imageset': 'image',
  'script': 'script',
  'stylesheet': 'stylesheet',
  'css': 'stylesheet',
  'subdocument': 'sub_frame',
  'frame': 'sub_frame',
  'main_frame': 'main_frame',
  'document': 'main_frame',
  'doc': 'main_frame',
  'xmlhttprequest': 'xmlhttprequest',
  'xhr': 'xmlhttprequest',
  'media': 'media',
  'font': 'font',
  'ping': 'ping',
  'websocket': 'websocket',
  'other': 'other'
};

export const ALL_RESOURCE_TYPES = [
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
];

/**
 * Parses a single filter rule line.
 * @param {string} line - Raw line from filter list.
 * @returns {object|null} Parsed rule representation or null if ignored/invalid.
 */
export function parseFilterLine(line) {
  if (!line) return null;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[Adblock') || trimmed.startsWith('# ')) {
    return null;
  }

  // 1. Check for Scriptlet injection: domain.com##+js(name, args...)
  const scriptletMatch = trimmed.match(/^([^#]*)##\+js\(([^)]+)\)$/);
  if (scriptletMatch) {
    const rawDomains = scriptletMatch[1].trim();
    const scriptletContent = scriptletMatch[2].trim();
    const args = scriptletContent.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    const name = args.shift();
    const domains = parseDomains(rawDomains);

    return {
      type: 'scriptlet',
      raw: trimmed,
      name,
      args,
      domains: domains.included,
      excludedDomains: domains.excluded
    };
  }

  // 2. Check for Cosmetic exception: domain.com#@#selector
  const cosmeticExceptionMatch = trimmed.match(/^([^#]*)#@#(.+)$/);
  if (cosmeticExceptionMatch) {
    const rawDomains = cosmeticExceptionMatch[1].trim();
    const selector = cosmeticExceptionMatch[2].trim();
    const domains = parseDomains(rawDomains);

    return {
      type: 'cosmetic_exception',
      raw: trimmed,
      selector,
      domains: domains.included,
      excludedDomains: domains.excluded
    };
  }

  // 3. Check for Cosmetic element hiding: domain.com##selector or ##selector
  const cosmeticMatch = trimmed.match(/^([^#]*)##(.+)$/);
  if (cosmeticMatch) {
    const rawDomains = cosmeticMatch[1].trim();
    const selector = cosmeticMatch[2].trim();
    const domains = parseDomains(rawDomains);

    return {
      type: 'cosmetic',
      raw: trimmed,
      selector,
      domains: domains.included,
      excludedDomains: domains.excluded,
      isGeneric: domains.included.length === 0
    };
  }

  // 4. Network rule
  return parseNetworkRule(trimmed);
}

/**
 * Parses domain list formatted like domain1.com,domain2.com,~excluded.com
 */
export function parseDomains(rawDomains) {
  const included = [];
  const excluded = [];
  if (!rawDomains) return { included, excluded };

  const parts = rawDomains.split(/[|,]/);
  for (const p of parts) {
    const domain = p.trim().toLowerCase();
    if (!domain) continue;
    if (domain.startsWith('~')) {
      const clean = domain.slice(1).trim();
      if (clean) excluded.push(clean);
    } else {
      included.push(domain);
    }
  }
  return { included, excluded };
}

const REGEX_RULE_REGEX = /^\/((?:\\.|[^\/])+)\/(\$(.*))?$/;

/**
 * Parses a network blocking or allow rule.
 */
function parseNetworkRule(raw) {
  let isException = false;
  let text = raw;

  if (text.startsWith('@@')) {
    isException = true;
    text = text.slice(2);
  }

  let optionsStr = '';
  let pattern = text;
  let isRegex = false;

  // Check if it is a regular expression rule: /pattern/ or /pattern/$options
  if (text.startsWith('/')) {
    const regexMatch = text.match(REGEX_RULE_REGEX);
    if (regexMatch) {
      isRegex = true;
      pattern = regexMatch[1];
      optionsStr = regexMatch[3] || '';
    }
  }

  if (!isRegex) {
    const optIdx = text.indexOf('$');
    if (optIdx !== -1) {
      optionsStr = text.slice(optIdx + 1);
      pattern = text.slice(0, optIdx);
    }
  }

  const options = parseOptions(optionsStr);
  if (options.badfilter) {
    return null; // Badfilter invalidates rule
  }

  // Parse pattern
  const patternInfo = isRegex
    ? { regexFilter: pattern, isRegex: true }
    : parseUrlPattern(pattern);

  return {
    type: 'network',
    raw,
    isException,
    urlFilter: patternInfo.urlFilter,
    regexFilter: patternInfo.regexFilter,
    isRegex: patternInfo.isRegex,
    resourceTypes: options.resourceTypes,
    excludedResourceTypes: options.excludedResourceTypes,
    domainType: options.domainType,
    domains: options.domains,
    excludedDomains: options.excludedDomains,
    priority: options.important ? 2 : (isException ? 2 : 1),
    redirect: options.redirect,
    csp: options.csp
  };
}

/**
 * Parses options string like "script,third-party,domain=foo.com|~bar.com,important"
 */
function parseOptions(optionsStr) {
  const result = {
    resourceTypes: [],
    excludedResourceTypes: [],
    domainType: undefined, // 'firstParty' | 'thirdParty'
    domains: [],
    excludedDomains: [],
    important: false,
    badfilter: false,
    redirect: undefined,
    csp: undefined
  };

  if (!optionsStr) return result;

  const parts = optionsStr.split(',');
  for (const part of parts) {
    const opt = part.trim().toLowerCase();
    if (!opt) continue;

    if (opt === 'important') {
      result.important = true;
      continue;
    }

    if (opt === 'badfilter') {
      result.badfilter = true;
      continue;
    }

    if (opt === 'third-party' || opt === '3p') {
      result.domainType = 'thirdParty';
      continue;
    }

    if (opt === '~third-party' || opt === 'first-party' || opt === '1p') {
      result.domainType = 'firstParty';
      continue;
    }

    if (opt.startsWith('domain=')) {
      const domStr = part.slice(opt.indexOf('domain=') + 7);
      const parsed = parseDomains(domStr);
      result.domains.push(...parsed.included);
      result.excludedDomains.push(...parsed.excluded);
      continue;
    }

    if (opt.startsWith('redirect=') || opt.startsWith('redirect-rule=')) {
      result.redirect = part.slice(part.indexOf('=') + 1).trim();
      continue;
    }

    if (opt.startsWith('csp=')) {
      result.csp = part.slice(part.indexOf('=') + 1).trim();
      continue;
    }

    // Check resource type (negated or positive)
    let isNegated = false;
    let typeName = opt;
    if (typeName.startsWith('~')) {
      isNegated = true;
      typeName = typeName.slice(1);
    }

    if (RESOURCE_TYPE_MAP[typeName]) {
      const mapped = RESOURCE_TYPE_MAP[typeName];
      if (isNegated) {
        if (!result.excludedResourceTypes.includes(mapped)) {
          result.excludedResourceTypes.push(mapped);
        }
      } else {
        if (!result.resourceTypes.includes(mapped)) {
          result.resourceTypes.push(mapped);
        }
      }
    }
  }

  // Handle excluded resource types if positive resource types were empty
  if (result.excludedResourceTypes.length > 0 && result.resourceTypes.length === 0) {
    result.resourceTypes = ALL_RESOURCE_TYPES.filter(t => !result.excludedResourceTypes.includes(t));
  }

  return result;
}

/**
 * Parses url pattern into either urlFilter string (compatible with DNR) or regexFilter.
 */
function parseUrlPattern(pattern) {
  if (!pattern) {
    return { urlFilter: '*', isRegex: false };
  }

  // Regular expression syntax: /pattern/
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    return {
      regexFilter: pattern.slice(1, -1),
      isRegex: true
    };
  }

  // Clean and prepare urlFilter for declarativeNetRequest
  let filter = pattern;

  return {
    urlFilter: filter,
    isRegex: false
  };
}

/**
 * Parses full filter text (e.g. file content) into categorized sets.
 */
export function parseFilterList(content) {
  const lines = content.split(/\r?\n/);
  const networkRules = [];
  const cosmeticRules = [];
  const cosmeticExceptions = [];
  const scriptlets = [];

  for (const line of lines) {
    const parsed = parseFilterLine(line);
    if (!parsed) continue;

    switch (parsed.type) {
      case 'network':
        networkRules.push(parsed);
        break;
      case 'cosmetic':
        cosmeticRules.push(parsed);
        break;
      case 'cosmetic_exception':
        cosmeticExceptions.push(parsed);
        break;
      case 'scriptlet':
        scriptlets.push(parsed);
        break;
    }
  }

  return {
    networkRules,
    cosmeticRules,
    cosmeticExceptions,
    scriptlets
  };
}
