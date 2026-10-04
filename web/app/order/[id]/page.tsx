"use client";

// One order. The brief exactly as it was sent, the tier marks the validators agreed on, where the
// money went, the sentence the contract wrote, and the move that is open to whoever is looking:
// the buyer may cancel a booked order, and the card's maker may accept or decline it.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Undo2, X } from "lucide-react";

import { Address } from "@/components/address";
import { ContractLine, MoneyRow, OutcomeBadge, StatusBadge, TierList } from "@/components/bracket";
import { BlockSkeleton, ReadBlock } from "@/components/read-state";
import { SectionHelp } from "@/components/section-help";
import { TxBlock } from "@/components/tx-block";
import { RetroButton } from "@/components/ui/button-retro";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useMe } from "@/components/use-me";
import { useRead } from "@/components/use-read";
import { succeeded, useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { calls, cardPath, invalidateReads, parseOrderId, readCard, readOrder, type Call, type Card, type Order } from "@/lib/chain";
import { gen, when } from "@/lib/format";
import { nextMove, outcomeMeaning, viewerOf } from "@/lib/words";
import { cn } from "@/lib/utils";

const box = "surface p-5 sm:p-6";
/** An icon inside a keypad button's label. */
const icon = "mr-1 inline size-3.5 align-[-2px]";

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const orderId = parseOrderId(id);
  if (!orderId)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Order</h1>
        <div className={cn(box, "space-y-3 text-sm")}>
          <p className="font-medium">That is not an order id.</p>
          <p className="text-muted-foreground">An order is named by an O and its number, like O7. The ledger lists every one.</p>
          <LiquidButton asChild size="sm" className="text-foreground">
            <Link href="/ledger">
              <span className="relative z-10 inline-flex items-center gap-1.5">
                Open the ledger <ArrowRight />
              </span>
            </Link>
          </LiquidButton>
        </div>
      </div>
    );
  return <OrderView id={orderId} />;
}

function OrderView({ id }: { id: string }) {
  const order = useRead(() => readOrder(id), [id]);
  const o = order.data;
  const card = useRead(() => readCard(o?.card ?? ""), [o?.card ?? ""], { enabled: !!o?.card });

  const refresh = () => {
    invalidateReads();
    void order.refresh();
    void card.refresh();
  };

  return (
    <div className="container-site space-y-6 py-8">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ArrowLeft className="size-3.5" /> Your orders
      </Link>
      <ReadBlock
        state={order}
        skeleton={<BlockSkeleton lines={8} />}
        empty={
          <div className={cn(box, "space-y-3 text-sm")}>
            <p className="font-medium">There is no order {id} on this contract.</p>
            <p className="text-muted-foreground">Orders are numbered in the order they were asked. The ledger lists the ones that exist.</p>
            <LiquidButton asChild size="sm" className="text-foreground">
              <Link href="/ledger">
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  Open the ledger <ArrowRight />
                </span>
              </Link>
            </LiquidButton>
          </div>
        }
      >
        {(d) => <OrderBody order={d} card={card.data} cardLoading={card.loading} onDone={refresh} />}
      </ReadBlock>
    </div>
  );
}

