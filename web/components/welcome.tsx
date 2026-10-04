"use client";

// What a first-time visitor sees: a small card that slides up in the bottom-left corner with what
// the site is. "Show me" opens the whole explanation in a panel from the right edge: what it
// settles, the words it uses, and where to start. "Dismiss" folds it away, and the small
// "How it works" link in the header brings the card back.

import * as React from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";

import { StepTrack } from "@/components/section-help";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocal } from "@/components/use-local";
import { readItem, writeItem, notify } from "@/lib/browser-store";
import { cn } from "@/lib/utils";

const KEY = "bracket:welcomed";

const TITLE = "Bracket, in one minute";
const LEAD =
  "A fixed price before any work starts. The maker writes a rate card once; after that the contract, not the maker, tells each stranger which tier their request falls under. What is on trial is the rate card, never your request.";

const STEPS: [string, string][] = [
  ["A maker publishes a rate card, once", "A translator, an illustrator, a tutor: two to four numbered tiers in their own words, each with a price, and a bond behind the wording."],
  ["You type what you need", "A brief in your own words. You send the price of the dearest tier with it."],
  ["The validators read the card against your brief", "GenLayer's validators each ask which tiers cover the whole brief, twice, with the tiers lettered in two different orders, and must agree."],
  ["One tier covers it: you pay that tier, no more", "Its price stays in escrow for the maker and the rest comes back in the same transaction."],
  ["The card covers it twice: the maker pays you", "You are refunded in full and paid a slice of the maker's bond, and the card is frozen until it is revised. If no tier covers it, everything simply comes back."],
];

const WORDS: [string, string][] = [
  ["Card (C1)", "a maker's rate card; C1 is the first one published"],
  ["Tier", "one numbered line of a card: what is included, and its price"],
  ["Brief", "what a buyer needs, in their own words"],
  ["Order (O2)", "one brief asked on one card; O2 is the second order"],
  ["Ladder", "a card whose tiers run from narrowest to broadest, each containing the last"],
  ["Bond", "money the maker put up against writing tiers that overlap"],
  ["Frozen", "a card caught covering one brief twice; it prices nothing until revised"],
];

/** Bring the welcome card back (used by the header link). */
export function openWelcome(): void {
  writeItem(KEY, null);
  notify();
}

/** The header's small "How it works" link. Under 640 px only its icon shows. */
export function WelcomeButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openWelcome}
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 font-mono text-[11px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <HelpCircle className="size-3.5" aria-hidden />
      <span className="sr-only sm:not-sr-only">How it works</span>
    </button>
  );
}

export function Welcome() {
  const router = useRouter();
  // The server and the first paint assume it was seen, so nothing flashes for a returning visitor.
  const seen = useLocal(() => readItem(KEY) === "1", true);
  const [full, setFull] = React.useState(false);
  const close = () => {
    writeItem(KEY, "1");
    notify();
  };
  return (
    <>
      {seen ? null : (
        <aside
          aria-labelledby="welcome-title"
          className="surface fixed right-4 bottom-4 left-4 z-40 space-y-3 p-4 shadow-2xl shadow-black/60 duration-500 animate-in fade-in-0 slide-in-from-bottom-8 sm:right-auto sm:w-[23rem]"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-secondary" />
            <h2 id="welcome-title" className="text-sm font-semibold">
              {TITLE}
            </h2>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{LEAD}</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                close();
                setFull(true);
              }}
            >
              Show me
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Dismiss
            </Button>
          </div>
        </aside>
      )}
      <Sheet open={full} onOpenChange={setFull}>
        <SheetContent className="max-w-lg">
          <SheetHeader>
            <p className="eyebrow">How it works</p>
            <SheetTitle className="text-xl">{TITLE}</SheetTitle>
            <SheetDescription className="text-foreground/85">{LEAD}</SheetDescription>
          </SheetHeader>
          <StepTrack steps={STEPS} className="mt-6" />
          <div className="mt-6 rounded-lg border bg-background/60 p-3">
            <p className="eyebrow mb-2">The words this site uses</p>
            <dl className="grid gap-y-1.5 text-xs">
              {WORDS.map(([word, meaning]) => (
                <div key={word} className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-mono text-brand">{word}</dt>
                  <dd className="text-muted-foreground">{meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setFull(false);
                router.push("/cards");
              }}
            >
              Pick a card and ask for a price
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFull(false)}>
              Look around first
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
