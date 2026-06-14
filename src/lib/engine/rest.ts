// Rest recovery (§9). Each resource (and HP) restores a configurable amount,
// capped at its maximum. A negative amount can model drain if a GM wants it.

export function applyRecovery(current: number, max: number, amount: number): number {
  return Math.max(0, Math.min(max, current + amount));
}
