"use client";

// What each page is for, and what a visitor can do on it, step by step. A horizontal stepper at
// the top of every page except the landing page: numbered steps joined by a line, each with its
// short title, and the chosen step's detail below. Open the first time, remembered once folded.
// On the pages where the visitor does something, the page reports how far they have got
// (components/guide-progress.ts) and the stepper moves on by itself: earlier steps are ticked and
// the current one opens. Pressing a step still shows it, until the visitor's next move.

import * as React from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

import { useGuideStep } from "@/components/guide-progress";
import { useLocal } from "@/components/use-local";
import { readItem, writeItem, notify } from "@/lib/browser-store";
import { GUIDES, type Guide } from "@/lib/guides";
import { cn } from "@/lib/utils";

export function PageGuide() {
  const pathname = usePathname() || "/";
  const found = GUIDES.find((g) => g.match(pathname));
  const storeKey = found ? `bracket:guide:${found.guide.key}` : "";
  const closed = useLocal(() => (storeKey ? readItem(storeKey) === "closed" : false), false);
  if (!found) return null;
  const g = found.guide;
  const toggle = () => {
    writeItem(storeKey, closed ? null : "closed");
    notify();
  };
  return (
    <div className="container-site pt-6">
      <section aria-label={`What the ${g.title} page is for`} className="surface overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!closed}
          className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
        >
          <span aria-hidden className="h-4 w-0.5 shrink-0 rounded-full bg-brand" />
          <span className="flex min-w-0 flex-1 flex-col gap-x-3 sm:flex-row sm:items-baseline">
            <span className="text-sm font-medium">What this page is for, step by step</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{closed ? "Press to open the guide for this page" : g.title}</span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", closed ? "" : "rotate-180")} />
        </button>
        {closed ? null : <Stepper key={g.key} guide={g} />}
      </section>
    </div>
  );
}

function Stepper({ guide: g }: { guide: Guide }) {
  const reached = useGuideStep(g.key);
  // A pressed step stays open only while the page reports the same progress it did when pressed.
  const [picked, setPicked] = React.useState<{ at: number | null; step: number } | null>(null);
  const last = g.steps.length - 1;
  const following = reached === null ? 0 : Math.min(reached, last);
  const active = picked && picked.at === reached ? picked.step : following;
  const [title, body] = g.steps[active] ?? g.steps[0];
  return (
    <div className="space-y-4 border-t px-4 pt-4 pb-4">
      <p className="max-w-3xl text-sm text-foreground/85 text-pretty">{g.what}</p>
      {/* The strip scrolls sideways inside itself when the steps do not fit, never the page. */}
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
        <ol className="flex" aria-label="Steps">
          {g.steps.map(([stepTitle], i) => {
            const done = reached === null ? i < active : i < reached;
            const current = i === active;
            return (
              <li key={stepTitle} className="relative w-28 shrink-0 sm:w-auto sm:min-w-0 sm:flex-1">
                {i < g.steps.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn("absolute top-3.5 right-[calc(-50%+1.125rem)] left-[calc(50%+1.125rem)] h-px", done ? "bg-brand" : "bg-border")}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setPicked({ at: reached, step: i })}
                  aria-current={current ? "step" : undefined}
                  className="group flex w-full cursor-pointer flex-col items-center gap-2 px-1 text-center focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "relative flex size-7 items-center justify-center rounded-full border font-mono text-[11px] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
                      current
                        ? "border-brand bg-brand text-black"
                        : done
                          ? "border-brand/60 bg-brand/15 text-brand"
                          : "border-white/20 bg-card text-muted-foreground group-hover:border-brand/60 group-hover:text-foreground",
                    )}
                  >
                    {done && !current ? <Check className="size-3.5" aria-label="done" /> : String(i + 1)}
                  </span>
                  <span className={cn("text-xs leading-snug text-balance", current ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                    {stepTitle}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="rounded-lg border bg-background/60 p-3" aria-live="polite">
        <p className="font-mono text-[11px] text-brand-secondary">
          {String(active + 1)} / {String(g.steps.length)}
          {reached !== null ? (reached > last ? " · all done" : active === following ? " · you are here" : "") : ""}
        </p>
        <p className="mt-1 text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{body}</p>
      </div>
      {g.note ? <p className="text-xs text-muted-foreground">{g.note}</p> : null}
    </div>
  );
}