function OrderBody({ order: o, card: c, cardLoading, onDone }: { order: Order; card: Card | null; cardLoading: boolean; onDone: () => void }) {
  const me = useMe();
  const viewer = viewerOf(o, me.address);
  return (
    <div className="space-y-6">
      <header className={cn(box, "space-y-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">{o.id}</h1>
          <OutcomeBadge outcome={o.outcome} />
          <StatusBadge status={o.status} />
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Asked on</dt>
            <dd>
              <Link href={cardPath(o.card)} className="font-mono text-brand underline-offset-4 hover:underline">
                {o.card}
              </Link>
              {c ? <span className="text-muted-foreground"> · {c.title}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Buyer{viewer === "buyer" ? " (you)" : ""}</dt>
            <dd>
              <Address value={o.buyer} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Maker{viewer === "maker" ? " (you)" : ""}</dt>
            <dd>
              <Address value={o.maker} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Asked</dt>
            <dd>{when(o.at) || "not recorded"}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
        <section className={cn(box, "min-w-0 space-y-3")} aria-labelledby="brief-title">
          <h2 id="brief-title" className="text-lg font-semibold">
            The brief <SectionHelp k="order-brief" />
          </h2>
          <p className="doc-text rounded-xl border bg-background/50 p-3 text-foreground/90">{o.brief || "The brief is not in this row."}</p>
          {o.briefDigest ? (
            <p className="text-xs text-muted-foreground">
              Fingerprint <span className="break-hash font-mono">{o.briefDigest}</span>
            </p>
          ) : null}
        </section>

        <section className={cn(box, "min-w-0 space-y-3")} aria-labelledby="result-title">
          <h2 id="result-title" className="text-lg font-semibold">
            The result <SectionHelp k="order-result" />
          </h2>
          <p className="text-sm text-foreground/90">
            {o.outcome === "exact" ? `Tier ${o.tier} sets the price: ${gen(o.priceAtto)}. ` : ""}
            {outcomeMeaning(o.outcome).replace(/\byou sent\b/g, "the buyer sent").replace(/\bpaid you\b/g, "paid the buyer")}
          </p>
          {o.mask === "?" ? (
            <p className="text-xs text-muted-foreground">Stored value: a question mark. The two askings did not name the same tiers.</p>
          ) : c ? (
            <TierList tiers={c.tiers} chosen={o.tier} mask={o.mask} />
          ) : cardLoading ? (
            <BlockSkeleton lines={3} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Stored value <span className="font-mono text-foreground">{o.mask || "none"}</span>: one mark per tier of the card, 1 where the tier
              covers the whole brief.
            </p>
          )}
          <ContractLine line={o.line} />
        </section>
      </div>

      <section className={cn(box, "space-y-3")} aria-labelledby="money-title">
        <h2 id="money-title" className="text-lg font-semibold">
          The money <SectionHelp k="order-money" />
        </h2>
        <MoneyRow order={o} />
      </section>

      <NextMove order={o} viewer={viewer} onDone={onDone} />
    </div>
  );
}

function NextMove({ order: o, viewer, onDone }: { order: Order; viewer: ReturnType<typeof viewerOf>; onDone: () => void }) {
  const me = useMe();
  const tx = useTx(() => onDone());
  const running = tx.sending || (!!tx.hash && !tx.final);
  const done = succeeded(tx.final);
  const label = tx.call?.fn === "accept" ? "Accepting" : tx.call?.fn === "decline" ? "Declining" : "Cancelling";
  const send = (call: Call) => void tx.start(call);

  return (
    <section className={cn(box, "space-y-3")} aria-labelledby="next-title">
      <h2 id="next-title" className="text-lg font-semibold">
        What can be done now <SectionHelp k="order-next" />
      </h2>
      <p className="text-sm text-foreground/90">{nextMove(o, viewer)}</p>

      {o.status === "booked" ? (
        viewer === "buyer" ? (
          <WalletGate action="cancel this order">
            <RetroButton type="button" variant="darkGray" disabled={running || !me.ready} onClick={() => send(calls.cancel(o.id))}>
              <Undo2 className={icon} /> {running ? "Cancelling" : `Cancel and take ${gen(o.priceAtto)} back`}
            </RetroButton>
          </WalletGate>
        ) : viewer === "maker" ? (
          <WalletGate action="accept or decline this order">
            <div className="flex flex-wrap gap-3">
              <RetroButton type="button" variant="cyan" disabled={running || !me.ready} onClick={() => send(calls.accept(o.id))}>
                <Check className={icon} /> {running && tx.call?.fn === "accept" ? "Accepting" : `Accept and be paid ${gen(o.priceAtto)}`}
              </RetroButton>
              <RetroButton type="button" variant="white" disabled={running || !me.ready} onClick={() => send(calls.decline(o.id))}>
                <X className={icon} /> {running && tx.call?.fn === "decline" ? "Declining" : "Decline and refund the buyer"}
              </RetroButton>
            </div>
          </WalletGate>
        ) : (
          <p className="text-sm text-muted-foreground">
            {viewer === "nobody"
              ? "Connect the buyer's wallet to cancel, or the maker's to accept or decline. Reading needs no wallet."
              : "This wallet is neither the buyer nor the maker of this order, so it has no move here."}
          </p>
        )
      ) : null}

      <TxBlock tx={tx} label={`${label} ${o.id}`} />
      {done ? (
        <p className="rounded-lg border border-keeps/40 bg-keeps/10 p-3 text-sm text-foreground" role="status">
          Done. The order is settled and the money lands a few seconds after the transaction is final. Nobody has anything left to
          do on this order.
        </p>
      ) : null}
    </section>
  );
}
