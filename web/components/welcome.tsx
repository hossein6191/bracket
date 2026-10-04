"use client";

// The box a first-time visitor sees: what the site is, what it settles, the words it uses, and
// where to start. It opens once, and the "How it works" button in the header opens it again.

import * as React from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { useLocal } from "@/components/use-local";
import { readItem, writeItem, notify } from "@/lib/browser-store";

const KEY = "bracket:welcomed";

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

/** Open the welcome box again (used by the header button). */
export function openWelcome(): void {
  writeItem(KEY, null);
  notify();
}

export function WelcomeButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={openWelcome}>
      <HelpCircle /> How it works
    </Button>
  );
}

export function Welcome() {
  const router = useRouter();
  // The server and the first paint assume it was seen, so nothing flashes for a returning visitor.
  const seen = useLocal(() => readItem(KEY) === "1", true);
  const close = () => {
    writeItem(KEY, "1");
    notify();
  };
  return (
    <Dialog open={!seen} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Bracket, in one minute</DialogTitle>
          <DialogDescription className="text-sm text-foreground/85">
            A fixed price before any work starts. The maker writes a rate card once; after that the contract, not the maker,
            tells each stranger which tier their request falls under. What is on trial is the rate card, never your request.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-brand to-brand-secondary text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="min-w-0 text-xs">
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="block text-muted-foreground text-pretty">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">The words this site uses</p>
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {WORDS.map(([word, meaning]) => (
              <div key={word} className="flex gap-2">
                <dt className="shrink-0 font-mono text-foreground">{word}</dt>
                <dd className="text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <InteractiveHoverButton
            onClick={() => {
              close();
              router.push("/cards");
            }}
          >
            Pick a card and ask for a price
          </InteractiveHoverButton>
          <Button type="button" variant="ghost" onClick={close}>
            Look around first
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
