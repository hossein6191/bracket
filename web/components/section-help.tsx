"use client";

// A small round "?" beside the title of each part of a page. Pressing it slides in a panel from
// the right edge with what that part is for and what you can do in it, one numbered step at a time.

import * as React from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Numbered steps joined by a vertical line; each step is a sentence, or a title with a sentence under it. */
export function StepTrack({ steps, className }: { steps: (string | [string, string])[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {steps.map((step, i) => {
        const [title, body] = typeof step === "string" ? ["", step] : step;
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 ? <span aria-hidden className="absolute top-7 bottom-0 left-3.5 w-px bg-border" /> : null}
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md border border-brand/40 bg-background font-mono text-[11px] text-brand">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 pt-1 text-sm">
              {title ? <span className="block font-medium text-foreground">{title}</span> : null}
              <span className={cn("block text-pretty", title ? "text-muted-foreground" : "text-foreground/90")}>{body}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type Help = { title: string; what: string; steps: string[] };

const HELP: Record<string, Help> = {
  "cards-list": {
    title: "Published cards",
    what: "Every rate card on this contract, newest first.",
    steps: [
      "Each card is one maker's price list: numbered tiers in their own words, each with a price.",
      "Clean means no brief has been covered by two of its tiers. Frozen means one was; the flags say which tiers.",
      "The bond is what the maker put up against writing tiers that overlap.",
      "Press a card to ask it for a price.",
    ],
  },
  "card-tiers": {
    title: "The tiers",
    what: "The maker's price list, exactly as it was published. Nobody can change it afterwards; a change is a new card.",
    steps: [
      "Read each tier: it says what is included, and its price.",
      "On a ladder each tier contains the one before it, and you pay the narrowest tier that covers your brief.",
      "On any other card the tiers are meant not to overlap, and exactly one must cover your brief.",
      "A tier marked with a flag was caught overlapping another by an earlier brief.",
    ],
  },
  "card-brief": {
    title: "Your brief",
    what: "What you need, in your own words. This is the only thing you write.",
    steps: [
      "Type 20 to 1,200 plain keyboard characters, or press a suggestion written for this card.",
      "Say the things a tier turns on: how much, how long, by when.",
      "The brief is judged whole. A tier covers it only if it covers all of it.",
      "The same words are answered once per card, so a brief cannot be asked again to get a different answer.",
    ],
  },
  "card-money": {
    title: "What happens to your money",
    what: "You send the dearest tier's price, and one transaction decides where it goes.",
    steps: [
      "One tier covers the brief: its price stays in escrow for the maker and the rest comes back.",
      "No tier covers it: everything comes back.",
      "Two tiers cover it on a card that promised no overlap: everything comes back, plus a slice of the maker's bond.",
      "The validators cannot settle it: everything comes back and the brief is closed on this card.",
    ],
  },
  "card-result": {
    title: "The result",
    what: "What the validators agreed on for your brief, and where your money went.",
    steps: [
      "The marks show, tier by tier, which ones cover your whole brief.",
      "The price is what stays in escrow; the rest is already on its way back to your wallet.",
      "The sentence under it was written by the contract from fixed phrases and its own numbers.",
      "Open the order to cancel it, or to watch the maker accept it.",
    ],
  },
  "card-orders": {
    title: "This card's latest orders",
    what: "The newest briefs asked on this card, with how each came out.",
    steps: [
      "Each row is one brief and its outcome.",
      "The counters above add up every order the card ever had.",
      "Press a row to read the whole order.",
    ],
  },
  "card-maker": {
    title: "You published this card",
    what: "What the maker of a card can do with it.",
    steps: [
      "You cannot ask your own card for a price.",
      "Booked orders on it wait for you: open one to accept or decline.",
      "To change the wording, revise the card on the Publish page. It gets a new number and keeps the bond.",
      "To stop, close the card there and the bond that is left comes back.",
    ],
  },
  "order-brief": {
    title: "The brief",
    what: "The buyer's words, stored exactly as they were sent.",
    steps: [
      "This is the text the validators read against the card.",
      "The fingerprint under it is how the contract knows the same brief was not asked twice.",
    ],
  },
  "order-result": {
    title: "The result",
    what: "Which tiers cover the brief, and what that did.",
    steps: [
      "One mark per tier: covered or not, in the card's own order.",
      "The outcome follows from the marks by a rule in code, with nothing left to anyone's judgement.",
      "The sentence was written by the contract from fixed phrases.",
    ],
  },
  "order-money": {
    title: "The money",
    what: "Every amount this order moved.",
    steps: [
      "Sent is what the buyer paid in: the card's dearest tier.",
      "Price is what stays in escrow for the maker while the order is booked.",
      "Returned went back to the buyer in the same transaction.",
      "From the bond is the extra a buyer is paid when the card covered the brief twice.",
    ],
  },
  "order-next": {
    title: "What can be done now",
    what: "The move that is open on this order, and to whom.",
    steps: [
      "A booked order holds its price in escrow.",
      "The buyer may cancel it and take the price back.",
      "The maker may accept it and be paid, or decline it and send the price back.",
      "Any of these ends the order. Each takes one signature and under a minute.",
    ],
  },
  "publish-form": {
    title: "Your card",
    what: "The form that becomes your rate card.",
    steps: [
      "Press an example to fill everything, then make it yours.",
      "Give the card a title and write two to four tiers, each with a price in GEN.",
      "Choose whether the tiers are a ladder or are meant not to overlap.",
      "Enter the bond and press Publish. One signature, under a minute.",
    ],
  },
  "publish-tiers": {
    title: "Tiers",
    what: "Each tier is one sentence saying what is included, and its price.",
    steps: [
      "Write 20 to 240 characters per tier.",
      "Name the limits a brief will be measured against: size, length, deadline.",
      "If the tiers are meant not to overlap, make sure no request could fit two of them.",
      "If they are a ladder, put the narrowest first and the broadest last, each costing more than the one before.",
    ],
  },
  "publish-bond": {
    title: "The ambiguity bond",
    what: "Money you put up against your own wording.",
    steps: [
      "At least 1 GEN, sent with the card.",
      "If a brief is covered by two of your tiers, its buyer is paid a slice of it and the card freezes.",
      "A frozen card prices nothing until you publish a revised one, which keeps what is left of the bond.",
      "When you close a card, the bond that is left comes back to you.",
    ],
  },
  "publish-mine": {
    title: "Your cards",
    what: "The cards this wallet published, with what you can do to each.",
    steps: [
      "Revise loads the card into the form above. A revision must change the tiers; publishing it closes the old card and opens a new one with the bond that is left.",
      "The old card keeps its flags for ever, so its history stays readable.",
      "Close returns the bond that is left. A card with a booked order cannot be closed until you accept or decline it.",
    ],
  },
  "orders-bought": {
    title: "Briefs you asked",
    what: "Your own orders as a buyer, newest first.",
    steps: [
      "Each row shows the card, the outcome and the price.",
      "A booked order holds its price in escrow until the maker answers or you cancel.",
      "Press a row to open the order.",
    ],
  },
  "orders-sold": {
    title: "Orders on your cards",
    what: "What strangers asked the cards you published.",
    steps: [
      "Booked orders wait for you: open one to accept or decline.",
      "Outside, covered twice and no price fixed are already finished; they are here so you can see how your wording reads.",
      "A brief covered twice froze the card. Revise it on the Publish page.",
    ],
  },
  "ledger-stats": {
    title: "Counters",
    what: "The contract's own totals.",
    steps: [
      "Counts are whole numbers; amounts are shown in GEN.",
      "They come from one view of the contract and need no wallet.",
    ],
  },
  "ledger-orders": {
    title: "Every order",
    what: "The newest orders across all cards.",
    steps: [
      "Each row is one brief: its card, its outcome, the price and the contract's sentence.",
      "Use the filter to show one outcome only.",
      "Press a row to open the order, or the card name to open the card.",
    ],
  },
  "ledger-refusals": {
    title: "Refused calls",
    what: "Calls the contract turned away on a rule alone, before any model was asked.",
    steps: [
      "Each row names who called, the card if there was one, and the contract's reason.",
      "What was sent with a refused call went back in the same transaction.",
      "The contract keeps the most recent ones, so the record shows its rules being applied.",
    ],
  },
  "ledger-rule": {
    title: "The rule",
    what: "How the validators agree, in the contract's own words.",
    steps: [
      "The text comes from the contract, not from this site.",
      "Under it are the caps the contract enforces on titles, tiers, briefs and the bond.",
    ],
  },
  "deploy-register": {
    title: "The contract this browser uses",
    what: "Which copy of the contract this site is reading for you.",
    steps: [
      "By default it is the site's own.",
      "If you deployed your own, this browser reads that one instead.",
      "The button brings you back to the site's own.",
    ],
  },
  "deploy-source": {
    title: "Contract source",
    what: "The file that would be deployed, byte for byte.",
    steps: [
      "Read the source or download it.",
      "The fingerprint lets you check that a contract on chain runs exactly this file.",
    ],
  },
  "deploy-wallet": {
    title: "Deploy from your wallet",
    what: "Create your own copy.",
    steps: [
      "Connect a wallet with a little test GEN.",
      "Press Deploy and sign once. It takes about a minute.",
      "Wait a minute more before the network answers reads for the new address.",
    ],
  },
};

export function SectionHelp({ k }: { k: string }) {
  const [open, setOpen] = React.useState(false);
  const h = HELP[k];
  if (!h) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Steps for: ${h.title}`}
        title="Steps"
        className="ml-2 inline-flex size-5 cursor-pointer items-center justify-center rounded-full border border-white/25 align-middle font-mono text-[11px] leading-none font-medium text-muted-foreground transition-colors duration-150 hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        ?
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <p className="eyebrow">Steps</p>
            <SheetTitle>{h.title}</SheetTitle>
            <SheetDescription className="text-foreground/85">{h.what}</SheetDescription>
          </SheetHeader>
          <StepTrack steps={h.steps} className="mt-6" />
        </SheetContent>
      </Sheet>
    </>
  );
}
