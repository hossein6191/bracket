"use client";

// One rate card. The tiers exactly as the maker published them, the box where a visitor types a
// brief, a plain statement of what each outcome does to their money before they sign, the one
// button that asks for a binding price, and then the result: the tier, the price kept in escrow,
// what came back, and the sentence the contract wrote.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, PenLine, Snowflake } from "lucide-react";

import { Address } from "@/components/address";
import { ContractLine, FlagLine, LadderBadge, MoneyRow, OrderRow, OutcomeBadge, StandingBadge, TierList } from "@/components/bracket";
import { BlockSkeleton, ReadBlock, readEach } from "@/components/read-state";
import { SectionHelp } from "@/components/section-help";
import { Suggest } from "@/components/suggest";
import { MakerNextSteps } from "@/components/next-steps";
import { TxBlock } from "@/components/tx-block";
import { Button } from "@/components/ui/button";
import { EncryptButton } from "@/components/ui/encrypt-button";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/components/use-me";
import { useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import {
  LIMITS,
  calls,
  cardPath,
  invalidateReads,
  isMock,
  textProblem,
  tidy,
  orderPath,
  txUrl,
  parseCardId,
  quoteOutcome,
  readCard,
  readOrder,
  readOrdersOf,
  type Card,
  type Order,
  type QuoteOutcome,
  type ReadResult,
} from "@/lib/chain";
import { briefsFor } from "@/lib/examples";
import { rememberQuoteTx } from "@/lib/tx-memory";
import { gen, orderName, when } from "@/lib/format";
import { outcomeMeaning, sentence } from "@/lib/words";
import { cn } from "@/lib/utils";

const box = "surface p-5 sm:p-6";
/** One view call per order, so only the newest few are read. */
const LATEST = 5;

async function readLatestOrders(card: string): Promise<ReadResult<Order[]>> {
  const ids = await readOrdersOf(card);
  const got = await readEach(ids.data.slice(0, LATEST), (id) => readOrder(id), 3);
  const rows = got.flatMap((r) => (r.status === "fulfilled" && r.value.data ? [r.value.data] : []));
  return { data: rows, source: ids.source };
}

export default function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const cardId = parseCardId(id);
  if (!cardId)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Card</h1>
        <div className={cn(box, "space-y-3 text-sm")}>
          <p className="font-medium">That is not a card id.</p>
          <p className="text-muted-foreground">A card is named by a C and its number, like C3. The cards page lists every one.</p>
          <LiquidButton asChild size="sm" className="text-foreground">
            <Link href="/cards">
              <span className="relative z-10 inline-flex items-center gap-1.5">
                Open the cards <ArrowRight />
              </span>
            </Link>
          </LiquidButton>
        </div>
      </div>
    );
  return <CardView id={cardId} />;
}

