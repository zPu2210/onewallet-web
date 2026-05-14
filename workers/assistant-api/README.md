# ONEWALLET Assistant API (Cloudflare Worker)

Narrow grounded-answer API for the ONEWALLET website assistant. The site itself
stays on Vercel — this Worker only adds a natural-language layer over the
canonical static-RAG corpus.

## Endpoint

```
POST /
Content-Type: application/json

{ "locale": "en" | "ko" | "ja" | "zh", "question": "How does recovery work?" }
```

### Success

```json
{
  "ok": true,
  "mode": "cloudflare-workers-ai",
  "answer": "...",
  "sources": [
    { "id": "wp-ch5", "title": "Security model", "source": "whitepaper.html#ch5" }
  ]
}
```

### Safe fallback

```json
{
  "ok": false,
  "mode": "fallback",
  "answer": "I do not see that confirmed in the current public ONEWALLET materials yet.",
  "sources": [],
  "reason": "unsupported_or_low_context"
}
```

## Architecture

```
Browser → POST /  → Worker
                  ├─ origin / locale / size check
                  ├─ fetch + cache canonical corpus (assistant-knowledge.json)
                  ├─ server-side TF-IDF retrieval (top 3 chunks)
                  ├─ env.AI.run(MODEL_ID, …)  ← Workers AI
                  ├─ banned-claim filter (matches scripts/check-claim-safety.mjs)
                  └─ JSON response with sources
```

Retrieval lives in `src/retrieval.js`; it mirrors the precision floors and
title/tag boosts used by `assets/assistant.js`, so the Worker and the static
fallback agree on what counts as a match.

## Configuration (`wrangler.toml`)

| Var | Purpose |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated origin allow-list for CORS |
| `CORPUS_URL` | URL of canonical `assistant-knowledge.json` (live site) |
| `MODEL_ID` | Workers AI model id (default `@cf/google/gemma-4-26b-a4b-it`) |
| `[ai] binding = "AI"` | Workers AI binding |

## Local dev

```
cd workers/assistant-api
npm install
npx wrangler dev          # prompts CF login; AI calls hit prod and incur cost
```

Smoke test from the repo root with the dev server running on `:8787`:

```
node scripts/smoke-assistant-worker.mjs http://127.0.0.1:8787
```

## Deploy (only when explicitly requested)

```
npx wrangler deploy
```

After deploy, set the public Worker URL in the frontend (see
`assets/assistant.js` → `ONEWALLET_ASSISTANT_API_URL`).

## Guardrails

- POST only; OPTIONS preflight supported.
- Origin must be in `ALLOWED_ORIGINS`.
- Body capped at 4 KB; question capped at 500 chars.
- Locale whitelist: `en`, `ko`, `ja`, `zh`.
- Top 3 chunks max, each capped at 600 chars before the model prompt.
- Banned-claim post-filter falls back if the model fabricates regulated promises.
- On any model/network/parse error → safe refusal, never a partial answer.
