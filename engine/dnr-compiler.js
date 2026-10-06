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
    // Validate RE2-safe regex (basic check)
    if (parsedRule.regexFilter.length > 1024) return null;
    condition.regexFilter = parsedRule.regexFilter;
  } else if (parsedRule.urlFilter) {
    condition.urlFilter = sanitizeUrlFilter(parsedRule.urlFilter);
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
 * Normalizes urlFilter to conform to Declarative Net Request constraints.
 */
function sanitizeUrlFilter(filter) {
  let f = filter.trim();
  // If pattern is empty, match everything
  if (!f) return '*';
  // Strip leading/trailing whitespaces
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
