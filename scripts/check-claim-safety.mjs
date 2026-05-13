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

// Phrase → reason. Regex case-insensitive, multiline.
// "Allowed context" lets us declare disclaimer/refusal wording that legitimately quotes the
// banned phrase to deny it (e.g., "no audit completed" in disclosure copy).
const BANNED = [
  { re: /\bguaranteed (returns?|yield|profit|roi|listing)/i,             reason: 'guaranteed returns/listing promise' },
  { re: /\b(roi|return on investment)\b[^.\n]{0,40}\b(of|will|guaranteed)/i, reason: 'ROI promise' },
  { re: /\blisted on (binance|coinbase|okx|bybit|upbit|bithumb)\b/i,     reason: 'exchange-listing claim' },
  { re: /\baudit (completed|passed|finalized|finished)\b/i,              reason: 'completed-audit claim' },
  { re: /\bbank[- ]grade (security|custody|infrastructure)\b/i,          reason: 'bank-grade claim' },
  { re: /\bhsm[- ]backed\b/i,                                            reason: 'HSM-backed vendor claim' },
  { re: /\bisolated vpc\b/i,                                             reason: 'isolated-VPC vendor claim' },
  { re: /\bregulator[- ]?approved\b/i,                                   reason: 'regulator-approved claim' },
  { re: /\bfdic[- ]?insured\b/i,                                         reason: 'FDIC-insured claim' }
];

// Phrases that look risky but are explicitly allowed when they appear in negating context
// (e.g., "audit-targeted, not audit-claimed"). Add literals here, lowercased.
const ALLOWED_NEGATIONS = [
  'audit-targeted, not audit-claimed',
  'no audit is claimed',
  'no exchange-listing promise',
  'no exchange listing is promised',
  'no audit completion is claimed'
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
