import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilterList } from '../engine/filter-parser.js';
import { CosmeticEngine } from '../engine/cosmetic-engine.js';

test('CosmeticEngine correctly generates CSS for generic and domain rules', () => {
  const filterText = `
    ##.ad-banner
    ###google_ads_frame
    example.com##.sponsor-card
    news.site.com##.headline-ad
    other.com##.sidebar-promo
  `;

  const parsed = parseFilterList(filterText);
  const engine = new CosmeticEngine();
  engine.addRules(parsed.cosmeticRules);

  // Test generic + domain match for example.com
  const exampleFilters = engine.getFiltersForHost('example.com');
  assert.ok(exampleFilters.selectors.includes('.ad-banner'));
  assert.ok(exampleFilters.selectors.includes('#google_ads_frame'));
  assert.ok(exampleFilters.selectors.includes('.sponsor-card'));
  assert.ok(!exampleFilters.selectors.includes('.sidebar-promo'));
  assert.ok(exampleFilters.css.includes('display: none !important;'));

  // Test subdomains match parent domain rules
  const subFilters = engine.getFiltersForHost('sub.example.com');
  assert.ok(subFilters.selectors.includes('.sponsor-card'));
});

test('CosmeticEngine respects element hiding exceptions #@#', () => {
  const filterText = `
    ##.banner
    goodsite.com#@#.banner
  `;

  const parsed = parseFilterList(filterText);
  const engine = new CosmeticEngine();
  engine.addRules([...parsed.cosmeticRules, ...parsed.cosmeticExceptions]);

  const regularSiteFilters = engine.getFiltersForHost('othersite.com');
  assert.ok(regularSiteFilters.selectors.includes('.banner'));

  const exceptedSiteFilters = engine.getFiltersForHost('goodsite.com');
  assert.ok(!exceptedSiteFilters.selectors.includes('.banner'));
});

test('CosmeticEngine separates procedural selectors from standard selectors', () => {
  const filterText = `
    ##.standard-ad
    test.com##div:-abp-contains(Sponsored)
  `;

  const parsed = parseFilterList(filterText);
  const engine = new CosmeticEngine();
  engine.addRules(parsed.cosmeticRules);

  const filters = engine.getFiltersForHost('test.com');
  assert.ok(filters.standardSelectors.includes('.standard-ad'));
  assert.ok(filters.proceduralSelectors.includes('div:-abp-contains(Sponsored)'));
  // procedural selectors shouldn't be in the raw CSS stylesheet
  assert.ok(!filters.css.includes(':-abp-contains('));
});

test('CosmeticEngine handles serialization and restoration', () => {
  const filterText = `
    ##.common-ad
    site.com##.custom-ad
  `;
  const parsed = parseFilterList(filterText);
  const engine1 = new CosmeticEngine();
  engine1.addRules(parsed.cosmeticRules);

  const json = engine1.toJSON();

  const engine2 = new CosmeticEngine();
  engine2.fromJSON(json);

  const filters = engine2.getFiltersForHost('site.com');
  assert.ok(filters.selectors.includes('.common-ad'));
  assert.ok(filters.selectors.includes('.custom-ad'));
});
