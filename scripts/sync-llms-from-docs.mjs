#!/usr/bin/env node
/* Sync /llms.txt and /llms-full.txt from Google Docs editorial sources.
 *
 * Auth: service-account JWT (RS256) → OAuth2 access token (scope drive.readonly).
 *       SA key JSON is loaded from one of:
 *         - env GOOGLE_SA_KEY        (raw JSON, used in CI)
 *         - env GOOGLE_SA_KEY_PATH   (file path, used locally)
 *
 * Export: Drive REST files.export with mimeType=text/plain.
 *
 * Normalisation (must match Phase 1 fidelity gate, byte-identical with repo seed):
 *   - strip UTF-8 BOM
 *   - CRLF → LF
 *   - trim trailing whitespace per line
 *   - collapse runs of 2+ blank lines to a single blank line
 *   - ensure exactly one trailing newline
 *
 * Guards:
 *   - refuse to write if normalised export is empty
 *   - refuse to write if normalised export shrinks by >50% vs current repo file
 *
 * Output: writes config.docs[].out files. Prints a JSON summary to stdout
 *         (consumed by the GitHub Action to build the PR body).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSign } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CONFIG_PATH = resolve(HERE, 'llms-sync.config.json');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_EXPORT = (id) =>
  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=text%2Fplain`;
const DRIVE_GET    = (id) =>
  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id%2Cname%2CmodifiedTime%2Cversion`;

const SHRINK_GUARD = 0.5;

function loadServiceAccount() {
  const raw = process.env.GOOGLE_SA_KEY;
  if (raw && raw.trim().startsWith('{')) {
    return JSON.parse(raw);
  }
  const path = process.env.GOOGLE_SA_KEY_PATH;
  if (!path) {
    fail('Set GOOGLE_SA_KEY (raw JSON) or GOOGLE_SA_KEY_PATH (file path).');
  }
  if (!existsSync(path)) fail(`SA key file not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: sa.token_uri || TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = b64url(signer.sign(sa.private_key));
  const assertion = `${signingInput}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(sa.token_uri || TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    fail(`Token exchange failed: ${res.status} ${txt}`);
  }
  const j = await res.json();
  return j.access_token;
}

async function fetchDocText(id, token) {
  const res = await fetch(DRIVE_EXPORT(id), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    fail(`Export failed for ${id}: ${res.status} ${txt}`);
  }
  return await res.text();
}

async function fetchDocMeta(id, token) {
  const res = await fetch(DRIVE_GET(id), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { id };
  return await res.json();
}

function normalise(input) {
  // strip BOM
  let s = input.replace(/^﻿/, '');
  // CRLF → LF (and lone CR → LF)
  s = s.replace(/\r\n?/g, '\n');
  // trim trailing whitespace per line
  s = s.split('\n').map(l => l.replace(/[ \t]+$/g, '')).join('\n');
  // collapse 2+ blank lines to single blank line
  s = s.replace(/\n{3,}/g, '\n\n');
  // ensure exactly one trailing newline
  s = s.replace(/\n+$/g, '') + '\n';
  return s;
}

function fail(msg) {
  console.error(`[sync-llms] ERROR: ${msg}`);
  process.exit(1);
}

async function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const sa = loadServiceAccount();
  const token = await getAccessToken(sa);

  const summary = { changed: false, items: [] };

  for (const entry of config.docs) {
    const outPath = resolve(ROOT, entry.out);
    const meta = await fetchDocMeta(entry.docId, token);
    const raw = await fetchDocText(entry.docId, token);
    const next = normalise(raw);

    if (next.length === 0) fail(`Export for ${entry.label} normalised to empty.`);

    const prev = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
    if (prev.length > 0 && next.length < prev.length * SHRINK_GUARD) {
      fail(`Export for ${entry.label} shrank > ${SHRINK_GUARD * 100}% (prev ${prev.length}B → next ${next.length}B). Aborting.`);
    }

    const changed = next !== prev;
    if (changed) writeFileSync(outPath, next, 'utf8');

    summary.changed = summary.changed || changed;
    summary.items.push({
      out: entry.out,
      label: entry.label,
      docId: entry.docId,
      docVersion: meta.version || null,
      docModifiedTime: meta.modifiedTime || null,
      prevBytes: prev.length,
      nextBytes: next.length,
      changed,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => fail(err?.stack || String(err)));
