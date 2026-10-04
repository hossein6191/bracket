"use client";

// The orders that concern the connected wallet: the briefs it asked as a buyer, and the orders on
// the cards it published. One ledger call brings the newest rows of every order; only an order
// that is not among them is read on its own, so the page stays inside Studio's 30 reads a minute.

import * as React from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";

import { OrderRow } from "@/components/bracket";
import { BlockSkeleton, ReadBlock, readEach } from "@/components/read-state";
import { SectionHelp } from "@/components/section-help";
import { Button } from "@/components/ui/button";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useMe } from "@/components/use-me";
import { useGuideProgress } from "@/components/guide-progress";
import { useRead } from "@/components/use-read";
import { WalletButton } from "@/components/wallet";
import {
  cardPath,
  idNumber,
  invalidateReads,
  isMock,
  readCards,
  readLedger,
  readOrder,
  readOrdersBy,
  readOrdersOf,
  type Card,
  type Order,
  type ReadResult,
} from "@/lib/chain";
import { cn } from "@/lib/utils";

const box = "surface p-5 sm:p-6";
/** The most orders shown per list, and the most read one by one when the ledger page does not carry them. */
const SHOWN = 12;
const ONE_BY_ONE = 6;
const MY_CARDS = 4;

type Mine = { bought: Order[]; boughtCount: number; sold: Order[]; soldCount: number; cards: Card[] };

async function readMine(address: string): Promise<ReadResult<Mine>> {
  const [cards, boughtIds] = await Promise.all([readCards(), readOrdersBy(address)]);
  const known = new Map<string, Order>();
  try {
    for (const o of (await readLedger()).data) known.set(o.id, o);
  } catch {
    /* without the ledger the orders are read one by one below */
  }
  const myCards = cards.data.rows.filter((c) => c.maker === address).slice(0, MY_CARDS);
  const perCard = await readEach(myCards, (c) => readOrdersOf(c.id), 2);
  const soldIds = perCard
    .flatMap((r) => (r.status === "fulfilled" ? r.value.data : []))
    .sort((a, b) => idNumber(b) - idNumber(a));

  const resolve = async (ids: string[]): Promise<Order[]> => {
    const wanted = ids.slice(0, SHOWN);
    const missing = wanted.filter((id) => !known.has(id)).slice(0, ONE_BY_ONE);
    const got = await readEach(missing, (id) => readOrder(id), 3);
    got.forEach((r) => {
      if (r.status === "fulfilled" && r.value.data) known.set(r.value.data.id, r.value.data);
    });
    return wanted.flatMap((id) => (known.has(id) ? [known.get(id)!] : []));
  };

  const bought = await resolve(boughtIds.data);
  const sold = await resolve(soldIds);
  return { data: { bought, boughtCount: boughtIds.data.length, sold, soldCount: soldIds.length, cards: myCards }, source: cards.source };
}

export default function OrdersPage() {
  const me = useMe();
  const mine = useRead(() => readMine(me.address), [me.address], { enabled: !!me.address });
  useGuideProgress("orders", me.address ? 1 : 0);

  return (
    <div className="container-site space-y-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Your orders</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The briefs this wallet asked, and the orders on the cards it published. A booked order is the only kind that still
            needs somebody: the maker to accept or decline, or the buyer to cancel.
          </p>
        </div>
        {me.address ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            onClick={() => {
              invalidateReads();
              mine.retry();
            }}
          >
            <RefreshCw /> Read again
          </Button>
        ) : null}
      </div>

      {!me.address ? (
        <div className={cn(box, "space-y-3 text-sm")}>
          <p className="font-medium">Connect a wallet to list its orders.</p>
          <p className="text-muted-foreground">
            This page lists by address, so it needs to know yours. Nothing is signed by connecting, and it takes a few seconds. The
            ledger shows every order with no wallet at all.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {isMock ? null : <WalletButton />}
            <LiquidButton asChild size="sm" className="text-foreground">
              <Link href="/ledger">
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  Open the ledger <ArrowRight />
                </span>
              </Link>
            </LiquidButton>
          </div>
        </div>
      ) : (
        <ReadBlock
          state={mine}
          skeleton={
            <div className="grid gap-6 lg:grid-cols-2">
              <BlockSkeleton lines={5} />
              <BlockSkeleton lines={5} />
            </div>
          }
        >
          {(d) => (
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <section className={cn(box, "min-w-0 space-y-4")} aria-labelledby="bought-title">
                <h2 id="bought-title" className="text-lg font-semibold">
                  Briefs you asked <SectionHelp k="orders-bought" />
                </h2>
                {d.bought.length === 0 ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      This wallet has not asked any card for a price yet. Pick a card, type what you need, and the answer takes one
                      to two minutes.
                    </p>
                    <LiquidButton asChild size="sm" className="text-foreground">
                      <Link href="/cards">
                        <span className="relative z-10 inline-flex items-center gap-1.5">
                          Open the cards <ArrowRight />
                        </span>
                      </Link>
                    </LiquidButton>
                  </div>
                ) : (
                  <>
                    <ul className="grid gap-2">
                      {d.bought.map((o) => (
                        <OrderRow key={o.id} order={o} role={o.status === "booked" ? "you may cancel" : undefined} />
                      ))}
                    </ul>
                    {d.boughtCount > d.bought.length ? (
                      <p className="text-xs text-muted-foreground">
                        Showing {d.bought.length} of your last {d.boughtCount} orders. The ledger has the rest.
                      </p>
                    ) : null}
                  </>
                )}
              </section>

              <section className={cn(box, "min-w-0 space-y-4")} aria-labelledby="sold-title">
                <h2 id="sold-title" className="text-lg font-semibold">
                  Orders on your cards <SectionHelp k="orders-sold" />
                </h2>
                {d.cards.length === 0 ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      This wallet has no card among the 24 newest. Publish one and the orders strangers book on it will wait for you
                      here.
                    </p>
                    <LiquidButton asChild size="sm" className="text-foreground">
                      <Link href="/publish">
                        <span className="relative z-10 inline-flex items-center gap-1.5">
                          Publish a card <ArrowRight />
                        </span>
                      </Link>
                    </LiquidButton>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Your cards:{" "}
                      {d.cards.map((c, i) => (
                        <React.Fragment key={c.id}>
                          {i > 0 ? ", " : ""}
                          <Link href={cardPath(c.id)} className="font-mono text-brand underline-offset-4 hover:underline">
                            {c.id}
                          </Link>
                        </React.Fragment>
                      ))}
                      .
                    </p>
                    {d.sold.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nobody has asked your cards for a price yet. Nothing is needed from you.</p>
                    ) : (
                      <ul className="grid gap-2">
                        {[...d.sold.filter((o) => o.status === "booked"), ...d.sold.filter((o) => o.status !== "booked")].map((o) => (
                          <OrderRow key={o.id} order={o} role={o.status === "booked" ? "waits for you" : undefined} />
                        ))}
                      </ul>
                    )}
                    {d.soldCount > d.sold.length ? (
                      <p className="text-xs text-muted-foreground">
                        Showing {d.sold.length} of {d.soldCount} orders on your cards. Each card&apos;s page and the ledger have the rest.
                      </p>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          )}
        </ReadBlock>
      )}
    </div>
  );
}
