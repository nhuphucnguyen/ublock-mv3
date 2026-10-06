import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFilterList } from '../engine/filter-parser.js';
import { compileRuleList } from '../engine/dnr-compiler.js';
import {
  DEFAULT_ADS_RULES,
  DEFAULT_PRIVACY_RULES,
  DEFAULT_ANNOYANCES_RULES,
  DEFAULT_SOCIAL_RULES
} from '../engine/default-rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const rulesetsDir = path.join(rootDir, 'rulesets');

if (!fs.existsSync(rulesetsDir)) {
  fs.mkdirSync(rulesetsDir, { recursive: true });
}

const sets = [
  { name: 'ruleset_default.json', text: DEFAULT_ADS_RULES, startId: 1000 },
  { name: 'ruleset_privacy.json', text: DEFAULT_PRIVACY_RULES, startId: 2000 },
  { name: 'ruleset_annoyances.json', text: DEFAULT_ANNOYANCES_RULES, startId: 3000 },
  { name: 'ruleset_social.json', text: DEFAULT_SOCIAL_RULES, startId: 4000 }
];

console.log('Compiling default static rulesets...');

for (const set of sets) {
  const parsed = parseFilterList(set.text);
  const dnrRules = compileRuleList(parsed.networkRules, set.startId);
  const targetPath = path.join(rulesetsDir, set.name);
  fs.writeFileSync(targetPath, JSON.stringify(dnrRules, null, 2), 'utf-8');
  console.log(`✓ ${set.name}: Compiled ${dnrRules.length} DNR network rules (plus ${parsed.cosmeticRules.length} cosmetic rules).`);
}

console.log('Done compiling static rulesets!');
