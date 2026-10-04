"use client";

// What a maker does once a card is published: share it, try it from another account, and answer
// the orders it books. Shown after publishing and on the maker's own card.

import * as React from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cardPath } from "@/lib/chain";

export function MakerNextSteps({ card }: { card: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${cardPath(card)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the link is also on the page */
    }
  };
  const steps: [string, React.ReactNode][] = [
    [
      "Share the card",
      <>
        Send the link to anyone who might want the work.{" "}
        <button type="button" onClick={copy} className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs text-primary underline-offset-4 hover:underline">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "copied" : "copy the link"}
        </button>
      </>,
    ],
    [
      "Try it from another account",
      "You cannot ask your own card for a price. Switch your wallet to a second account, take test GEN from the faucet, open this card and type a brief.",
    ],
    [
      "Wait for a brief",
      "Each brief is read against your tiers in one transaction. If one tier covers it, that tier's price waits in escrow for you and the rest goes back to the buyer.",
    ],
    [
      "Accept or decline",
      <>
        Booked orders appear under{" "}
        <Link href="/orders" className="text-primary underline-offset-4 hover:underline">
          Orders
        </Link>
        . Accept takes the price; Decline sends it back. The buyer may cancel until you decide.
      </>,
    ],
    [
      "If a brief fits two tiers",
      "Your card overlapped: the buyer gets a quarter of your bond and the card freezes. Revise it on the Publish page with tiers that do not overlap.",
    ],
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">What happens now</p>
      <ol className="space-y-2">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 font-mono text-xs text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{title}</span>
              <span className="block text-muted-foreground text-pretty">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button asChild variant="outline" size="sm">
        <Link href={cardPath(card)}>Open {card}</Link>
      </Button>
    </div>
  );
}
