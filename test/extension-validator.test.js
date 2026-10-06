import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import { isValidDnrRegex } from '../engine/dnr-compiler.js';

test('manifest.json is valid and references existing files', () => {
  const manifestPath = path.join(rootDir, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.manifest_version, 3, 'Must be Manifest V3');
  assert.ok(manifest.name, 'Must have name');
  assert.ok(manifest.version, 'Must have version');
  assert.ok(manifest.description, 'Must have description');

  // Check icons
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    const full = path.join(rootDir, iconPath);
    assert.ok(fs.existsSync(full), `Icon file ${iconPath} must exist`);
  }

  // Check background worker
  assert.ok(manifest.background.service_worker, 'Service worker must be defined');
  assert.ok(fs.existsSync(path.join(rootDir, manifest.background.service_worker)), 'Service worker file must exist');

  // Check popup
  assert.ok(manifest.action.default_popup, 'Popup must be defined');
  assert.ok(fs.existsSync(path.join(rootDir, manifest.action.default_popup)), 'Popup HTML must exist');

  // Check options
  assert.ok(manifest.options_ui.page, 'Options page must be defined');
  assert.ok(fs.existsSync(path.join(rootDir, manifest.options_ui.page)), 'Options HTML must exist');

  // Check content scripts
  for (const cs of manifest.content_scripts) {
    for (const js of cs.js) {
      assert.ok(fs.existsSync(path.join(rootDir, js)), `Content script JS ${js} must exist`);
    }
    if (cs.css) {
      for (const css of cs.css) {
        assert.ok(fs.existsSync(path.join(rootDir, css)), `Content script CSS ${css} must exist`);
      }
    }
  }

  // Check web accessible resources
  for (const war of manifest.web_accessible_resources) {
    for (const res of war.resources) {
      assert.ok(fs.existsSync(path.join(rootDir, res)), `Resource ${res} must exist`);
    }
  }

  // Check DNR static rulesets
  const ruleResources = manifest.declarative_net_request.rule_resources;
  assert.ok(Array.isArray(ruleResources), 'declarative_net_request.rule_resources must be array');
  assert.ok(ruleResources.length > 0, 'Must have at least one ruleset');

  const allIds = new Set();

  for (const rr of ruleResources) {
    const full = path.join(rootDir, rr.path);
    assert.ok(fs.existsSync(full), `Ruleset file ${rr.path} must exist`);

    const json = JSON.parse(fs.readFileSync(full, 'utf-8'));
    assert.ok(Array.isArray(json), `Ruleset ${rr.id} content must be an array of rules`);

    for (const rule of json) {
      assert.ok(typeof rule.id === 'number' && rule.id > 0, `Rule id must be positive number (got ${rule.id})`);
      assert.ok(!allIds.has(rule.id), `Rule ID ${rule.id} must be globally unique across rulesets`);
      allIds.add(rule.id);

      assert.ok(rule.action && rule.action.type, `Rule ${rule.id} must have action.type`);
      assert.ok(rule.condition, `Rule ${rule.id} must have condition`);

      if (rule.condition.regexFilter) {
        assert.ok(
          isValidDnrRegex(rule.condition.regexFilter),
          `Rule ${rule.id} in ${rr.path} specifies an invalid regexFilter: "${rule.condition.regexFilter}"`
        );
      }
    }
  }
});
