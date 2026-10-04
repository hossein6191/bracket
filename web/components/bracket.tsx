"use client";

// How a card and an order are shown everywhere: a card's standing, its tiers with their prices,
// an order's outcome and status, the tier marks the validators agreed on, and the sentence the
// contract itself wrote from its closed tokens. Nothing a model wrote is stored, so nothing a
// model wrote is shown.

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleSlash, Copy as CopyIcon, HelpCircle, Layers, Lock, ShieldCheck, Snowflake } from "lucide-react";

import { cardPath, orderPath, type Card, type Order, type OrderStatus, type Outcome, type Tier } from "@/lib/chain";
import { gen, when } from "@/lib/format";
import { flagWords, outcomeLabel, sentence, standingLabel, statusLabel } from "@/lib/words";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";
const GOOD = "border-keeps/40 bg-keeps/10 text-keeps";
const WARN = "border-gold/40 bg-gold/10 text-gold";
const QUIET = "border-border bg-muted/40 text-muted-foreground";

/** Clean, frozen or closed. */
export function StandingBadge({ card, className }: { card: Pick<Card, "open" | "frozen" | "flags" | "revisedTo">; className?: string }) {
  const Icon = !card.open ? Lock : card.frozen ? Snowflake : ShieldCheck;
  const style = !card.open ? QUIET : card.frozen || card.flags.length ? WARN : GOOD;
  return (
    <span className={cn(pill, style, className)}>
      <Icon className="size-3 shrink-0" />
      {standingLabel(card)}
    </span>
  );
}