function CardView({ id }: { id: string }) {
  const card = useRead(() => readCard(id), [id]);
  const c = card.data;
  const orders = useRead(() => readLatestOrders(id), [id], { enabled: !!c && c.orders > 0 });

  const refresh = () => {
    invalidateReads();
    void card.refresh();
    void orders.refresh();
  };

  return (
    <div className="container-site space-y-6 py-8">
      <Link href="/cards" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ArrowLeft className="size-3.5" /> All cards
      </Link>
      <ReadBlock
        state={card}
        skeleton={<BlockSkeleton lines={8} />}
        empty={
          <div className={cn(box, "space-y-3 text-sm")}>
            <p className="font-medium">There is no card {id} on this contract.</p>
            <p className="text-muted-foreground">Cards are numbered in the order they were published. The cards page lists the ones that exist.</p>
            <LiquidButton asChild size="sm" className="text-foreground">
              <Link href="/cards">
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  Open the cards <ArrowRight />
                </span>
              </Link>
            </LiquidButton>
          </div>
        }
      >
        {(d) => (
          <div className="space-y-6">
            <CardHead card={d} />
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
              <section className={cn(box, "min-w-0 space-y-4")} aria-labelledby="tiers-title">
                <h2 id="tiers-title" className="text-lg font-semibold">
                  The tiers <SectionHelp k="card-tiers" />
                </h2>
                <TierList tiers={d.tiers} flags={d.flags} />
                <LadderBadge ladder={d.ladder} />
                <FlagLine flags={d.flags} />
              </section>
              <QuoteBox key={d.id} card={d} onDone={refresh} />
            </div>
            <section className={cn(box, "space-y-4")} aria-labelledby="latest-title">
              <h2 id="latest-title" className="text-lg font-semibold">
                This card&apos;s latest orders <SectionHelp k="card-orders" />
              </h2>
              <dl className="cells grid-cols-2 text-xs sm:grid-cols-5">
                {(
                  [
                    ["Orders", d.orders],
                    ["Priced", d.exact],
                    ["Outside", d.outside],
                    ["Covered twice", d.ambiguous],
                    ["No price fixed", d.unclear],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <div key={label} className="p-3 last:col-span-2 sm:last:col-span-1">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {d.orders === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody has asked this card for a price yet. The first brief can be yours.</p>
              ) : (
                <ReadBlock state={orders} skeleton={<BlockSkeleton lines={3} />} emptyWhen={(rows) => rows.length === 0} empty={<p className="text-sm text-muted-foreground">The orders could not be listed just now. The ledger has every order.</p>}>
                  {(rows) => (
                    <ul className="grid gap-2">
                      {rows.map((o) => (
                        <OrderRow key={o.id} order={o} showCard={false} />
                      ))}
                    </ul>
                  )}
                </ReadBlock>
              )}
            </section>
          </div>
        )}
      </ReadBlock>
    </div>
  );
}

function CardHead({ card: c }: { card: Card }) {
  return (
    <header className={cn(box, "space-y-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{c.id}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl [overflow-wrap:anywhere]">{c.title}</h1>
        </div>
        <StandingBadge card={c} />
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Maker</dt>
          <dd>
            <Address value={c.maker} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">A buyer sends</dt>
          <dd className="font-mono">{gen(c.topPriceAtto)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Bond left, and the slice one overlap pays</dt>
          <dd className="font-mono">
            {gen(c.bondAtto)} · {gen(c.bondSliceAtto)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Published</dt>
          <dd>{when(c.createdAt) || "not recorded"}</dd>
        </div>
      </dl>
    </header>
  );
}

/** What the card cannot do right now, and who acts next; null when it is taking briefs from this visitor. */
function Blocked({ card: c, isMaker }: { card: Card; isMaker: boolean }) {
  if (!c.open)
    return (
      <div className="space-y-3 rounded-xl border bg-background/50 p-4 text-sm">
        <p className="font-medium">This card is closed and prices nothing more.</p>
        {c.revisedTo ? (
          <>
            <p className="text-muted-foreground">
              Its maker replaced it with {c.revisedTo}, which carries the bond that was left. This card stays readable, with its
              flags, as the history of that one.
            </p>
            <Button asChild variant="cool" size="sm">
              <Link href={cardPath(c.revisedTo)}>
                Open {c.revisedTo} <ArrowRight />
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">Its maker closed it and took the remaining bond back. Nobody has anything left to do here.</p>
        )}
      </div>
    );
  if (c.frozen)
    return (
      <div className="space-y-3 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Snowflake className="size-4 text-gold" /> This card is frozen.
        </p>
        <p className="text-foreground/85">
          An earlier brief was covered by two of its tiers. That buyer was refunded and paid from the bond, and the card prices
          nothing until its maker publishes a revised one. A quote sent now would be refused and returned.
        </p>
        {isMaker ? (
          <>
            <p className="text-foreground/85">Next: you. Revising takes one signature and under a minute, and the new card keeps the bond that is left.</p>
            <Button asChild variant="cool" size="sm">
              <Link href={`/publish?revise=${c.id}`}>
                <PenLine /> Revise this card
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">Next: the maker. There is nothing for a buyer to do here until then; another card may fit your brief.</p>
        )}
      </div>
    );
  if (isMaker)
    return (
      <div className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm">
        <p className="font-medium">
          You published this card. <SectionHelp k="card-maker" />
        </p>
        <p className="text-muted-foreground">
          A maker may not ask their own card for a price: a card is tried by other people&apos;s briefs.{" "}
          {c.booked > 0
            ? `Next: you. ${c.booked} booked ${c.booked === 1 ? "order waits" : "orders wait"} on this card for you to accept or decline.`
            : "No order is booked on it now, so nothing is needed from you."}{" "}
          The Publish page revises or closes it.
        </p>
        <MakerNextSteps card={c.id} />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/orders">Orders on your cards</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/publish?revise=${c.id}`}>
              <PenLine /> Revise or close
            </Link>
          </Button>
        </div>
      </div>
    );
  return null;
}

function QuoteBox({ card: c, onDone }: { card: Card; onDone: () => void }) {
  const me = useMe();
  const [brief, setBrief] = React.useState("");
  const tx = useTx((status, hash) => {
    const made = quoteOutcome(status);
    if (made && made.kind === "result" && made.order.id) rememberQuoteTx(made.order.id, hash);
    onDone();
  });
  const isMaker = !!me.address && me.address === c.maker;
  const top = BigInt(c.topPriceAtto);
  const problem = brief.trim() ? textProblem(brief, LIMITS.brief, "A brief") : "";
  const short = !!me.address && me.balanceAtto < top;
  const running = tx.sending || (!!tx.hash && !tx.final);
  const outcome = tx.final ? quoteOutcome(tx.final) : null;
  const suggestions = React.useMemo(() => briefsFor(c.tiers.map((t) => t.text)), [c.tiers]);
  const blocked = !c.open || c.frozen || isMaker;

  return (
    <section className={cn(box, "min-w-0 space-y-4")} aria-labelledby="brief-title">
      <h2 id="brief-title" className="text-lg font-semibold">
        Ask this card for a price <SectionHelp k="card-brief" />
      </h2>
      {blocked ? (
        <Blocked card={c} isMaker={isMaker} />
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="brief" className="text-sm font-medium">
              Your brief: what you need, in your own words
            </label>
            <Textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              disabled={running}
              rows={5}
              placeholder="Say how much, how long and by when. For example: a 1,500-word contract, English to Spanish, by tomorrow evening."
              aria-invalid={!!problem}
              aria-describedby="brief-count"
            />
            <div id="brief-count" className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span className={problem ? "text-gold" : ""}>
                {problem || `${LIMITS.brief[0]} to ${LIMITS.brief[1]} plain keyboard characters. The brief is judged whole.`}
              </span>
              <span className="font-mono">
                {tidy(brief).length} / {LIMITS.brief[1]}
              </span>
            </div>
            <Suggest label="Briefs written for this card" options={suggestions} onPick={setBrief} disabled={running} />
          </div>

          <div className="space-y-2 rounded-xl border bg-background/50 p-4 text-sm">
            <p className="font-medium">
              What happens to your money <SectionHelp k="card-money" />
            </p>
            <p className="text-foreground/85">
              You send <span className="font-mono font-semibold">{gen(c.topPriceAtto)}</span>, the price of the dearest tier. One
              transaction then decides where it goes:
            </p>
            <ul className="space-y-1.5 text-foreground/85">
              {c.tiers.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-keeps">tier {i + 1}</span>
                  <span>
                    {c.ladder ? "is the narrowest that covers it" : "alone covers it"}: {gen(t.priceAtto)} stays in escrow for the maker,{" "}
                    {gen(top - BigInt(t.priceAtto))} comes back.
                  </span>
                </li>
              ))}
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">none</span>
                <span>No tier covers it: all {gen(c.topPriceAtto)} comes back.</span>
              </li>
              {c.ladder ? null : (
                <li className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-gold">two</span>
                  <span>
                    Two tiers cover it: all {gen(c.topPriceAtto)} comes back, plus {gen(c.bondSliceAtto)} from the maker&apos;s bond, and
                    the card freezes.
                  </span>
                </li>
              )}
              <li className="flex gap-2">
                <span className="shrink-0 font-mono text-xs text-gold">unsettled</span>
                <span>The validators cannot settle it: all {gen(c.topPriceAtto)} comes back, and this brief is closed on this card.</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              One signature, then one to two minutes while the validators read. Money that comes back lands a few seconds after the
              transaction is final.
            </p>
          </div>

          <WalletGate action="get a binding price">
            <div className="space-y-3">
              <EncryptButton
                className="max-w-full"
                disabled={running || !brief.trim() || !!problem || !me.ready || short}
                onClick={() => void tx.start(calls.quote(c.id, brief, top))}
                label={tx.sending ? "Waiting for your wallet" : running ? "The validators are reading" : `Get a binding price · send ${gen(c.topPriceAtto)}`}
              />
              {short ? (
                <p className="text-xs text-gold">
                  This wallet holds {gen(me.balanceAtto)} and the quote sends {gen(c.topPriceAtto)}.{" "}
                  {isMock ? "Press Get 10 test GEN in the demo bar at the top." : "The wallet menu at the top right has a button that gets 10 test GEN."}
                </p>
              ) : null}
            </div>
          </WalletGate>
        </>
      )}
      {tx.hash ? (
        <a
          href={txUrl(tx.hash)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/20"
        >
          <span>{running ? "Your quote is with the validators. Watch them vote on the explorer" : "Your quote on the explorer"}</span>
          <span className="font-mono text-xs">
            {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)} ↗
          </span>
        </a>
      ) : null}
      <TxBlock tx={tx} label={`Asking ${c.id} for a price`} votes />
      {outcome ? (
        <QuoteResult
          outcome={outcome}
          card={c}
          sent={c.topPriceAtto}
          // A refusal leaves the brief in the box, to send again or to change; a result clears it.
          onAgain={() => {
            tx.reset();
            if (outcome.kind === "result") setBrief("");
          }}
        />
      ) : null}
    </section>
  );
}

function QuoteResult({ outcome, card: c, sent, onAgain }: { outcome: QuoteOutcome; card: Card; sent: string; onAgain: () => void }) {
  if (outcome.kind === "unknown") return null;
  if (outcome.kind === "refused")
    return (
      <div className="space-y-2 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm" role="status">
        <p className="font-medium">The contract refused this quote, and no model was asked.</p>
        <p className="text-foreground/90">{sentence(outcome.reason) || "It gave no reason."}</p>
        <p className="text-muted-foreground">
          What you sent{outcome.returnedAtto !== "0" ? `, ${gen(outcome.returnedAtto)},` : ""} came back in the same transaction and lands in a
          few seconds. Nothing was stored against this brief. Next: you, if you want to change it or send it again.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onAgain}>
          Back to the brief
        </Button>
      </div>
    );
  const o: Order = { ...outcome.order, paidAtto: outcome.order.paidAtto !== "0" ? outcome.order.paidAtto : sent };
  const next =
    o.outcome === "exact"
      ? `Next: the maker accepts or declines. Until then ${gen(o.priceAtto)} waits in escrow and you may cancel from the order's page.`
      : o.outcome === "ambiguous"
        ? "Next: the maker, who must publish a revised card. You have nothing left to do: the refund and the bond payment land in a few seconds."
        : o.outcome === "outside"
          ? "Nothing more happens to this order. You may ask another card, or ask this one for something its tiers do cover."
          : "Nothing more happens to this order. You may ask again in different words; these exact words are closed on this card.";
  return (
    <div className="space-y-4 rounded-xl border border-brand/30 bg-background/60 p-4" role="status">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">
          The result <SectionHelp k="card-result" />
        </h3>
        <OutcomeBadge outcome={o.outcome} />
        {o.id ? <span className="text-xs text-muted-foreground">{orderName(o.id)}</span> : null}
      </div>
      <p className="text-sm text-foreground/90">
        {o.outcome === "exact" ? `Tier ${o.tier} covers your brief: the price is ${gen(o.priceAtto)}. ` : ""}
        {outcomeMeaning(o.outcome)}
      </p>
      {o.mask === "?" ? (
        <p className="text-xs text-muted-foreground">Stored value: a question mark. The two askings did not name the same tiers.</p>
      ) : (
        <TierList tiers={c.tiers} chosen={o.tier} mask={o.mask} />
      )}
      <MoneyRow order={o} />
      <ContractLine line={o.line} />
      <p className="text-sm text-muted-foreground">{next}</p>
      <div className="flex flex-wrap gap-2">
        {o.id ? (
          <Button asChild variant="cool" size="sm">
            <Link href={orderPath(o.id)}>
              Open {orderName(o.id)} <ArrowRight />
            </Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onAgain}>
          Write another brief
        </Button>
      </div>
    </div>
  );
}
