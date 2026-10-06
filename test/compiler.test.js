import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilterLine } from '../engine/filter-parser.js';
import { compileToDnrRule, compileRuleList, compileWhitelistRules } from '../engine/dnr-compiler.js';

test('compileToDnrRule compiles standard network block rule', () => {
  const parsed = parseFilterLine('||google-analytics.com^$script,third-party');
  const dnrRule = compileToDnrRule(parsed, 101);

  assert.ok(dnrRule);
  assert.equal(dnrRule.id, 101);
  assert.equal(dnrRule.priority, 1);
  assert.deepEqual(dnrRule.action, { type: 'block' });
  assert.equal(dnrRule.condition.urlFilter, '||google-analytics.com^');
  assert.deepEqual(dnrRule.condition.resourceTypes, ['script']);
  assert.equal(dnrRule.condition.domainType, 'thirdParty');
});

test('compileToDnrRule compiles exception rule to allow action with higher priority', () => {
  const parsed = parseFilterLine('@@||friendlysite.com^');
  const dnrRule = compileToDnrRule(parsed, 202);

  assert.ok(dnrRule);
  assert.equal(dnrRule.id, 202);
  assert.equal(dnrRule.priority, 2);
  assert.deepEqual(dnrRule.action, { type: 'allow' });
  assert.equal(dnrRule.condition.urlFilter, '||friendlysite.com^');
});

test('compileToDnrRule compiles redirect rule to extension resource', () => {
  const parsed = parseFilterLine('||track.com/tracker.js$redirect=noopjs');
  const dnrRule = compileToDnrRule(parsed, 303);

  assert.ok(dnrRule);
  assert.equal(dnrRule.action.type, 'redirect');
  assert.equal(dnrRule.action.redirect.extensionPath, '/resources/noop.js');
});

test('compileRuleList assigns sequential IDs', () => {
  const rules = [
    parseFilterLine('||a.com^'),
    parseFilterLine('||b.com^'),
    parseFilterLine('||c.com^')
  ];
  const compiled = compileRuleList(rules, 500);

  assert.equal(compiled.length, 3);
  assert.equal(compiled[0].id, 500);
  assert.equal(compiled[1].id, 501);
  assert.equal(compiled[2].id, 502);
});

test('compileWhitelistRules generates high-priority allow rules for trusted domains', () => {
  const allowRules = compileWhitelistRules(['wikipedia.org', 'archive.org'], 9000);
  assert.equal(allowRules.length, 2);
  assert.equal(allowRules[0].priority, 100);
  assert.equal(allowRules[0].action.type, 'allow');
  assert.deepEqual(allowRules[0].condition.initiatorDomains, ['wikipedia.org']);
});

test('compileToDnrRule sanitizes ||* and rejects invalid urlFilters', () => {
  // Test sanitization of ||*.domain.com to ||domain.com
  const parsedWildcardDomain = parseFilterLine('||*.servimg.com/u/f45/');
  const rule = compileToDnrRule(parsedWildcardDomain, 5050);
  assert.ok(rule);
  assert.equal(rule.condition.urlFilter, '||servimg.com/u/f45/');

  // Test skipping non-ascii or malformed urlFilters
  const invalidRule = {
    type: 'network',
    raw: 'non-ascii-test',
    urlFilter: 'metruyencv.com/quảng-cáo'
  };
  const compiled = compileToDnrRule(invalidRule, 9999);
  assert.equal(compiled, null);
});

