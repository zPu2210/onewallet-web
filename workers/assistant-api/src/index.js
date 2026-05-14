/**
 * ONEWALLET Assistant API — Cloudflare Worker.
 * Returns grounded answers over the canonical static-RAG corpus, using Workers AI.
 * Frontend (Vercel) stays the source of truth; this Worker is a narrow grounded-answer layer.
 *
 * Contract:
 *   POST  { locale: "en"|"ko"|"ja"|"zh", question: string }
 *   →     { ok, mode, answer, sources, reason? }
 *
 * Safety:
 *   - Server-side retrieval. Client cannot inject chunks.
 *   - Banned-claim post-filter (mirrors scripts/check-claim-safety.mjs).
 *   - Locale whitelist, length/body caps, origin allow-list.
 */

import { buildIndex, retrieveTopK } from './retrieval.js';
import { containsBannedClaim } from './claim-filter.js';

const MAX_BODY_BYTES = 4096;
const MAX_QUESTION_CHARS = 500;
const TOP_K = 3;
const CHUNK_CHAR_CAP = 600;
const CORPUS_TTL_SECONDS = 300; // 5 minutes
const LOCALES = new Set(['en', 'ko', 'ja', 'zh']);

const SYSTEM_PROMPT = [
  'You are the ONEWALLET website assistant.',
  'Answer ONLY from the provided ONEWALLET source chunks below.',
  'If the chunks do not confirm the answer, reply exactly:',
  '"I do not see that confirmed in the current public ONEWALLET materials yet."',
  'Do not use external knowledge.',
  'Do not invent roadmap dates, tokenomics, exchange listings, audit status,',
  'legal status, security vendors, ROI, or guaranteed returns.',
  'Keep answers concise (2–4 sentences).',
  'Reply in the requested locale when possible.'
].join(' ');

const FALLBACK_TEXT = 'I do not see that confirmed in the current public ONEWALLET materials yet.';

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const corsOrigin = allowed.has(origin) ? origin : null;

    if (request.method === 'OPTIONS') {
      if (!corsOrigin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, mode: 'error', reason: 'method_not_allowed' }, 405, corsOrigin);
    }

    if (!corsOrigin) {
      return json({ ok: false, mode: 'error', reason: 'origin_not_allowed' }, 403, null);
    }

    // Cheap pre-check via Content-Length, then re-verify on the actual byte
    // length we read — Content-Length is client-supplied and can lie.
    const cl = Number(request.headers.get('Content-Length') || '0');
    if (cl > MAX_BODY_BYTES) {
      return json({ ok: false, mode: 'error', reason: 'body_too_large' }, 413, corsOrigin);
    }
    let body;
    try {
      const buf = await request.arrayBuffer();
      if (buf.byteLength > MAX_BODY_BYTES) {
        return json({ ok: false, mode: 'error', reason: 'body_too_large' }, 413, corsOrigin);
      }
      const raw = new TextDecoder('utf-8').decode(buf);
      body = JSON.parse(raw);
    } catch {
      return json({ ok: false, mode: 'error', reason: 'invalid_json' }, 400, corsOrigin);
    }

    const locale = typeof body?.locale === 'string' && LOCALES.has(body.locale) ? body.locale : 'en';
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) {
      return json({ ok: false, mode: 'error', reason: 'missing_question' }, 400, corsOrigin);
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return json({ ok: false, mode: 'error', reason: 'question_too_long' }, 413, corsOrigin);
    }
    if (containsBannedClaim(question)) {
      return safeFallback('unsafe_question_filtered', corsOrigin);
    }

    // Server-side retrieval over canonical corpus.
    let corpus;
    try {
      corpus = await loadCorpus(env.CORPUS_URL, ctx);
    } catch (e) {
      return safeFallback('corpus_unreachable', corsOrigin);
    }
    const index = buildIndex(corpus);
    const hits = retrieveTopK(index, question, locale, TOP_K);

    if (!hits.length) {
      return safeFallback('unsupported_or_low_context', corsOrigin);
    }

    // Build prompt with capped chunks.
    const sources = hits.map((h) => ({
      id: h.chunk.id,
      title: h.chunk.title,
      source: h.chunk.source
    }));
    const contextBlock = hits
      .map((h, i) => `[${i + 1}] (${h.chunk.id}) ${h.chunk.title}\n${cap(h.chunk.text, CHUNK_CHAR_CAP)}`)
      .join('\n\n');

    const userMessage =
      `Locale: ${locale}\n` +
      `Question: ${question}\n\n` +
      `ONEWALLET source chunks:\n${contextBlock}\n\n` +
      `Answer using only these chunks.`;

    // Call Workers AI.
    let aiResult;
    try {
      aiResult = await env.AI.run(env.MODEL_ID || '@cf/google/gemma-4-26b-a4b-it', {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        max_completion_tokens: 768,
        reasoning_effort: 'low',
        temperature: 0.2
      });
    } catch (e) {
      return safeFallback('model_error', corsOrigin);
    }

    const answer = extractAnswer(aiResult);
    if (!answer) {
      return safeFallback('empty_model_response', corsOrigin);
    }

    // Banned-claim post-filter. If the model fabricated a banned promise, refuse.
    if (containsBannedClaim(answer)) {
      return safeFallback('unsafe_claim_filtered', corsOrigin);
    }

    return json(
      { ok: true, mode: 'cloudflare-workers-ai', answer, sources },
      200,
      corsOrigin
    );
  }
};

function safeFallback(reason, corsOrigin) {
  return json(
    { ok: false, mode: 'fallback', answer: FALLBACK_TEXT, sources: [], reason },
    200,
    corsOrigin
  );
}

function extractAnswer(result) {
  // Workers AI chat models return { response: string } today, but tolerate alternates.
  if (!result) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result.response === 'string') return result.response.trim();
  if (Array.isArray(result.choices) && result.choices[0]?.message?.content) {
    return String(result.choices[0].message.content).trim();
  }
  return '';
}

function cap(str, n) {
  const s = String(str || '');
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function parseAllowedOrigins(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(payload, status, corsOrigin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (corsOrigin) Object.assign(headers, corsHeaders(corsOrigin));
  return new Response(JSON.stringify(payload), { status, headers });
}

// Fetch canonical corpus from the live site; cache via Cloudflare Cache API.
// Avoids re-fetching on every request and keeps the Worker tied to one source of truth.
async function loadCorpus(corpusUrl, ctx) {
  const url = corpusUrl || 'https://onewallet-web.vercel.app/assets/assistant-knowledge.json';
  const cache = caches.default;
  const cacheKey = new Request(url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return await cached.clone().json();
  }
  const res = await fetch(url, { cf: { cacheTtl: CORPUS_TTL_SECONDS, cacheEverything: true } });
  if (!res.ok) throw new Error(`corpus fetch ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.chunks)) throw new Error('corpus shape invalid');
  const cacheable = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CORPUS_TTL_SECONDS}`
    }
  });
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
  }
  return data;
}
