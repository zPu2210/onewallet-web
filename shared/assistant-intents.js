/**
 * ONEWALLET assistant intent classifier.
 *
 * Single source of truth for the small-talk / safety / capability router
 * that runs BEFORE corpus retrieval. Stage 1 uses this from the browser
 * (via assets/assistant-intents.js shim) and from Node smoke tests.
 * Stage 2 will import it from the Cloudflare Worker.
 *
 * Banned-claim patterns are re-used from shared/banned-claims.js so the
 * "unsafeFinancial" branch cannot drift from the Worker post-filter.
 *
 * classifyIntent(query, locale) returns one of:
 *   'unsafeFinancial' | 'privateData' | 'greeting' | 'courtesy' |
 *   'capability'      | 'unsupportedDomain' | 'benignOfftopic' |
 *   'supportedProductQuestion'
 *
 * 'supportedProductQuestion' is the fall-through; callers should still run
 * retrieval on it to decide between a grounded answer and t.fallback.
 */

import { BANNED } from './banned-claims.js';

// ── Private wallet / recovery data — refuse to process, warn user. ──────────
// Two-stage match: the query must contain a sensitive keyword AND a sharing/
// declarative clue. Otherwise legitimate questions like "do I need a seed
// phrase?" get redacted, and the curated MPC answer never reaches the user.
const PRIVATE_DATA_KEYWORDS = [
  /\bseed\s*phrase\b/i,
  /\brecovery\s*phrase\b/i,
  /\bmnemonic\b/i,
  /\bprivate\s*key\b/i,
  /\bsecret\s*key\b/i,
  /시드\s*(구문|문구|키)/, /니모닉/, /개인\s*키/, /복구\s*(구문|문구|키)/,
  /シード\s*フレーズ/, /ニーモニック/, /秘密\s*鍵/, /リカバリー\s*(フレーズ|キー)/,
  /助记词/, /私钥/, /恢复\s*(短语|词组|密钥)/
];
const PRIVATE_DATA_SHARE = [
  /\b(here\s+is|here\s+are|this\s+is|my)\b/i,
  /\b(share|paste|enter|sending|sent|saving)\b/i,
  /\bi['’]?ll\b/i,
  // KO declaratives
  /(여기|이게|제\s*것|공유)/u,
  // JA declaratives
  /(これは|私の|共有|貼り付け)/u,
  // ZH declaratives
  /(这是|我的|分享|粘贴)/u
];
// Bare paste: a run of 12+ lowercase ASCII words of BIP39 length (3-8 chars,
// no digits, no punctuation). Triggers privateData on its own — no keyword
// needed, because the paste IS the leak. The 12-word floor is BIP39's
// minimum; tightening from 8 → 12 stops normal product questions like
// "how does mpc recovery work without seed phrase please" from being
// mis-redacted.
const PRIVATE_DATA_PASTE = /(?:\b[a-z]{3,8}\b\s+){11,}\b[a-z]{3,8}\b/;

// ── Unsafe financial claims — refuse, route to disclosure. ──────────────────
// Extends the Worker's BANNED list (which targets MODEL OUTPUT) with USER-input
// patterns that fish for price/listing/yield talk. Word-bounded; mostly latin.
const FINANCIAL_PROBE = [
  /\b(price|pump|moon|listing|airdrop|yield|apr|apy)\b/i,
  /\b(when|will).{0,20}\b(list|listed|listing)\b/i,
  /\b(roi|return on investment)\b/i,
  /\b(guarantee|guaranteed)\b/i,
  // KO
  /상장|에어드(랍|롭)|수익률|이자율|보장|가격|시세/,
  // JA
  /上場|エアドロップ|利回り|保証/,
  // ZH
  /上(线|架)|空投|收益率|保证|保障/
];

// ── Short, greeting-only inputs. ────────────────────────────────────────────
// We only trigger 'greeting' when the WHOLE query is a greeting, otherwise a
// "hi, how does MPC work?" would be mis-routed. Enforced by token-length cap.
const GREETING = [
  /^(hello|hi+|hey+|yo|howdy|sup|hola|greetings)\b/i,
  /^안녕(하세요|히)?$/u,
  /^반가워요?$/u,
  /^(こんにちは|こんばんは|やあ|もしもし|おはよう(ございます)?)$/u,
  /^(你好|您好|嗨|哈喽|哈囉)$/u
];

const COURTESY = [
  /^(thanks?|thank\s*you|ty|thx|cheers|ok(ay)?|cool|got\s*it|nice|great)\b/i,
  /^(고마워요?|고맙습니다|감사(합니다|해요)?|알겠어요?|좋아요?|넵|네)$/u,
  /^(ありがとう(ございます)?|了解(です)?|わかりました|オーケー)$/u,
  /^(谢谢|多谢|好的|明白了|了解|可以)$/u
];

const CAPABILITY = [
  /^(help|topics|menu|what can (you|i) (do|ask)|what (do|can) you do)\b/i,
  /\b(what topics|what subjects|어떤(\s*것|걸)?\s*(물어|도와))/i,
  /무엇을\s*(도와|물어|할\s*수\s*있)/u,
  /^(何が(できる|聞ける))/u,
  /(能做什么|可以问什么|帮我做什么)/u
];

// ── Benign off-topic small talk (no Worker call, brief redirect). ───────────
const BENIGN_OFFTOPIC = [
  /^how\s+are\s+you\b/i,
  /\b(your\s+name|who\s+are\s+you)\b/i,
  /\btell\s+me\s+a\s+joke\b/i,
  /잘\s*지내|이름이\s*뭐|농담/u,
  /(元気|お名前|冗談)/u,
  /(你\s*好\s*吗|你叫什么|讲个笑话|说个笑话)/u
];

// ── Off-topic domains we won't try to answer. Tight keyword list. ───────────
// Only consulted if bestMatch returned null AND no other intent matched.
const UNSUPPORTED_DOMAIN = [
  /\b(weather|forecast|temperature)\b/i,
  /\b(stocks?|nasdaq|s&p|dow\s+jones)\b/i,
  /\b(nba|nfl|fifa|world\s+cup|soccer|football\s+score)\b/i,
  /\b(movie|netflix|recipe|cooking)\b/i,
  /\b(btc|bitcoin|eth|ethereum)\s+price\b/i,
  /\b(crypto|coin)\s+(price|chart)\b/i,
  // KO/JA/ZH
  /날씨|영화|레시피|요리|주가/u,
  /天気|映画|レシピ|料理|株価/u,
  /天气|电影|食谱|烹饪|股价/u
];

const MAX_GREETING_TOKENS = 3;

function normalize(value) {
  return String(value || '').trim();
}

function tokenCount(str) {
  return str.split(/\s+/).filter(Boolean).length;
}

function matchesAny(patterns, text) {
  for (const re of patterns) if (re.test(text)) return true;
  return false;
}

export function classifyIntent(query, _locale) {
  const raw = normalize(query);
  if (!raw) return 'supportedProductQuestion';
  const lc = raw.toLowerCase();

  // 1. Safety first — private recovery data. Two trigger paths:
  //    (a) sensitive keyword + sharing/declarative clue
  //    (b) bare BIP39-style paste (8+ lowercase ASCII words in a row)
  // Either path returns privateData; legit questions like "do I need a seed
  // phrase?" hit neither and reach the curated MPC answer.
  if (PRIVATE_DATA_PASTE.test(raw)) return 'privateData';
  if (matchesAny(PRIVATE_DATA_KEYWORDS, raw) && matchesAny(PRIVATE_DATA_SHARE, raw)) {
    return 'privateData';
  }

  // 2. Safety — unsafe financial claim probes (banned-claim regex + user probes).
  for (const { re } of BANNED) if (re.test(raw)) return 'unsafeFinancial';
  if (matchesAny(FINANCIAL_PROBE, raw)) return 'unsafeFinancial';

  // 3. Greeting — only short, greeting-only inputs.
  if (tokenCount(lc) <= MAX_GREETING_TOKENS && matchesAny(GREETING, raw)) {
    return 'greeting';
  }

  // 4. Courtesy — same short rule.
  if (tokenCount(lc) <= MAX_GREETING_TOKENS && matchesAny(COURTESY, raw)) {
    return 'courtesy';
  }

  // 5. Capability — "what can you do?"
  if (matchesAny(CAPABILITY, raw)) return 'capability';

  // 6. Supported product question is the fall-through. The caller still
  // runs retrieval to decide between a grounded answer and t.fallback.
  // Unsupported-domain and benign-offtopic are evaluated by the caller
  // AFTER retrieval misses, via the helpers below.
  return 'supportedProductQuestion';
}

// Called by the frontend ONLY when retrieval returned null. Lets us prefer
// a real product answer for queries that happen to mention a generic word.
export function classifyOfftopic(query) {
  const raw = normalize(query);
  if (!raw) return 'supportedProductQuestion';
  if (matchesAny(UNSUPPORTED_DOMAIN, raw)) return 'unsupportedDomain';
  if (matchesAny(BENIGN_OFFTOPIC, raw)) return 'benignOfftopic';
  return 'supportedProductQuestion';
}

// Exported for tests / debugging only.
export const _patterns = {
  PRIVATE_DATA_KEYWORDS, PRIVATE_DATA_SHARE, PRIVATE_DATA_PASTE, FINANCIAL_PROBE,
  GREETING, COURTESY, CAPABILITY, BENIGN_OFFTOPIC, UNSUPPORTED_DOMAIN
};
