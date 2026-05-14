/**
 * Single source of truth for ONEWALLET banned-claim rules.
 *
 * Imported by:
 *   - Cloudflare Worker post-filter (workers/assistant-api/src/claim-filter.js)
 *     to refuse model output that fabricates regulated/promotional promises.
 *   - Source-scanner (scripts/check-claim-safety.mjs) to keep approved copy
 *     (HTML / llms text / corpus JSON) free of the same banned phrases.
 *
 * Editing rule: change banned regex or allowed negations ONLY here. Both
 * consumers re-import on next run, so they cannot drift.
 */

// Phrase regex → human reason. Case-insensitive, multiline-safe.
export const BANNED = [
  { re: /\bguaranteed (returns?|yield|profit|roi|listing)/i,                  reason: 'guaranteed returns/listing promise' },
  { re: /\b(roi|return on investment)\b[^.\n]{0,40}\b(of|will|guaranteed)/i,  reason: 'ROI promise' },
  { re: /\blisted on (binance|coinbase|okx|bybit|upbit|bithumb)\b/i,          reason: 'exchange-listing claim' },
  { re: /\baudit (completed|passed|finalized|finished)\b/i,                   reason: 'completed-audit claim' },
  { re: /\bbank[- ]grade (security|custody|infrastructure)\b/i,               reason: 'bank-grade claim' },
  { re: /\bhsm[- ]backed\b/i,                                                 reason: 'HSM-backed vendor claim' },
  { re: /\bisolated vpc\b/i,                                                  reason: 'isolated-VPC vendor claim' },
  { re: /\bregulator[- ]?approved\b/i,                                        reason: 'regulator-approved claim' },
  { re: /\bfdic[- ]?insured\b/i,                                              reason: 'FDIC-insured claim' }
];

// Lower-cased literal phrases that, if found in the 80-char window around a
// banned hit, explicitly negate/disclaim it (e.g. "no audit is claimed").
export const ALLOWED_NEGATIONS = [
  'audit-targeted, not audit-claimed',
  'no audit is claimed',
  'no exchange-listing promise',
  'no exchange listing is promised',
  'no audit completion is claimed',
  'do not see that confirmed'
];
