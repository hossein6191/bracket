"use client";

// Publish a rate card, and look after the ones this wallet published. The form takes a title, two
// to four tiers, whether they are a ladder, and the bond; whole example cards fill it in one
// press. Under it are the maker's own cards: Revise loads one into the form (the revision closes
// the old card and keeps its bond), and Close returns the bond that is left.

import * as React from "react";
import Link from "next/link";
import { ArrowRight, PenLine, Undo2, X } from "lucide-react";

import { StandingBadge } from "@/components/bracket";
import { CardForm } from "@/components/card-form";
import { BlockSkeleton, ReadBlock, ReadError } from "@/components/read-state";
import { SectionHelp } from "@/components/section-help";
import { TxBlock } from "@/components/tx-block";
import { Button } from "@/components/ui/button";
import { RetroButton } from "@/components/ui/button-retro";
import { useMe } from "@/components/use-me";
import { useRead } from "@/components/use-read";
import { succeeded, useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { LIMITS, calls, cardPath, invalidateReads, parseCardId, readCard, readCards, readRule, returnedAtto, type Card } from "@/lib/chain";
import { gen } from "@/lib/format";
import { cn } from "@/lib/utils";

const box = "surface p-5 sm:p-6";

export default function PublishPage({ searchParams }: { searchParams: Promise<{ revise?: string | string[] }> }) {
  const me = useMe();
  // The link from a card's page carries ?revise=C4.
  const { revise } = React.use(searchParams);
  const fromUrl = parseCardId(typeof revise === "string" ? revise : "");
  // null: follow the link; "": a new card was chosen; "C4": that card was chosen from the list.
  const [picked, setPicked] = React.useState<string | null>(null);
  const reviseId = picked ?? fromUrl;
  const target = useRead(() => readCard(reviseId), [reviseId], { enabled: !!reviseId });
  const rule = useRead(() => readRule(), []);
  const cards = useRead(() => readCards(), []);
  const limits = rule.data?.limits ?? LIMITS;
  const topRef = React.useRef<HTMLDivElement | null>(null);

  const t = target.data;
  const mine = !!t && !!me.address && t.maker === me.address;
  const revising = reviseId && t && mine && t.open ? t : null;
  // The card a revision was sent for, as it was when sent. The form keeps it (and so keeps its
  // key, its transaction and its result) after the refresh reads that card back closed, or when
  // the wallet switches mid-call. Choosing another card or a new card lets it go.
  const [held, setHeld] = React.useState<Card | null>(null);
  const formCard = revising ?? (held && held.id === reviseId ? held : null);
  // While the form's call runs, nothing else may swap the form out from under it.
  const [formBusy, setFormBusy] = React.useState(false);

  const refresh = () => {
    invalidateReads();
    void cards.refresh();
    void target.refresh();
  };
  const choose = (id: string) => {
    setPicked(id);
    setHeld(null);
  };
  const pick = (id: string) => {
    choose(id);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div ref={topRef} className="scroll-mt-24 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{formCard ? `Revise ${formCard.id}` : "Publish a card"}</h1>
        <p className="text-muted-foreground">
          Write your price list once. After that every stranger&apos;s brief is priced from your words, without you being there, and
          you only accept or decline the orders that are booked.
        </p>
      </div>

      <section className={cn(box, "space-y-5")} aria-labelledby="form-title">
        <h2 id="form-title" className="text-lg font-semibold">
          {formCard ? "The revised card" : "Your card"} <SectionHelp k="publish-form" />
        </h2>

        {reviseId && target.loading ? (
          <BlockSkeleton lines={5} />
        ) : reviseId && target.error && !t ? (
          // A failed read is not a missing card: no form until it is known which card this is.
          <ReadError compact onRetry={target.retry} detail={target.error} />
        ) : (
          <>
            {revising ? (
              <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-foreground/90">
                  You are revising <span className="font-mono font-semibold">{revising.id}</span>
                  {revising.frozen ? ", which is frozen. Reword the tiers that were caught overlapping." : "."} Publishing closes it and
                  opens a new card with the bond that is left.
                </p>
                <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={formBusy} onClick={() => choose("")}>
                  <X /> Write a new card instead
                </Button>
              </div>
            ) : formCard ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" disabled={formBusy} onClick={() => choose("")}>
                  <X /> Write a new card
                </Button>
              </div>
            ) : reviseId && !target.loading ? (
              <p className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-foreground/90">
                {!t
                  ? `There is no card ${reviseId} to revise, so this is a new card.`
                  : !me.address
                    ? `Connect the wallet that published ${reviseId} to revise it. Until then this form publishes a new card.`
                    : !mine
                      ? `Only the maker of ${reviseId} may revise it, and this wallet is not its maker. This form publishes a new card.`
                      : `${reviseId} is already closed${t.revisedTo ? ` and replaced by ${t.revisedTo}` : ""}, so this form publishes a new card.`}
              </p>
            ) : null}
            <CardForm
              key={formCard ? formCard.id : "new"}
              revising={formCard}
              limits={limits}
              onDone={refresh}
              onSend={() => setHeld(revising)}
              onBusy={setFormBusy}
            />
          </>
        )}
      </section>

      <section className={cn(box, "space-y-4")} aria-labelledby="mine-title">
        <h2 id="mine-title" className="text-lg font-semibold">
          Your cards <SectionHelp k="publish-mine" />
        </h2>
        {!me.address ? (
          <p className="text-sm text-muted-foreground">Connect a wallet to see the cards it published. Reading the cards page needs no wallet.</p>
        ) : (
          <ReadBlock state={cards} skeleton={<BlockSkeleton lines={3} />}>
            {(d) => {
              const own = d.rows.filter((c) => c.maker === me.address);
              // The card named in ?revise= may be older than the 24 newest; it still needs its Close button.
              const extra = t && mine && !own.some((c) => c.id === t.id) ? [t] : [];
              return <MyCards cards={[...extra, ...own]} onRevise={pick} onDone={refresh} formBusy={formBusy} />;
            }}
          </ReadBlock>
        )}
      </section>
    </div>
  );
}

