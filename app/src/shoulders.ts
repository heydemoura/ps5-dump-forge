// L2 / R2 switch the screen tabs from anywhere (PS5 only; App.tsx). The PS5 browser keeps L1/R1
// (back, forward) and has no Gamepad API for pages; it sends L2 and R2 as F7 and F8 key events
// (found with the debug build's `/probe`). No React, no runtime imports:
// `node scripts/check-shoulders.mjs` checks the pure parts.

export type Step = -1 | 1;

/** The PS5 browser's L2 (F7) and R2 (F8) keydowns. */
const STEPS: Record<string, Step> = { F7: -1, F8: 1 };

/** The step a key event stands for, if it is L2 or R2. */
export const keyStep = (e: { key: string }): Step | null => STEPS[e.key] ?? null;

/** The tab `step` away from `current` in `order`, wrapping around at the ends. */
export function stepTab<T>(order: readonly T[], current: T, step: Step): T {
  const i = order.indexOf(current);
  if (i < 0) return order[0];
  return order[(i + step + order.length) % order.length];
}

/** Calls `onStep` for every L2/R2 press, whatever has focus (a held trigger's repeats are
 * ignored); returns the stop. */
export function watchShoulders(onStep: (s: Step) => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    const s = keyStep(e);
    if (s === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) onStep(s);
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
}
