// Reduced-motion-aware helpers (§10). Svelte's CSS-based transitions are also
// neutralised by the global media query in app.css, but gating the durations
// here keeps JS-driven timing (staggers, tweens) honest too.

const reduce =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const reducedMotion = reduce;

/** Returns 0 when the user prefers reduced motion, else the given ms. */
export function dur(ms: number): number {
  return reduce ? 0 : ms;
}
