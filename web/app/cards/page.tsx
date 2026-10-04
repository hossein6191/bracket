"use client";

// Every published rate card: its tiers and prices, the bond behind it, and its standing (clean,
// or frozen with the tier pairs an earlier brief caught overlapping). No wallet is needed to read
// any of it. The contract lists its 24 newest cards; older ones are fetched a page at a time.

import * as React from "react";
import Link from "next/link";
import { PenLine } from "lucide-react";

import { CardTile } from "@/components/bracket";
import { BlockSkeleton, ReadBlock, ReadError } from "@/components/read-state";
import { SectionHelp } from "@/components/section-help";
import { Button } from "@/components/ui/button";
import { RetroButton } from "@/components/ui/button-retro";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useMe } from "@/components/use-me";
import { useRead } from "@/components/use-read";
import { idNumber, readCards, readCardsFrom, type Card } from "@/lib/chain";

type Filter = "all" | "open" | "frozen";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["open", "Taking briefs"],
  ["frozen", "Frozen"],
];

export default function CardsPage() {
  const me = useMe();
  const cards = useRead(() => readCards(), []);
  const [older, setOlder] = React.useState<Card[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [moreError, setMoreError] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  const loadOlder = async (lowest: number) => {
    setLoading(true);
    setMoreError("");
    try {
      // The next page starts one below the lowest number shown, and runs downwards.
      const page = await readCardsFrom(lowest - 1);
      setOlder((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.data.filter((c) => idNumber(c.id) < lowest && !seen.has(c.id))];
      });
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : "could not reach the network");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-site space-y-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Rate cards <SectionHelp k="cards-list" />
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each card is one maker&apos;s price list in their own words. Open one, type what you need, and the contract tells you
            which tier covers it. Reading costs nothing and needs no wallet.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
          <Link href="/publish">
            <PenLine /> Publish a card
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Which cards to show">
        {FILTERS.map(([key, label]) => (
          <RetroButton key={key} type="button" variant={filter === key ? "cyan" : "darkGray"} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </RetroButton>
        ))}
      </div>

      <ReadBlock
        state={cards}
        skeleton={
          <div className="grid gap-4 lg:grid-cols-2">
            <BlockSkeleton lines={6} />
            <BlockSkeleton lines={6} />
          </div>
        }
        emptyWhen={(d) => d.rows.length === 0}
        empty={
          <div className="surface space-y-3 p-6 text-sm">
            <p className="font-medium">No card has been published on this contract yet.</p>
            <p className="text-muted-foreground">
              The first one is yours to write: the Publish page has whole example cards to start from. It takes one signature
              and under a minute.
            </p>
            <LiquidButton asChild size="sm" className="text-foreground">
              <Link href="/publish">
                <span className="relative z-10">Publish the first card</span>
              </Link>
            </LiquidButton>
          </div>
        }
      >
        {(d) => {
          const all = [...d.rows, ...older.filter((c) => !d.rows.some((r) => r.id === c.id))];
          const shown = all.filter((c) => (filter === "open" ? c.open && !c.frozen : filter === "frozen" ? c.open && c.frozen : true));
          const lowest = all.reduce((m, c) => Math.min(m, idNumber(c.id)), Number.MAX_SAFE_INTEGER);
          return (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Showing {shown.length} of {all.length} loaded {all.length === 1 ? "card" : "cards"}, newest first.
              </p>
              {shown.length === 0 ? (
                <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  No loaded card matches this filter. Choose All to see every card.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {shown.map((c) => (
                    <CardTile key={c.id} card={c} mine={!!me.address && c.maker === me.address} />
                  ))}
                </div>
              )}
              {lowest > 1 && all.length > 0 ? (
                <div className="space-y-2">
                  <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadOlder(lowest)}>
                    {loading ? "Reading older cards, a few seconds" : "Load older cards"}
                  </Button>
                  {moreError ? <ReadError compact detail={moreError} onRetry={() => void loadOlder(lowest)} /> : null}
                </div>
              ) : null}
            </div>
          );
        }}
      </ReadBlock>
    </div>
  );
}
