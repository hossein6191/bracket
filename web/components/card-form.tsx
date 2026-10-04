"use client";

// The form that becomes a rate card: a title, two to four tiers each with a price, whether the
// tiers are a ladder, and the ambiguity bond. It publishes a new card, or, when `revising` is
// given, publishes the revision of that card (which keeps the bond that is left). Whole example
// cards fill it in one press, and everything stays editable afterwards.

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { SectionHelp } from "@/components/section-help";
import { Suggest } from "@/components/suggest";
import { MakerNextSteps } from "@/components/next-steps";
import { TxBlock } from "@/components/tx-block";
import { Button } from "@/components/ui/button";
import { PearlButton } from "@/components/ui/pearl-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/components/use-me";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock, publishedCard, revisedCard, textProblem, tidy, type Card, type Limits, type TierInput } from "@/lib/chain";
import { EXAMPLE_CARDS, type ExampleCard } from "@/lib/examples";
import { gen, genText, toAtto } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = { text: string; price: string };
type Draft = { title: string; tiers: Row[]; ladder: boolean; bond: string };

const BLANK: Draft = { title: "", tiers: [{ text: "", price: "" }, { text: "", price: "" }], ladder: false, bond: "1" };

const fromExample = (e: ExampleCard): Draft => ({ title: e.title, tiers: e.tiers.map((t) => ({ ...t })), ladder: e.ladder, bond: e.bond });
const fromCard = (c: Card): Draft => ({
  title: c.title,
  tiers: c.tiers.map((t) => ({ text: t.text, price: genText(t.priceAtto) })),
  ladder: c.ladder,
  bond: genText(c.bondAtto),
});

/** A price or a bond typed in GEN, as atto; null when it is not an amount. */
function amount(text: string): bigint | null {
  try {
    return toAtto(text);
  } catch {
    return null;
  }
}

/** Two texts the contract would count as the same words: lowercased, single spaces. */
const same = (a: string, b: string) => tidy(a).toLowerCase() === tidy(b).toLowerCase();

const field = "space-y-1.5";
const hint = "text-xs text-muted-foreground";

