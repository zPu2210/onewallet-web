/**
 * Server-side TF-IDF-ish retrieval over the canonical ONEWALLET corpus.
 * Mirrors the scoring/precision rules in assets/assistant.js so client and server
 * agree on which chunks count as a match. Returns top-K above precision floor.
 */

const STOPWORDS = new Set([
  'a','an','the','and','or','but','of','to','in','on','at','for','with','by','from',
  'is','are','was','were','be','been','being','am','do','does','did','done','doing',
  'have','has','had','will','would','can','could','should','may','might','must',
  'i','me','my','we','our','you','your','it','its','they','their','this','that',
  'how','what','why','when','where','who','which','whose','if','so','as','than','then',
  'about','into','onto','over','under','out','up','down','off','no','not','yes',
  'us','him','her','them','also'
]);

const RETRIEVAL_THRESHOLD = 1.2;

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}$]+/gu, ' ').trim();
}

export function tokenize(value, { keepStopwords = false } = {}) {
  const toks = normalize(value).split(/\s+/).filter((t) => t.length > 1);
  return keepStopwords ? toks : toks.filter((t) => !STOPWORDS.has(t));
}

function prepareChunk(c) {
  return {
    chunk: c,
    titleTokens: tokenize(c.title),
    tagTokens: (c.tags || []).flatMap((t) => tokenize(t)),
    textTokens: tokenize(c.text)
  };
}

export function buildIndex(corpus) {
  const byLocale = {};
  for (const c of corpus.chunks) {
    (byLocale[c.locale] = byLocale[c.locale] || []).push(prepareChunk(c));
  }
  const df = new Map();
  const N = corpus.chunks.length;
  for (const c of corpus.chunks) {
    const uniq = new Set([
      ...tokenize(c.title),
      ...(c.tags || []).flatMap((t) => tokenize(t)),
      ...tokenize(c.text)
    ]);
    for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map();
  for (const [t, d] of df) idf.set(t, Math.log(1 + N / (1 + d)));
  return { idf, byLocale };
}

function scoreChunk(prep, terms, idf) {
  let score = 0;
  let hits = 0;
  let titleOrTagHit = false;
  for (const t of terms) {
    const w = idf.get(t) || 0.4;
    const inTitle = prep.titleTokens.includes(t);
    const inTag = prep.tagTokens.includes(t);
    const inText = prep.textTokens.includes(t);
    if (inTitle) score += w * 2.2;
    if (inTag) score += w * 1.6;
    if (inText) score += w * 1.0;
    if (inTitle || inTag || inText) hits++;
    if (inTitle || inTag) titleOrTagHit = true;
  }
  return { score, hits, titleOrTagHit };
}

export function retrieveTopK(index, query, locale, k = 3) {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const pool = (index.byLocale[locale] || []).concat(
    locale !== 'en' ? (index.byLocale.en || []) : []
  );
  if (!pool.length) return [];
  const scored = [];
  for (const prep of pool) {
    const s = scoreChunk(prep, terms, index.idf);
    const precise = s.titleOrTagHit || s.hits >= 2;
    if (precise && s.score >= RETRIEVAL_THRESHOLD) {
      scored.push({ chunk: prep.chunk, score: s.score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  // Dedupe by id (locale duplicates) keeping highest score.
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    const baseId = s.chunk.id.replace(/-(en|ko|ja|zh)$/, '');
    if (seen.has(baseId)) continue;
    seen.add(baseId);
    out.push(s);
    if (out.length >= k) break;
  }
  return out;
}
