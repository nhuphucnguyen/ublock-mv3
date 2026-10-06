import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilterLine, parseDomains, parseFilterList } from '../engine/filter-parser.js';

test('parseDomains splits included and excluded domains properly', () => {
  const parsed = parseDomains('example.com,test.org|~sub.test.org');
  assert.deepEqual(parsed.included, ['example.com', 'test.org']);
  assert.deepEqual(parsed.excluded, ['sub.test.org']);
});

test('parseFilterLine parses standard network blocking rule', () => {
  const rule = parseFilterLine('||doubleclick.net^$third-party');
  assert.ok(rule);
  assert.equal(rule.type, 'network');
  assert.equal(rule.isException, false);
  assert.equal(rule.urlFilter, '||doubleclick.net^');
  assert.equal(rule.domainType, 'thirdParty');
});

test('parseFilterLine parses exception rule with @@', () => {
  const rule = parseFilterLine('@@||example.com/banner.js$script');
  assert.ok(rule);
  assert.equal(rule.type, 'network');
  assert.equal(rule.isException, true);
  assert.deepEqual(rule.resourceTypes, ['script']);
  assert.equal(rule.priority, 2);
});

test('parseFilterLine parses options with domain inclusions and exclusions', () => {
  const rule = parseFilterLine('||adservice.com^$domain=foo.com|~bar.com,image,important');
  assert.ok(rule);
  assert.deepEqual(rule.domains, ['foo.com']);
  assert.deepEqual(rule.excludedDomains, ['bar.com']);
  assert.deepEqual(rule.resourceTypes, ['image']);
  assert.equal(rule.priority, 2);
});

test('parseFilterLine ignores comments and empty lines', () => {
  assert.equal(parseFilterLine('! This is a comment'), null);
  assert.equal(parseFilterLine('[Adblock Plus 2.0]'), null);
  assert.equal(parseFilterLine('   '), null);
  assert.equal(parseFilterLine('# Comment line'), null);
});

test('parseFilterLine ignores rules with $badfilter', () => {
  const rule = parseFilterLine('||bad.com^$badfilter');
  assert.equal(rule, null);
});

test('parseFilterLine parses generic cosmetic rule', () => {
  const rule = parseFilterLine('##.ad-banner');
  assert.ok(rule);
  assert.equal(rule.type, 'cosmetic');
  assert.equal(rule.selector, '.ad-banner');
  assert.equal(rule.isGeneric, true);
});

test('parseFilterLine parses domain-specific cosmetic rule', () => {
  const rule = parseFilterLine('youtube.com,vimeo.com##.sponsor-banner');
  assert.ok(rule);
  assert.equal(rule.type, 'cosmetic');
  assert.equal(rule.selector, '.sponsor-banner');
  assert.equal(rule.isGeneric, false);
  assert.deepEqual(rule.domains, ['youtube.com', 'vimeo.com']);
});

test('parseFilterLine parses cosmetic exception rule #@#', () => {
  const rule = parseFilterLine('example.com#@#.ad-banner');
  assert.ok(rule);
  assert.equal(rule.type, 'cosmetic_exception');
  assert.equal(rule.selector, '.ad-banner');
  assert.deepEqual(rule.domains, ['example.com']);
});

test('parseFilterLine parses scriptlet rule ##+js(...)', () => {
  const rule = parseFilterLine('example.com##+js(noeval)');
  assert.ok(rule);
  assert.equal(rule.type, 'scriptlet');
  assert.equal(rule.name, 'noeval');
  assert.deepEqual(rule.domains, ['example.com']);
});

test('parseFilterLine parses regex rules with options and anchors', () => {
  const rule = parseFilterLine('/^https:\\/\\/[a-z]{3,}\\.com\\/$/$xmlhttprequest,third-party');
  assert.ok(rule);
  assert.equal(rule.type, 'network');
  assert.equal(rule.isRegex, true);
  assert.equal(rule.regexFilter, '^https:\\/\\/[a-z]{3,}\\.com\\/$');
  assert.equal(rule.domainType, 'thirdParty');
  assert.deepEqual(rule.resourceTypes, ['xmlhttprequest']);

  // Plain regex without options
  const plainRegex = parseFilterLine('/^https:\\/\\/[a-z]+\\.com\\//');
  assert.ok(plainRegex);
  assert.equal(plainRegex.isRegex, true);
  assert.equal(plainRegex.regexFilter, '^https:\\/\\/[a-z]+\\.com\\/');

  // Exception regex
  const exRegex = parseFilterLine('@@/^https:\\/\\/safe\\.com\\/$/$script');
  assert.ok(exRegex);
  assert.equal(exRegex.isException, true);
  assert.equal(exRegex.isRegex, true);
  assert.equal(exRegex.regexFilter, '^https:\\/\\/safe\\.com\\/$');
  assert.deepEqual(exRegex.resourceTypes, ['script']);

  // Non-regex path pattern starting with /
  const pathRule = parseFilterLine('/_BannerSlot.aspx$subdocument');
  assert.ok(pathRule);
  assert.equal(pathRule.isRegex, false);
  assert.equal(pathRule.urlFilter, '/_BannerSlot.aspx');
  assert.deepEqual(pathRule.resourceTypes, ['sub_frame']);
});

test('parseFilterList categorizes full filter list text', () => {
  const content = `
    ! Header comment
    ||doubleclick.net^
    ##.ad-slot
    example.com##.sponsor
    example.com#@#.sponsor
    test.com##+js(set-local-storage-item, key, val)
  `;
  const result = parseFilterList(content);
  assert.equal(result.networkRules.length, 1);
  assert.equal(result.cosmeticRules.length, 2);
  assert.equal(result.cosmeticExceptions.length, 1);
  assert.equal(result.scriptlets.length, 1);
});