export function CardForm({ revising, limits, onDone }: { revising: Card | null; limits: Limits; onDone: () => void }) {
  const me = useMe();
  const [draft, setDraft] = React.useState<Draft>(() => (revising ? fromCard(revising) : BLANK));
  const [note, setNote] = React.useState("");
  const tx = useTx(() => onDone());
  const running = tx.sending || (!!tx.hash && !tx.final);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setTier = (i: number, patch: Partial<Row>) => setDraft((d) => ({ ...d, tiers: d.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) }));

  // ---- what stops the card from being sent, as sentences ----
  const minBond = BigInt(limits.minBondAtto);
  const bond = amount(draft.bond);
  const problems: string[] = [];
  const titleProblem = textProblem(draft.title, limits.title, "The title");
  if (titleProblem) problems.push(titleProblem);
  const tierProblems = draft.tiers.map((t, i) => {
    const text = textProblem(t.text, limits.tierText, `Tier ${i + 1}`);
    if (text) return text;
    const p = amount(t.price);
    if (p === null || p < 1n) return `Tier ${i + 1} needs a price in GEN greater than zero, like 0.5 or 3.`;
    const twin = draft.tiers.findIndex((x, k) => k < i && same(x.text, t.text));
    if (twin >= 0) return `Tier ${i + 1} says the same words as tier ${twin + 1}.`;
    const before = i > 0 ? amount(draft.tiers[i - 1].price) : null;
    if (draft.ladder && before !== null && p <= before)
      return `On a ladder each tier costs more than the one before it, because a brief is booked at the narrowest tier that covers it. Tier ${i + 1} does not cost more than tier ${i}.`;
    return "";
  });
  problems.push(...tierProblems.filter(Boolean));
  if (!revising && (bond === null || bond < minBond)) problems.push(`The bond is at least ${gen(limits.minBondAtto)}.`);
  // A revision must change what the card promises: the ladder flag, a tier's words or a tier's price.
  const unchanged =
    !!revising &&
    revising.ladder === draft.ladder &&
    revising.tiers.length === draft.tiers.length &&
    revising.tiers.every((t, i) => same(t.text, draft.tiers[i].text) && amount(draft.tiers[i].price)?.toString() === t.priceAtto);
  if (unchanged && revising) problems.push(`A revision changes the tiers; these are the tiers ${revising.id} already has, word for word and price for price.`);
  const spentBond = !!revising && (BigInt(revising.bondAtto) < BigInt(revising.bondSliceAtto) || BigInt(revising.bondAtto) < 1n);
  if (spentBond && revising)
    problems.push(`The bond left on ${revising.id} is less than one slice, so it cannot be carried to a revision. Close ${revising.id} and publish a new card with a fresh bond.`);
  const short = !revising && bond !== null && !!me.address && me.balanceAtto < bond;

  const tiers: TierInput[] = draft.tiers.map((t) => ({ text: t.text, priceAtto: amount(t.price) ?? 0n }));
  const top = tiers.reduce((m, t) => (t.priceAtto > m ? t.priceAtto : m), 0n);

  const send = () => {
    setNote("");
    void tx.start(revising ? calls.reviseCard(revising.id, draft.title, tiers, draft.ladder) : calls.publishCard(draft.title, tiers, draft.ladder, bond ?? 0n));
  };

  const made = revising ? revisedCard(tx.final) : (publishedCard(tx.final)?.card ?? "");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Suggest
          label="Start from a whole card"
          options={EXAMPLE_CARDS.map((e) => ({ label: e.who, value: e }))}
          disabled={running}
          onPick={(e) => {
            setDraft((d) => ({ ...fromExample(e), bond: revising ? d.bond : e.bond }));
            setNote(e.note);
          }}
        />
        {note ? <p className={hint}>{note}</p> : null}
      </div>

      <div className={field}>
        <label htmlFor="card-title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="card-title"
          value={draft.title}
          disabled={running}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="What you do, in a few words"
        />
        <p className={hint}>
          {limits.title[0]} to {limits.title[1]} plain keyboard characters. Titles, tiers and briefs are kept as unaccented Latin letters,
          digits and common punctuation.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          Tiers <SectionHelp k="publish-tiers" />
        </p>
        {draft.tiers.map((t, i) => (
          <div key={i} className="space-y-2 rounded-xl border bg-background/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="flex size-6 items-center justify-center rounded-md border border-brand/35 bg-brand/[0.08] font-mono text-[11px] text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                Tier {i + 1}
              </span>
              {draft.tiers.length > limits.tiers[0] ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={running}
                  onClick={() => setDraft((d) => ({ ...d, tiers: d.tiers.filter((_, k) => k !== i) }))}
                  aria-label={`Remove tier ${i + 1}`}
                >
                  <Trash2 /> Remove
                </Button>
              ) : null}
            </div>
            <Textarea
              value={t.text}
              rows={2}
              disabled={running}
              onChange={(e) => setTier(i, { text: e.target.value })}
              placeholder="What this tier includes: how much, how long, by when"
              aria-label={`What tier ${i + 1} includes`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={`tier-price-${i}`} className="text-xs text-muted-foreground">
                Price in GEN
              </label>
              <Input
                id={`tier-price-${i}`}
                value={t.price}
                inputMode="decimal"
                disabled={running}
                onChange={(e) => setTier(i, { price: e.target.value })}
                placeholder="0.5"
                className="w-28 font-mono"
              />
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {tidy(t.text).length} / {limits.tierText[1]}
              </span>
            </div>
            {tierProblems[i] && (t.text || t.price) ? <p className="text-xs text-gold">{tierProblems[i]}</p> : null}
          </div>
        ))}
        {draft.tiers.length < limits.tiers[1] ? (
          <Button type="button" variant="outline" size="sm" disabled={running} onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, { text: "", price: "" }] }))}>
            <Plus /> Add a tier
          </Button>
        ) : (
          <p className={hint}>A card has at most {limits.tiers[1]} tiers.</p>
        )}
      </div>

      <fieldset className="space-y-2" disabled={running}>
        <legend className="text-sm font-medium">How the tiers relate</legend>
        {(
          [
            [false, "They are meant not to overlap", "Exactly one tier must cover a brief. If two do, the buyer is refunded and paid a slice of your bond, and the card freezes."],
            [true, "They are a ladder, narrowest first", "Each tier contains the one before it and costs more. A brief is priced at the narrowest tier that covers it."],
          ] as [boolean, string, string][]
        ).map(([value, title, body]) => (
          <label
            key={title}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors",
              draft.ladder === value ? "border-brand/50 bg-brand/10" : "bg-background/50 hover:border-white/20",
            )}
          >
            <input type="radio" name="ladder" className="mt-1 accent-(--brand)" checked={draft.ladder === value} onChange={() => set({ ladder: value })} />
            <span className="min-w-0">
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground text-pretty">{body}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {revising ? (
        <p className="rounded-xl border bg-background/50 p-3 text-sm text-foreground/85">
          The revision carries the bond that is left on {revising.id}: <span className="font-mono font-semibold">{gen(revising.bondAtto)}</span>.
          Nothing is sent with this call.
        </p>
      ) : (
        <div className={field}>
          <label htmlFor="card-bond" className="text-sm font-medium">
            Ambiguity bond, in GEN <SectionHelp k="publish-bond" />
          </label>
          <Input
            id="card-bond"
            value={draft.bond}
            inputMode="decimal"
            disabled={running}
            onChange={(e) => set({ bond: e.target.value })}
            className="w-32 font-mono"
          />
          <p className={hint}>
            At least {gen(limits.minBondAtto)}. It is sent with the card and comes back when you close it, less a slice for each
            brief your card covered twice. One slice is the bond divided by {limits.bondSlices}
            {bond !== null && bond >= minBond ? `: with this bond, ${gen(bond / BigInt(limits.bondSlices))} to each such buyer.` : "."} A ladder
            never pays the bond for overlap, because overlap is what it declares.
          </p>
        </div>
      )}

      <div className="space-y-2 rounded-xl border bg-background/50 p-4 text-sm">
        <p className="font-medium">What this does</p>
        <ul className="list-disc space-y-1 pl-5 text-foreground/85">
          {revising ? (
            <>
              <li>{revising.id} is closed and points to the new card. Its flags stay in its history for ever.</li>
              <li>The new card takes the next number and can be asked for a price at once.</li>
            </>
          ) : (
            <>
              <li>You send {bond !== null ? gen(bond) : "the bond"} now. If the contract refuses the card, it comes back in the same transaction.</li>
              <li>The card takes the next number and can be asked for a price at once, by anybody but you.</li>
            </>
          )}
          <li>A buyer will send {top > 0n ? gen(top) : "the price of your dearest tier"} with each brief and get back whatever the covering tier does not cost.</li>
          <li>One signature, and under a minute. No model is asked to publish a card.</li>
        </ul>
      </div>

      <WalletGate action={revising ? "publish the revision" : "publish a card"}>
        <div className="space-y-2">
          <PearlButton
            type="button"
            compact
            className="max-w-full"
            disabled={running || problems.length > 0 || !me.ready || short || !!made}
            onClick={send}
            label={
              tx.sending
                ? "Waiting for your wallet"
                : running
                  ? "The validators are checking the call"
                  : revising
                    ? `Publish the revision of ${revising.id}`
                    : `Publish the card · send ${bond !== null ? gen(bond) : "the bond"}`
            }
          />
          {problems.length > 0 && (draft.title || draft.tiers.some((t) => t.text || t.price)) ? (
            <p className="text-xs text-gold">Before this can be sent: {problems[0]}</p>
          ) : null}
          {short ? (
            <p className="text-xs text-gold">
              This wallet holds {gen(me.balanceAtto)} and the bond is {gen(bond ?? 0n)}.{" "}
              {isMock ? "Press Get 10 test GEN in the demo bar at the top." : "The wallet menu at the top right has a button that gets 10 test GEN."}
            </p>
          ) : null}
        </div>
      </WalletGate>

      <TxBlock tx={tx} label={revising ? `Revising ${revising.id}` : "Publishing the card"} />
      {made ? (
        <div className="space-y-4 rounded-xl border border-keeps/40 bg-keeps/10 p-4 text-sm" role="status">
          <p className="font-medium">
            {revising ? `${revising.id} is closed and replaced by ${made}.` : `Published as ${made}. It is live and anybody can ask it for a price.`}
          </p>
          <MakerNextSteps card={made} />
        </div>
      ) : null}
    </div>
  );
}
