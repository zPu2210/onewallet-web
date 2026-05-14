#!/usr/bin/env node
/* Smoke test: mirror assistant.js retrieval against the JSON corpus and verify
 * known queries route to expected chunks, including the unsupported-claim path.
 * Not a browser test — just enough to catch regressions in scoring/threshold.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(resolve(ROOT, 'assets/assistant-knowledge.json'), 'utf8'));

const RETRIEVAL_THRESHOLD = 1.2;

const STOPWORDS = new Set('a an the and or but of to in on at for with by from is are was were be been being am do does did done doing have has had will would can could should may might must i me my we our you your it its they their this that how what why when where who which whose if so as than then about into onto over under out up down off no not yes us him her them also'.split(' '));
const tokenize = v => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}$]+/gu, ' ').trim().split(/\s+/).filter(t => t.length > 1 && !STOPWORDS.has(t));

const prep = data.chunks.map(c => ({
  chunk: c,
  titleTokens: tokenize(c.title),
  tagTokens: (c.tags || []).flatMap(tokenize),
  textTokens: tokenize(c.text)
}));

const df = new Map();
for (const c of data.chunks) {
  const u = new Set([...tokenize(c.title), ...(c.tags || []).flatMap(tokenize), ...tokenize(c.text)]);
  for (const t of u) df.set(t, (df.get(t) || 0) + 1);
}
const idf = new Map();
for (const [t, d] of df) idf.set(t, Math.log(1 + data.chunks.length / (1 + d)));

function search(query, locale = 'en') {
  const terms = tokenize(query);
  if (!terms.length) return null;
  const pool = prep.filter(p => p.chunk.locale === locale || p.chunk.locale === 'en');
  let best = null;
  for (const p of pool) {
    let s = 0, hits = 0, titleOrTagHit = false;
    for (const t of terms) {
      const w = idf.get(t) || 0.4;
      const inTitle = p.titleTokens.includes(t);
      const inTag   = p.tagTokens.includes(t);
      const inText  = p.textTokens.includes(t);
      if (inTitle) s += w * 2.2;
      if (inTag)   s += w * 1.6;
      if (inText)  s += w * 1.0;
      if (inTitle || inTag || inText) hits++;
      if (inTitle || inTag) titleOrTagHit = true;
    }
    if (!best || s > best.score) best = { chunk: p.chunk, score: s, hits, titleOrTagHit };
  }
  if (!best) return null;
  const precise = best.titleOrTagHit || best.hits >= 2;
  return (precise && best.score >= RETRIEVAL_THRESHOLD) ? best : null;
}

const cases = [
  { q: 'what does onewallet do', locale: 'en',  expectIdLike: /qa-what|hp-platform|wp-ch1/ },
  { q: 'how do mpc shares work', locale: 'en',  expectIdLike: /qa-custody|wp-ch5/ },
  { q: 'do i need a seed phrase', locale: 'en', expectIdLike: /qa-seed|wp-ch3|hp-security/ },
  { q: 'merchant qr payment',     locale: 'en', expectIdLike: /qa-payments|hp-payments/ },
  { q: 'roadmap status',          locale: 'en', expectIdLike: /qa-roadmap|wp-ch9/ },
  { q: '시드 문구 필요',           locale: 'ko', expectIdLike: /qa-seed-ko/ },
  { q: '結제 머천트',              locale: 'ko', expectIdLike: /qa-payments-ko|qa-fees-ko/ },
  // Unsupported-claim path → either no match, OR matched chunk must contain explicit denial wording.
  { q: 'will $1 be listed on Binance next month?', locale: 'en', expectIdLike: null, mustDeny: true },
  { q: 'guaranteed returns yield', locale: 'en', expectIdLike: null, mustDeny: true },
  // Out-of-scope corporate questions — must NOT bleed into product chunks.
  { q: 'legal company registration', locale: 'en', expectIdLike: null, allowNull: true },
  { q: 'registered company address', locale: 'en', expectIdLike: null, allowNull: true },
  { q: 'terms of service',           locale: 'en', expectIdLike: null, allowNull: true },
  // "founder email contact" — contact questions correctly redirect to the support chunk
  // (curated text points users to Telegram), not a leak. Allow support routing.
  { q: 'founder email contact',      locale: 'en', expectIdLike: /qa-support|null/, allowSupportRedirect: true }
];

const DENIAL_RX = /\b(avoid|no (price|exchange|guarantee|promise)|not (a |claim)|is positioned|subject to)\b/i;

let pass = 0, fail = 0;
for (const c of cases) {
  const r = search(c.q, c.locale);
  const id = r ? r.chunk.id : '(no match)';
  const score = r ? r.score.toFixed(2) : '-';
  let ok;
  if (c.expectIdLike === null) {
    // Unsupported claim: pass if no match, OR matched chunk contains explicit denial wording.
    if (c.allowNull) ok = !r;
    else if (c.mustDeny) ok = !r || DENIAL_RX.test(r.chunk.text);
    else ok = !r || r.score < 3.0;
  } else {
    ok = !!(r && c.expectIdLike.test(r.chunk.id));
  }
  console.log(`${ok ? '✓' : '✗'}  [${c.locale}]  "${c.q}"  →  ${id}  (score ${score})`);
  ok ? pass++ : fail++;
}
// ── Fallback path: when the JSON corpus is unavailable (slow-load / offline), assistant.js
// scores curated items directly. Mirror that scorer here and assert the same precision floor.
const curatedItems = data.chunks
  .filter(c => c.id.startsWith('qa-') && c.locale === 'en')
  .map(c => ({
    id: c.id.replace(/^qa-([a-z0-9]+)-en$/, '$1'),
    q: c.title,
    a: c.text,
    k: c.tags.join(' ')
  }));

function searchFallback(query) {
  const terms = tokenize(query);
  if (!terms.length) return null;
  let best = null;
  for (const item of curatedItems) {
    const qTokens = tokenize(item.q);
    const kTokens = tokenize(item.k);
    const aTokens = tokenize(item.a);
    let score = 0, hits = 0, titleHit = false;
    for (const t of terms) {
      const inQ = qTokens.includes(t);
      const inK = kTokens.includes(t);
      const inA = aTokens.includes(t);
      if (inQ) score += 2.2;
      if (inK) score += 1.6;
      if (inA) score += 1.0;
      if (inQ || inK || inA) hits++;
      if (inQ) titleHit = true;
    }
    if (!best || score > best.score) best = { item, score, hits, titleHit };
  }
  if (!best || best.score === 0) return null;
  return (best.titleHit || best.hits >= 2) ? best : null;
}

const fallbackCases = [
  { q: 'do i need a seed phrase',     expectId: 'seed' },
  { q: 'merchant qr payment',         expectId: 'payments' },
  { q: 'legal company registration',  expectNull: true },
  { q: 'founder email contact',       expectIdLike: /support|team/ },
  { q: 'bank grade security',         expectNull: true },
  { q: 'terms of service',            expectNull: true }
];

console.log('\n--- fallback path (corpus offline) ---');
for (const c of fallbackCases) {
  const r = searchFallback(c.q);
  const id = r ? r.item.id : '(no match)';
  let ok;
  if (c.expectNull) ok = !r;
  else if (c.expectIdLike) ok = !!(r && c.expectIdLike.test(r.item.id));
  else ok = !!(r && r.item.id === c.expectId);
  console.log(`${ok ? '✓' : '✗'}  "${c.q}"  →  ${id}`);
  ok ? pass++ : fail++;
}

// ── Intent classifier coverage (shared/assistant-intents.js) ──
import { classifyIntent, classifyOfftopic } from '../shared/assistant-intents.js';

const intentCases = [
  { q: 'hello',                              locale: 'en', expect: 'greeting' },
  { q: 'hi',                                 locale: 'en', expect: 'greeting' },
  { q: 'hey there',                          locale: 'en', expect: 'greeting' },
  { q: '안녕',                                locale: 'ko', expect: 'greeting' },
  { q: 'こんにちは',                          locale: 'ja', expect: 'greeting' },
  { q: '你好',                                locale: 'zh', expect: 'greeting' },
  { q: 'thanks',                             locale: 'en', expect: 'courtesy' },
  { q: '감사합니다',                          locale: 'ko', expect: 'courtesy' },
  { q: 'ありがとう',                          locale: 'ja', expect: 'courtesy' },
  { q: '谢谢',                                locale: 'zh', expect: 'courtesy' },
  { q: 'what can you do?',                   locale: 'en', expect: 'capability' },
  { q: 'help',                               locale: 'en', expect: 'capability' },
  { q: 'tell me about ONEWALLET',            locale: 'en', expect: 'supportedProductQuestion' },
  { q: 'how does MPC recovery work?',        locale: 'en', expect: 'supportedProductQuestion' },
  { q: 'do I need a seed phrase?',           locale: 'en', expect: 'supportedProductQuestion' }, // question form — curated MPC answer handles this
  { q: 'here is my seed phrase abandon abandon abandon', locale: 'en', expect: 'privateData' },
  { q: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', locale: 'en', expect: 'privateData' }, // bare BIP39-style paste
  { q: '제 시드 구문 공유합니다',              locale: 'ko', expect: 'privateData' },
  { q: 'what is the price of $1 next month?',locale: 'en', expect: 'unsafeFinancial' },
  { q: 'will $1 list on Binance?',           locale: 'en', expect: 'unsafeFinancial' },
  { q: 'BTC 가격 알려줘',                     locale: 'ko', expect: 'unsafeFinancial' },
  { q: 'guaranteed yield from $1',           locale: 'en', expect: 'unsafeFinancial' },
  { q: 'are you HSM-backed?',                locale: 'en', expect: 'unsafeFinancial' },
  { q: 'does the server share live in an isolated VPC?', locale: 'en', expect: 'unsafeFinancial' },
  { q: 'how does mpc recovery work without seed phrase please', locale: 'en', expect: 'supportedProductQuestion' },
  { q: 'weather in seoul?',                  locale: 'en', expectOfftopic: 'unsupportedDomain' },
  { q: 'tell me a joke',                     locale: 'en', expectOfftopic: 'benignOfftopic' },
  { q: 'how are you?',                       locale: 'en', expectOfftopic: 'benignOfftopic' }
];

console.log('\n--- intent classifier ---');
for (const c of intentCases) {
  const got = classifyIntent(c.q, c.locale);
  let ok;
  if (c.expectOfftopic) {
    // Off-topic helper is invoked by frontend only after retrieval miss.
    ok = got === 'supportedProductQuestion' && classifyOfftopic(c.q, c.locale) === c.expectOfftopic;
  } else {
    ok = got === c.expect;
  }
  const detail = c.expectOfftopic ? `${got} + offtopic=${classifyOfftopic(c.q, c.locale)}` : got;
  console.log(`${ok ? '✓' : '✗'}  [${c.locale}] "${c.q}"  →  ${detail}`);
  ok ? pass++ : fail++;
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
process.exit(fail ? 1 : 0);
