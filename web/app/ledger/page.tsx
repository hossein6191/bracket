"use client";

// The public record: the contract's counters, the newest orders of every card with the outcome
// and the sentence the contract wrote, and the agreement rule in the contract's own words. No
// wallet is needed for any of it.

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { OrderRow } from "@/components/bracket";
import { BlockSkeleton, ReadBlock } from "@/components/read-state";
import { SectionHelp } from "@/components/section-help";
import { Button } from "@/components/ui/button";
import { useRead } from "@/components/use-read";
import { Address } from "@/components/address";
import { cardPath, readLedger, readRefusals, readRule, readStats, type Outcome } from "@/lib/chain";
import { gen, when } from "@/lib/format";
import { outcomeLabel, sentence, statIsMoney, statWords } from "@/lib/words";
import { cn } from "@/lib/utils";

const box = "rounded-2xl border bg-card p-5 sm:p-6";

type Filter = Outcome | "all";
const FILTERS: Filter[] = ["all", "exact", "outside", "ambiguous", "unclear"];

export default function LedgerPage() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const stats = useRead(() => readStats(), []);
  const ledger = useRead(() => readLedger(), []);
  const refusals = useRead(() => readRefusals(), []);
  const rule = useRead(() => readRule(), []);

  return (
    <div className="container-site space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every brief anybody asked, on every card. A brief the card covered twice is published exactly like one that was priced:
          with the tier marks the validators agreed on and the sentence the contract wrote. No wallet is needed to read any of
          this.
        </p>
      </div>

      <section className={cn(box, "space-y-4")} aria-labelledby="stats-title">
        <h2 id="stats-title" className="text-lg font-semibold">
          Counters <SectionHelp k="ledger-stats" />
        </h2>
        <ReadBlock
          state={stats}
          skeleton={<BlockSkeleton lines={2} />}
          emptyWhen={(d) => d.entries.length === 0}
          empty={<p className="text-sm text-muted-foreground">The contract published no counters.</p>}
        >
          {(d) => (
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
              {d.entries.map((e) => (
                <div key={e.key} className="rounded-lg border bg-background/50 p-3">
                  <dt className="text-muted-foreground">{statWords(e.key)}</dt>
                  <dd className="font-mono text-base font-semibold">{statIsMoney(e.key, e.value) ? gen(e.value) : e.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </ReadBlock>
      </section>

      <section className={cn(box, "space-y-4")} aria-labelledby="orders-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="orders-title" className="text-lg font-semibold">
            Every order, newest first <SectionHelp k="ledger-orders" />
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which outcomes to show">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors",
                  filter === f ? "border-primary/50 bg-primary/15 text-foreground" : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all" ? "All" : outcomeLabel(f)}
              </button>
            ))}
          </div>
        </div>
        <ReadBlock
          state={ledger}
          skeleton={<BlockSkeleton lines={6} />}
          emptyWhen={(rows) => rows.length === 0}
          empty={
            <div className="space-y-3 text-sm">
              <p className="font-medium">No brief has been asked on this contract yet.</p>
              <p className="text-muted-foreground">The first order appears here a few seconds after its transaction is final.</p>
              <Button asChild variant="cool" size="sm">
                <Link href="/cards">
                  Open the cards <ArrowRight />
                </Link>
              </Button>
            </div>
          }
        >
          {(rows) => {
            const shown = rows.filter((o) => filter === "all" || o.outcome === filter);
            return (
              <div className="space-y-3">
                {shown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None of the {rows.length} newest orders had this outcome. Choose All to see them.</p>
                ) : (
                  <ul className="grid gap-2">
                    {shown.map((o) => (
                      <OrderRow key={o.id} order={o} />
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  The {rows.length === 1 ? "newest order" : `${rows.length} newest orders`}. The contract lists one page here; older orders are on
                  each card&apos;s page.
                </p>
              </div>
            );
          }}
        </ReadBlock>
      </section>

      <section className={cn(box, "space-y-3")} aria-labelledby="refusals-title">
        <h2 id="refusals-title" className="text-lg font-semibold">
          Calls refused with no model asked <SectionHelp k="ledger-refusals" />
        </h2>
        {refusals.error && !refusals.data ? (
          <p className="text-sm text-muted-foreground">The refusals could not be read just now. They are a record only; nothing depends on them.</p>
        ) : (
          <ReadBlock
            state={refusals}
            skeleton={<BlockSkeleton lines={2} />}
            emptyWhen={(rows) => rows.length === 0}
            empty={<p className="text-sm text-muted-foreground">No call has been refused on this contract yet.</p>}
          >
            {(rows) => (
              <ul className="grid gap-2">
                {rows.map((r) => (
                  <li key={r.seq} className="rounded-xl border bg-background/40 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">#{r.seq}</span>
                      <Address value={r.by} />
                      {r.card ? (
                        <Link href={cardPath(r.card)} className="font-mono text-primary underline-offset-4 hover:underline">
                          {r.card}
                        </Link>
                      ) : null}
                      <span className="ml-auto">{when(r.at)}</span>
                    </div>
                    <p className="mt-1 text-foreground/90 [overflow-wrap:anywhere]">{sentence(r.reason)}</p>
                  </li>
                ))}
              </ul>
            )}
          </ReadBlock>
        )}
      </section>

      <section className={cn(box, "space-y-3")} aria-labelledby="rule-title">
        <h2 id="rule-title" className="text-lg font-semibold">
          The rule, in the contract&apos;s words <SectionHelp k="ledger-rule" />
        </h2>
        <ReadBlock state={rule} skeleton={<BlockSkeleton lines={3} />}>
          {(d) => (
            <div className="space-y-3">
              {d.sections.length ? (
                <dl className="grid gap-2">
                  {d.sections.map((x) => (
                    <div key={x.title} className="rounded-lg border bg-background/50 p-3">
                      <dt className="text-xs font-semibold text-muted-foreground">{x.title}</dt>
                      <dd className="mt-0.5 text-sm text-foreground/90 text-pretty [overflow-wrap:anywhere]">{sentence(x.text)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">The contract answered with its caps only.</p>
              )}
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                {(
                  [
                    ["Title", `${d.limits.title[0]} to ${d.limits.title[1]} characters`],
                    ["Tiers per card", `${d.limits.tiers[0]} to ${d.limits.tiers[1]}`],
                    ["One tier", `${d.limits.tierText[0]} to ${d.limits.tierText[1]} characters`],
                    ["A brief", `${d.limits.brief[0]} to ${d.limits.brief[1]} characters`],
                    ["Least bond", gen(d.limits.minBondAtto)],
                    ["One slice", `the bond divided by ${d.limits.bondSlices}`],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-background/50 p-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </ReadBlock>
      </section>
    </div>
  );
}
