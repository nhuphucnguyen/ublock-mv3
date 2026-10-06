import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFilterList } from '../engine/filter-parser.js';
import { CosmeticEngine } from '../engine/cosmetic-engine.js';
import { ABPVN_RULES, ABPVN_FILTER_URL } from '../engine/abpvn-rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('ABPVN rules parse correctly and contain network & cosmetic rules', () => {
  assert.ok(ABPVN_FILTER_URL.includes('abpvn.com'));
  const parsed = parseFilterList(ABPVN_RULES);

  assert.ok(parsed.networkRules.length > 300, `Expected >300 network rules, got ${parsed.networkRules.length}`);
  assert.ok(parsed.cosmeticRules.length > 500, `Expected >500 cosmetic rules, got ${parsed.cosmeticRules.length}`);
  assert.ok(parsed.cosmeticExceptions.length > 10, `Expected >10 cosmetic exceptions, got ${parsed.cosmeticExceptions.length}`);
});

test('ruleset_abpvn.json is valid DNR ruleset format', () => {
  const filePath = path.join(rootDir, 'rulesets', 'ruleset_abpvn.json');
  assert.ok(fs.existsSync(filePath), 'ruleset_abpvn.json must exist');

  const rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length > 300);

  for (const rule of rules) {
    assert.ok(typeof rule.id === 'number' && rule.id >= 5000);
    assert.ok(rule.action && rule.action.type);
    assert.ok(rule.condition);
  }
});

test('CosmeticEngine matches Vietnamese domains with ABPVN rules', () => {
  const parsed = parseFilterList(ABPVN_RULES);
  const engine = new CosmeticEngine();
  engine.addRules([...parsed.cosmeticRules, ...parsed.cosmeticExceptions]);

  // Test TuoiTre
  const ttFilters = engine.getFiltersForHost('tuoitre.vn');
  assert.ok(ttFilters.selectors.length > 0, 'tuoitre.vn should have cosmetic selectors');

  // Test Kenh14
  const k14Filters = engine.getFiltersForHost('kenh14.vn');
  assert.ok(k14Filters.selectors.length > 0, 'kenh14.vn should have cosmetic selectors');

  // Test VnExpress
  const vnExpressFilters = engine.getFiltersForHost('vnexpress.net');
  assert.ok(vnExpressFilters.selectors.length > 0, 'vnexpress.net should have cosmetic selectors');
});
