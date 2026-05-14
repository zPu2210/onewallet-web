#!/usr/bin/env node
/* Build assets/assistant-knowledge.json from approved public sources.
 * Sources:
 *   1. Curated Q&A in assets/assistant-knowledge.js (locale-aware, hand-approved wording)
 *   2. Whitepaper chapters — short summaries baked in below (English; approved-public)
 *   3. Homepage sections — short summaries baked in below (English; approved-public)
 *
 * Output schema per chunk:
 *   { id, locale, title, source, tags, text }
 *
 * Re-run after curated content changes:
 *   node scripts/build-assistant-corpus.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// ── 1. Load curated knowledge by evaluating the IIFE in a sandbox ──────────
const curatedSrc = readFileSync(resolve(ROOT, 'assets/assistant-knowledge.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(curatedSrc, sandbox);
const STR = sandbox.window.ONEWALLET_ASSISTANT?.STR;
if (!STR) {
  console.error('Failed to load STR from assistant-knowledge.js');
  process.exit(1);
}

const chunks = [];

for (const locale of Object.keys(STR)) {
  const t = STR[locale];
  for (const item of t.items) {
    chunks.push({
      id: `qa-${item.id}-${locale}`,
      locale,
      title: item.q,
      source: item.href || '',
      tags: String(item.k || '').split(/\s+/).filter(Boolean),
      text: item.a
    });
  }
}

// ── 2. Whitepaper chapters (EN; approved public copy) ──────────────────────
const wpChapters = [
  { id: 'wp-ch1', title: 'Executive summary', src: 'whitepaper.html#ch1', tags: ['summary','overview','positioning'],
    text: 'ONEWALLET is a Telegram-native Web3 wallet that replaces seed phrases with 2-of-3 MPC custody. The whitepaper covers product, architecture, security, token model, growth, business model, roadmap, team, and risks.' },
  { id: 'wp-ch2', title: 'Product thesis — why Telegram-native finance', src: 'whitepaper.html#ch2', tags: ['thesis','telegram','mini app','stablecoin'],
    text: 'Telegram Mini Apps run native-feeling UIs without app-store gatekeeping. MPC custody has matured from research to production-grade libraries. Stablecoin volume is structurally meaningful for merchant payments. Consumer fatigue with seed-phrase ceremonies opens the field for keyless wallets. ONEWALLET combines wallet, payment rail, and ecosystem in one Telegram-native flow.' },
  { id: 'wp-ch3', title: 'User experience — open like a chat', src: 'whitepaper.html#ch3', tags: ['ux','onboarding','daily actions'],
    text: 'Onboarding opens ONEWALLET as a Telegram Mini App: no app store, no download, no seed phrase, no email. Daily actions: Send (pick from Address book or paste address), Pay (scan merchant QR; chain, amount, FX resolved), Receive (chat-native deep link or QR), Swap (in-app, with route preview), Earn ($1 rewards for active payment and referral behavior).' },
  { id: 'wp-ch4', title: 'Technical architecture — four layers', src: 'whitepaper.html#ch4', tags: ['architecture','edge','custody','settlement'],
    text: 'Layer 1 Client: Telegram Mini App, React + TMA SDK. Layer 2 Edge: auth, MPC orchestration, price feeds, webhooks; stateless functions with zero-knowledge of full keys. Layer 3 Custody (target architecture): MPC server share, signer service, recovery share registry; isolated environment; hardware-protected key storage planned; cannot sign alone. Layer 4 Settlement: chain adapters, payment processor, indexer, merchant API; TON and EVM; idempotent settlement.' },
  { id: 'wp-ch5', title: 'Security model — 2-of-3 MPC and threat model', src: 'whitepaper.html#ch5', tags: ['security','mpc','threshold','threat model','recovery'],
    text: 'Custody promise: no single party can move user funds. The 2-of-3 MPC topology uses a device share, a server share, and a recovery share; any two are required for a threshold signature; shares are rotatable. Threat model: device theft is mitigated by rotating the device share via server plus recovery cooperation; server compromise or Telegram session hijack cannot sign because the server share alone is insufficient, and high-value transfers add re-auth and cooldown; recovery social engineering is mitigated by time-locked recovery. No custody model is unbreakable.' },
  { id: 'wp-ch6', title: 'Token model — $1 utility before allocation', src: 'whitepaper.html#ch6', tags: ['token','utility','fee discount','rewards','governance'],
    text: '$1 utilities: fee discount on payments and swaps (designed), user rewards for payments and referrals (designed), merchant incentives where $1 top-up lowers acceptance fees (designed), ecosystem access to premium mini-apps (planned), governance signal on rewards and fees (planned). $1 is positioned as a utility token; no price, return, or exchange-listing promise is made.' },
  { id: 'wp-ch7', title: 'Growth model — loops not campaigns', src: 'whitepaper.html#ch7', tags: ['growth','referral','merchant','mini-app'],
    text: 'Referral loop: every active user can refer inside chat with one tap. Merchant loop: accepting ONEWALLET introduces customers to the wallet. Mini-app loop: partner mini-apps require a wallet, driving new sign-ups. Forward arrows: users -> wallet -> merchants -> $1 rewards. Feedback: referrals and re-engagement.' },
  { id: 'wp-ch8', title: 'Business model — revenue streams', src: 'whitepaper.html#ch8', tags: ['business','revenue','fees','saas'],
    text: 'Swap fee (designed): bps on in-app token swaps; $1 holders pay less. Merchant fee (designed): bps on settled merchant volume. Mini-app revenue share (planned): take rate on premium mini-app transactions. Merchant SaaS (planned): subscription for analytics, refunds, multi-store. Revenue mix is illustrative.' },
  { id: 'wp-ch9', title: 'Roadmap — public status, no marketing dates', src: 'whitepaper.html#ch9', tags: ['roadmap','phases','status'],
    text: 'Phase 1 Core wallet (MPC custody, TMA, multi-chain): completed. Phase 2 Payments rail (QR invoices, settlement webhooks): in progress. Phase 3 $1 utility (fee discount layer, reward engine): planned. Phase 4 Ecosystem (mini-app store, partner program): planned. Dates are intentionally omitted until owners approve public commitments.' },
  { id: 'wp-ch10', title: 'Team and governance', src: 'whitepaper.html#ch10', tags: ['team','governance','founders'],
    text: 'Operators, not generalists. The team section lists founders, engineering, and operating partners with shipping history across consumer fintech. For governance or partnership questions beyond the listed names, reach the team on Telegram.' },
  { id: 'wp-ch11', title: 'Risks and mitigations', src: 'whitepaper.html#ch11', tags: ['risk','mitigation','custody','platform','regulatory'],
    text: 'High: custody compromise — any flaw in MPC share rotation could expose funds. High: platform dependency — Telegram is the runtime; progressive web fallback is planned. Medium: regulatory shift — rules vary by region; legal counsel is the mitigation. Medium: merchant adoption — requires integration density; anchor partners. Low: token utility drift — activity-linked rewards. Low: localization quality — native review pipeline.' },
  { id: 'wp-ch12', title: 'Glossary and references', src: 'whitepaper.html#ch12', tags: ['glossary','definitions','vocabulary','mpc','tma','webhook'],
    text: 'MPC: multi-party computation. Threshold signature: a signature produced by any qualifying subset of share-holders. TMA: Telegram Mini App. Settlement webhook: a signed HTTP callback used for merchant reconciliation. Recovery share: a non-online MPC share used in recovery flows.' }
];

// ── 3. Homepage sections (EN; approved public copy) ────────────────────────
const homepageSections = [
  { id: 'hp-platform', title: 'Platform — a complete stack for Telegram-native money', src: 'index.html#platform', tags: ['platform','stack','overview'],
    text: 'Open a wallet inside a chat. QR rail, not a portfolio app. 2-of-3 MPC, no single point of failure. Web3 acceptance with Web2 ergonomics. $1 powers the working layer.' },
  { id: 'hp-audience', title: 'Audiences — users, investors, merchants', src: 'index.html#audience', tags: ['audience','users','investors','merchants'],
    text: 'For users: a wallet that just opens. Keyless onboarding inside Telegram. Plain-language recovery. Send, pay, and earn without managing a seed phrase. For investors: Telegram-scale distribution, MPC-secured custody architecture, token utility tied to real activity, referral-driven growth. For merchants: Web3 payments without the Web3 work — QR invoicing, stablecoin settlement, webhooks, ecosystem rewards.' },
  { id: 'hp-security', title: 'Security — keyless by design, recoverable by default', src: 'index.html#security', tags: ['security','mpc','recovery','audit'],
    text: 'Keyless by design. Recoverable by default. Recovery is positioned as recovery, not lockout. Audit-targeted, not audit-claimed: the public copy does not assert a completed audit.' },
  { id: 'hp-payments', title: 'Payments — merchant-grade, not crypto-grade', src: 'index.html#payments', tags: ['payments','merchant','qr','settlement'],
    text: 'Payments, not portfolio screenshots. Merchant-grade payments, not crypto-grade UX. QR invoicing, stablecoin settlement, and webhooks for POS reconciliation.' },
  { id: 'hp-token', title: 'Token — utility first, allocation second', src: 'index.html#token', tags: ['token','utility','allocation'],
    text: 'Utility first. Allocation second. $1 is described as the working-layer token for fees, rewards, merchant incentives, ecosystem access, and governance signals.' },
  { id: 'hp-cta', title: 'How to try ONEWALLET', src: 'https://t.me/onedollar_wallet_bot/app', tags: ['cta','support','telegram','contact'],
    text: 'Open a wallet in a few taps via the Telegram Mini App at https://t.me/onedollar_wallet_bot/app . Account-specific or launch-related questions are handled on Telegram.' }
];

for (const c of wpChapters)        chunks.push({ id: c.id, locale: 'en', title: c.title, source: c.src, tags: c.tags, text: c.text });
for (const c of homepageSections)  chunks.push({ id: c.id, locale: 'en', title: c.title, source: c.src, tags: c.tags, text: c.text });

// ── 4. Write JSON ──────────────────────────────────────────────────────────
const outPath = resolve(ROOT, 'assets/assistant-knowledge.json');
const meta = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  locales: Object.keys(STR),
  count: chunks.length,
  disclosure: 'Approved public copy only. Forward-looking statements remain subject to product, security, and legal review. Not financial advice.'
};
writeFileSync(outPath, JSON.stringify({ meta, chunks }, null, 2) + '\n', 'utf8');
console.log(`Wrote ${chunks.length} chunks across ${meta.locales.length} locales -> ${outPath}`);
