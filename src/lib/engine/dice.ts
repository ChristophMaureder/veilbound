// Dice-notation helpers (§4). We render notation as written; this only
// validates/normalises and computes an average for optional display.

const TERM = /^\s*(\d*)d(\d+)\s*$/i;

/** True if a string looks like a dice term ("2d6", "d8") or a flat number. */
export function isDiceLike(s: string): boolean {
  const t = s.trim();
  if (t === '') return false;
  if (/^-?\d+$/.test(t)) return true;
  return TERM.test(t);
}

/** Average value of a single dice/number term (for optional display). */
export function averageOf(term: string): number {
  const t = term.trim();
  if (/^-?\d+$/.test(t)) return Number(t);
  const m = TERM.exec(t);
  if (!m) return 0;
  const count = m[1] === '' ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  return count * ((sides + 1) / 2);
}
