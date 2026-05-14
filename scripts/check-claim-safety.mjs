#!/usr/bin/env node
/* Claim-safety guard.
 * Fails (exit 1) if any banned promise/claim phrase appears in approved sources.
 * Banned phrases come from the assistant safety policy — see CLAUDE.md / decisions.
 * Scope: marketing HTML, llms text artifacts, assistant knowledge sources.
 *
 * Run:  node scripts/check-claim-safety.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANNED, ALLOWED_NEGATIONS } from '../shared/banned-claims.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const FILES = [
  'index.html',
  'whitepaper.html',
  'llms.txt',
  'llms-full.txt',
  'assets/assistant-knowledge.js',
  'assets/assistant-knowledge.json',
  'assets/i18n.js'
];

let failures = 0;

for (const rel of FILES) {
  const path = resolve(ROOT, rel);
  if (!existsSync(path)) continue;
  const raw = readFileSync(path, 'utf8');
  const lc = raw.toLowerCase();
  for (const { re, reason } of BANNED) {
    const m = re.exec(raw);
    if (!m) continue;
    // Skip if the surrounding window contains an allowed negation literal.
    const start = Math.max(0, m.index - 80);
    const window = lc.slice(start, m.index + m[0].length + 80);
    if (ALLOWED_NEGATIONS.some(n => window.includes(n))) continue;
    const line = raw.slice(0, m.index).split('\n').length;
    console.error(`✗ ${rel}:${line}  [${reason}]  → "${m[0]}"`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} banned-claim hit(s). Edit copy or extend ALLOWED_NEGATIONS in scripts/check-claim-safety.mjs.`);
  process.exit(1);
}
console.log('✓ claim-safety: no banned phrases in approved sources.');