function MyCards({
  cards,
  onRevise,
  onDone,
  formBusy,
}: {
  cards: Card[];
  onRevise: (id: string) => void;
  onDone: () => void;
  /** the form above is sending a call: loading another card into it would drop that call from the screen */
  formBusy: boolean;
}) {
  const me = useMe();
  const tx = useTx(() => onDone());
  const running = tx.sending || (!!tx.hash && !tx.final);
  const closing = tx.call?.fn === "close_card" ? String(tx.call.args[0]) : "";
  const closed = succeeded(tx.final);

  if (cards.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        This wallet has no card among the 24 newest. Publish one with the form above; it appears here a few seconds after the
        transaction is final.
      </p>
    );
  return (
    <div className="space-y-3">
      <ul className="grid gap-3">
        {cards.map((c) => (
          <li key={c.id} className="space-y-3 rounded-xl border bg-background/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={cardPath(c.id)} className="font-mono text-sm font-semibold text-brand underline-offset-4 hover:underline">
                {c.id}
              </Link>
              <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{c.title}</span>
              <StandingBadge card={c} />
            </div>
            <p className="text-xs text-muted-foreground">
              {c.tiers.length} tiers · bond left <span className="font-mono text-foreground">{gen(c.bondAtto)}</span> · {c.orders}{" "}
              {c.orders === 1 ? "order" : "orders"}, {c.exact} priced
              {c.flags.length ? ` · flags ${c.flags.join(", ")}` : ""}
              {c.revisedFrom ? ` · revision of ${c.revisedFrom}` : ""}
            </p>
            <p className="text-sm text-foreground/85">
              {!c.open
                ? c.revisedTo
                  ? c.booked > 0
                    ? `Closed and replaced by ${c.revisedTo}. Next: you. ${c.booked} booked ${c.booked === 1 ? "order still waits" : "orders still wait"} on this card for you to accept or decline, under Orders.`
                    : `Closed and replaced by ${c.revisedTo}. Nothing is left to do on this card.`
                  : "Closed, and its bond was returned. Nothing is left to do on this card."
                : c.frozen
                  ? "Frozen: a brief was covered by two of its tiers. Next: you. Revise it and it prices briefs again."
                  : c.booked > 0
                    ? `Taking briefs. Next: you. ${c.booked} booked ${c.booked === 1 ? "order waits" : "orders wait"} for you to accept or decline, under Orders.`
                    : "Taking briefs. No order is booked, so nothing is needed from you."}
            </p>
            {c.open && c.booked > 0 ? (
              <p className="text-xs text-gold">
                It cannot be closed while {c.booked === 1 ? "an order is" : "orders are"} booked: accept or decline first, so no buyer is left
                waiting on a closed card.
              </p>
            ) : null}
            {c.open ? (
              <WalletGate action="revise or close this card">
                <div className="flex flex-wrap items-center gap-3">
                  <RetroButton type="button" variant={c.frozen ? "cyan" : "gray"} disabled={running || formBusy} onClick={() => onRevise(c.id)}>
                    <PenLine className="mr-1 inline size-3.5 align-[-2px]" /> Revise
                  </RetroButton>
                  <RetroButton
                    type="button"
                    variant="darkGray"
                    disabled={running || !me.ready || c.booked > 0}
                    onClick={() => void tx.start(calls.closeCard(c.id))}
                  >
                    <Undo2 className="mr-1 inline size-3.5 align-[-2px]" /> {running && closing === c.id ? "Closing" : `Close and take ${gen(c.bondAtto)} back`}
                  </RetroButton>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={cardPath(c.id)}>
                      Open <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </WalletGate>
            ) : c.revisedTo ? (
              <Button asChild variant="outline" size="sm">
                <Link href={cardPath(c.revisedTo)}>
                  Open {c.revisedTo} <ArrowRight />
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <TxBlock tx={tx} label={closing ? `Closing ${closing}` : "Closing the card"} />
      {closed ? (
        <p className="rounded-lg border border-keeps/40 bg-keeps/10 p-3 text-sm" role="status">
          {closing} is closed. {returnedAtto(tx.final) !== "0" ? `${gen(returnedAtto(tx.final))} of bond` : "The bond that was left"} is on its way
          back and lands a few seconds after the transaction is final. Nothing is left to do on that card.
        </p>
      ) : null}
    </div>
  );
}
