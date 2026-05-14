/**
 * Banned-claim post-filter for model output.
 * Rules live in shared/banned-claims.js (single source of truth) so this filter
 * and scripts/check-claim-safety.mjs cannot drift.
 *
 * Returns true if the text trips a banned-claim rule (and is not negated).
 */

import { BANNED, ALLOWED_NEGATIONS } from '../../../shared/banned-claims.js';

export function containsBannedClaim(text) {
  if (!text) return false;
  const lc = text.toLowerCase();
  for (const { re } of BANNED) {
    const m = re.exec(text);
    if (!m) continue;
    const start = Math.max(0, m.index - 80);
    const window = lc.slice(start, m.index + m[0].length + 80);
    if (ALLOWED_NEGATIONS.some((n) => window.includes(n))) continue;
    return true;
  }
  return false;
}
