"use client";

// Where the visitor has got to on a page, for the stepper at the top (components/page-guide.tsx).
// A page reports the step it has reached from its own state: the card page from the brief and the
// quote, the publish page from the form, and so on. The stepper then marks the earlier steps done
// and shows the current one by itself. A page that reports nothing (the reading pages) leaves the
// stepper as a guide the visitor clicks through.

import * as React from "react";

const reached = new Map<string, number>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** Report that the visitor has reached `step` (0-based) of the guide `key`; steps.length means every step is done. */
export function useGuideProgress(key: string, step: number): void {
  React.useEffect(() => {
    reached.set(key, step);
    changed();
  }, [key, step]);
  React.useEffect(
    () => () => {
      reached.delete(key);
      changed();
    },
    [key],
  );
}

/** The step the page reported for `key`, or null when it reports none. */
export function useGuideStep(key: string): number | null {
  return React.useSyncExternalStore(
    subscribe,
    () => reached.get(key) ?? null,
    () => null,
  );
}
