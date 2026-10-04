"use client";

// The landing page's moving parts. The hero's two actions, and a rate card that shows what
// Bracket does: one example card of three tiers, and under it three briefs. The card lights the
// tiers each brief falls under, and each brief shows the money that comes back: one priced
// exactly, one outside the card, one covered twice and paid from the maker's bond. The briefs
// take turns by themselves; pointing at the card pauses it and pressing a brief picks it.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText } from "lucide-react";

import { LadderBadge, MoneyRow, OutcomeBadge, TierList } from "@/components/bracket";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { ShinyButton } from "@/components/ui/shiny-button";
import { LIMITS, type Order, type Outcome, type Tier } from "@/lib/chain";
import { COPYWRITER, type ExampleBrief } from "@/lib/examples";
import { gen, toAtto } from "@/lib/format";
import { cn } from "@/lib/utils";

export function HeroActions() {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ShinyButton label="Get a binding price" onClick={() => router.push("/cards")} cornerRadius={12} />
      <LiquidButton asChild size="lg" className="text-foreground">
        <Link href="/ledger">
          <span className="relative z-10 inline-flex items-center gap-2">
            <BookOpenText className="size-4" /> See what already happened
          </span>
        </Link>
      </LiquidButton>
    </div>
  );
}

// ---- the example card and its three briefs ----

const DEMO = COPYWRITER;
const TIERS: Tier[] = DEMO.tiers.map((t) => ({ text: t.text, priceAtto: toAtto(t.price).toString() }));
const TOP = TIERS.reduce((m, t) => (BigInt(t.priceAtto) > m ? BigInt(t.priceAtto) : m), 0n);
const SLICE = toAtto(DEMO.bond) / BigInt(LIMITS.bondSlices);

const covers = (b: ExampleBrief): number[] => (Array.isArray(b.covers) ? b.covers : []);

const priceOf = (b: ExampleBrief): bigint => BigInt(TIERS[covers(b)[0] - 1].priceAtto);

/** One exact (the cheapest, so something comes back), one outside, one covered twice, in that order. */
const PICKED: ExampleBrief[] = [
  DEMO.briefs.filter((b) => covers(b).length === 1).sort((a, b) => (priceOf(a) < priceOf(b) ? -1 : priceOf(a) > priceOf(b) ? 1 : 0))[0],
  DEMO.briefs.find((b) => Array.isArray(b.covers) && b.covers.length === 0),
  DEMO.briefs.find((b) => covers(b).length === 2),
].filter((b): b is ExampleBrief => !!b);

/** The order the contract would book for an example brief, worked out the way the contract does. */
function exampleOrder(b: ExampleBrief): Order {
  const c = covers(b);
  const outcome: Outcome = c.length === 1 ? "exact" : c.length === 0 ? "outside" : "ambiguous";
  const tier = outcome === "exact" ? c[0] : 0;
  const price = tier ? BigInt(TIERS[tier - 1].priceAtto) : 0n;
  return {
    id: "",
    card: "",
    buyer: "",
    maker: "",
    brief: b.brief,
    briefDigest: "",
    outcome,
    mask: TIERS.map((_, i) => (c.includes(i + 1) ? "1" : "0")).join(""),
    tier,
    priceAtto: price.toString(),
    paidAtto: TOP.toString(),
    refundedAtto: (TOP - price).toString(),
    bondPaidAtto: (outcome === "ambiguous" ? SLICE : 0n).toString(),
    status: "",
    line: "",
    at: 0,
    settledAt: 0,
  };
}

const ORDERS = PICKED.map(exampleOrder);

function litWords(o: Order): string {
  const lit = [...o.mask].flatMap((m, i) => (m === "1" ? [i + 1] : []));
  if (lit.length === 0) return "No tier lights up";
  if (lit.length === 1) return `Tier ${lit[0]} lights up`;
  return `Tiers ${lit.slice(0, -1).join(", ")} and ${lit[lit.length - 1]} light up`;
}

function backWords(o: Order): string {
  return o.bondPaidAtto !== "0" ? `${gen(o.refundedAtto)} back, plus ${gen(o.bondPaidAtto)} from the bond` : `${gen(o.refundedAtto)} back`;
}

/** The tiers a brief lit, as one small square per tier. */
function MiniMask({ order }: { order: Order }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {[...order.mask].map((m, i) => (
        <span
          key={i}
          className={cn(
            "size-2.5 rounded-[2px] border",
            m !== "1" ? "border-white/20" : order.outcome === "exact" ? "border-keeps bg-keeps" : "border-gold bg-gold",
          )}
        />
      ))}
    </span>
  );
}

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function RateDemo() {
  const [active, setActive] = React.useState(0);
  // Pointing at the card pauses the turns; pressing a brief stops them for good.
  const [paused, setPaused] = React.useState(false);
  const [picked, setPicked] = React.useState(false);
  const still = React.useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const cycling = !still && !picked && ORDERS.length > 1;
  const o = ORDERS[active];
  if (!o) return null;

  return (
    <div
      className="min-w-0 space-y-3"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="surface overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="eyebrow">Example rate card</p>
            <p className="mt-0.5 font-semibold tracking-tight">{DEMO.title}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className={cn("size-1.5 rounded-full bg-brand-secondary", cycling && !paused && "animate-pulse")} aria-hidden />
            brief {active + 1} of {ORDERS.length}
          </span>
        </div>
        <div className="space-y-3 p-4">
          <TierList tiers={TIERS} chosen={o.tier} mask={o.mask} />
          <div className="flex flex-wrap items-center gap-1.5">
            <LadderBadge ladder={DEMO.ladder} />
            <span className="inline-flex items-center rounded-[4px] border border-white/12 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] leading-4 text-muted-foreground">
              A buyer sends {gen(TOP)}
            </span>
            <span className="inline-flex items-center rounded-[4px] border border-white/12 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] leading-4 text-muted-foreground">
              Bond {gen(toAtto(DEMO.bond))}
            </span>
          </div>
        </div>
        <div className="space-y-3 border-t bg-background/40 p-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">The brief</p>
            <OutcomeBadge outcome={o.outcome} />
          </div>
          <p className="doc-text text-foreground/85">{o.brief}</p>
          <MoneyRow order={o} />
        </div>
        {cycling ? (
          <div className="h-px bg-border">
            <span
              key={active}
              className="block h-px origin-left bg-linear-to-r from-brand to-brand-secondary"
              style={{ animation: "demo-progress 5.5s linear forwards", animationPlayState: paused ? "paused" : "running" }}
              onAnimationEnd={() => setActive((i) => (i + 1) % ORDERS.length)}
            />
          </div>
        ) : null}
      </div>

      <ul className="grid gap-2 sm:grid-cols-3" aria-label="Three example briefs">
        {ORDERS.map((x, i) => (
          <li key={i} className="flex">
            <button
              type="button"
              aria-pressed={i === active}
              onClick={() => {
                setPicked(true);
                setActive(i);
              }}
              className={cn(
                "flex w-full cursor-pointer flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                i === active ? "border-brand/60 shadow-[inset_0_2px_0_#4a9eff]" : "hover:border-white/25",
              )}
            >
              <OutcomeBadge outcome={x.outcome} className="self-start whitespace-nowrap" />
              <span className="text-sm leading-snug font-medium">{PICKED[i].label}</span>
              <span className="mt-auto space-y-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MiniMask order={x} />
                  {litWords(x)}
                </span>
                <span className="block text-foreground">{backWords(x)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