export function OutcomeBadge({ outcome, className }: { outcome: Outcome; className?: string }) {
  const Icon = outcome === "exact" ? CheckCircle2 : outcome === "outside" ? CircleSlash : outcome === "ambiguous" ? CopyIcon : HelpCircle;
  const style = outcome === "exact" ? GOOD : outcome === "outside" ? QUIET : WARN;
  return (
    <span className={cn(pill, style, className)}>
      <Icon className="size-3 shrink-0" />
      {outcomeLabel(outcome)}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const style = status === "booked" ? "border-primary/40 bg-primary/10 text-primary" : status === "accepted" ? GOOD : QUIET;
  return <span className={cn(pill, style, className)}>{statusLabel(status)}</span>;
}

export function LadderBadge({ ladder, className }: { ladder: boolean; className?: string }) {
  return (
    <span className={cn(pill, QUIET, className)} title={ladder ? "Each tier contains the one before it; the narrowest covering tier sets the price" : "The maker declared that no request fits two tiers"}>
      <Layers className="size-3 shrink-0" />
      {ladder ? "Ladder: narrowest to broadest" : "Tiers meant not to overlap"}
    </span>
  );
}

/** The tier numbers a card's flags name. */
const flaggedTiers = (flags: string[]): Set<number> => new Set(flags.flatMap((f) => f.split(":").map((x) => Number(x))).filter((n) => n > 0));

/**
 * The tiers of a card, numbered, each with its price. `chosen` highlights the tier that set a
 * price; `mask` adds a covered / not covered mark per tier.
 */
export function TierList({
  tiers,
  flags = [],
  chosen = 0,
  mask = "",
  className,
}: {
  tiers: Tier[];
  flags?: string[];
  chosen?: number;
  mask?: string;
  className?: string;
}) {
  const flagged = flaggedTiers(flags);
  const marks = mask && mask !== "?" && mask.length === tiers.length ? mask : "";
  return (
    <ol className={cn("grid gap-2", className)}>
      {tiers.map((t, i) => {
        const n = i + 1;
        const covered = marks ? marks[i] === "1" : false;
        return (
          <li
            key={n}
            className={cn(
              "flex gap-3 rounded-xl border bg-background/50 p-3",
              chosen === n ? "border-keeps/50 bg-keeps/10" : marks && covered ? "border-gold/40" : "",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-brand to-brand-secondary text-xs font-semibold text-white">
              {n}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm text-foreground/90 text-pretty [overflow-wrap:anywhere]">{t.text}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-foreground">{gen(t.priceAtto)}</span>
                {marks ? (
                  <span className={cn(pill, covered ? (chosen === n ? GOOD : WARN) : QUIET)}>{covered ? "covers the brief" : "does not cover it"}</span>
                ) : null}
                {chosen === n ? <span className={cn(pill, GOOD)}>sets the price</span> : null}
                {flagged.has(n) ? <span className={cn(pill, WARN)}>caught overlapping</span> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The flags of a card in words. */
export function FlagLine({ flags, className }: { flags: string[]; className?: string }) {
  if (!flags.length) return null;
  return (
    <p className={cn("text-xs text-gold", className)}>
      Caught overlapping: {flags.map(flagWords).join("; ")}. A brief was covered by both, its buyer was refunded and paid from the bond.
    </p>
  );
}

/** One card as a tile of the cards page. */
export function CardTile({ card, mine }: { card: Card; mine?: boolean }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">
            {card.id}
            {mine ? " · yours" : ""}
          </p>
          <h3 className="text-lg font-semibold [overflow-wrap:anywhere]">{card.title}</h3>
        </div>
        <StandingBadge card={card} />
      </div>
      <TierList tiers={card.tiers} flags={card.flags} />
      <FlagLine flags={card.flags} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">You send</dt>
          <dd className="font-mono text-foreground">{gen(card.topPriceAtto)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Bond left</dt>
          <dd className="font-mono text-foreground">{gen(card.bondAtto)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Orders</dt>
          <dd className="font-mono text-foreground">{card.orders}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Published</dt>
          <dd className="text-foreground">{when(card.createdAt) || "not recorded"}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LadderBadge ladder={card.ladder} />
        <Link
          href={cardPath(card.open || !card.revisedTo ? card.id : card.revisedTo)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {!card.open && card.revisedTo
            ? `Open its replacement, ${card.revisedTo}`
            : !card.open
              ? "Read this closed card"
              : card.frozen
                ? "Read why it is frozen"
                : "Ask this card for a price"}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

/** Where an order's money went, as a row of figures. */
export function MoneyRow({ order, className }: { order: Order; className?: string }) {
  const cells: [string, string, string][] = [
    ["Price in escrow", order.priceAtto, order.priceAtto !== "0" ? "text-foreground" : "text-muted-foreground"],
    ["Returned to the buyer", order.refundedAtto, "text-foreground"],
    ["Paid from the maker's bond", order.bondPaidAtto, order.bondPaidAtto !== "0" ? "text-gold" : "text-muted-foreground"],
  ];
  if (order.paidAtto !== "0") cells.unshift(["Sent with the brief", order.paidAtto, "text-foreground"]);
  return (
    <dl className={cn("grid gap-2 text-xs sm:grid-cols-2", cells.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3", className)}>
      {cells.map(([label, value, tone]) => (
        <div key={label} className="rounded-lg border bg-background/50 p-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={cn("font-mono text-base font-semibold", tone)}>{gen(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The contract's own sentence about an order. */
export function ContractLine({ line, className }: { line: string; className?: string }) {
  if (!line) return null;
  return (
    <figure className={cn("rounded-xl border border-primary/30 bg-primary/5 p-3", className)}>
      <figcaption className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">The contract wrote</figcaption>
      <blockquote className="mt-1 text-sm text-foreground/90 text-pretty [overflow-wrap:anywhere]">{sentence(line)}</blockquote>
    </figure>
  );
}

/** One order as a row of a list. `showCard` adds the card it was asked on. */
export function OrderRow({ order, showCard = true, role }: { order: Order; showCard?: boolean; role?: string }) {
  return (
    <li className="rounded-xl border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={orderPath(order.id)} className="font-mono text-sm font-semibold text-primary underline-offset-4 hover:underline">
          {order.id}
        </Link>
        {showCard && order.card ? (
          <Link href={cardPath(order.card)} className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            on {order.card}
          </Link>
        ) : null}
        <OutcomeBadge outcome={order.outcome} />
        <StatusBadge status={order.status} />
        {role ? <span className={cn(pill, QUIET)}>{role}</span> : null}
        <span className="ml-auto text-xs text-muted-foreground">{when(order.at)}</span>
      </div>
      {order.brief ? <p className="mt-2 line-clamp-2 text-sm text-foreground/85 [overflow-wrap:anywhere]">{order.brief}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {order.tier > 0 ? (
          <span>
            Tier {order.tier} · <span className="font-mono text-foreground">{gen(order.priceAtto)}</span>
          </span>
        ) : (
          <span>No tier priced it</span>
        )}
        <span>
          Returned <span className="font-mono text-foreground">{gen(order.refundedAtto)}</span>
        </span>
        {order.bondPaidAtto !== "0" ? (
          <span>
            From the bond <span className="font-mono text-gold">{gen(order.bondPaidAtto)}</span>
          </span>
        ) : null}
        <Link href={orderPath(order.id)} className="ml-auto inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          Open <ArrowRight className="size-3" />
        </Link>
      </div>
    </li>
  );
}
