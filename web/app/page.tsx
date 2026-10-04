import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { OutcomeBadge } from "@/components/bracket";
import { HeroActions, RateDemo } from "@/components/landing";
import type { Outcome } from "@/lib/chain";

const FIVE: [string, string][] = [
  ["A maker publishes a rate card", "Once. Two to four numbered tiers in their own words, each with a price, and a bond behind the wording."],
  ["You type a brief", "What you need, in your own words. You send the price of the dearest tier with it."],
  ["The validators read the card", "Each asks which tiers cover your whole brief, twice, with the tiers lettered in two different orders."],
  ["You pay the tier that covers it", "Its price stays in escrow for the maker. The rest comes back in the same transaction."],
  ["The maker accepts, or you cancel", "Accept pays the maker from escrow. Until then you may cancel and take the price back."],
];

const OUTCOMES: [string, Outcome, string][] = [
  ["One tier covers the brief", "exact", "That tier's price stays in escrow for the maker and the rest of what you sent comes straight back. The order is booked."],
  ["No tier covers it", "outside", "The card has no price for your request, and says so. Everything you sent comes back."],
  ["Two tiers cover it", "ambiguous", "The maker promised tiers that do not overlap, and they do. You are refunded in full and paid a slice of the maker's bond, and the card is frozen until it is revised."],
  ["The validators cannot settle it", "unclear", "The two askings disagreed, or a ladder came back with a gap. Everything comes back, and that brief is closed on that card so it cannot be asked until it suits."],
];

const WHY: [string, string][] = [
  [
    "Why the card is on trial",
    "A price list is a promise about wording. If two of its lines fit the same request, the buyer cannot know what they will be charged. So a maker who declares that the tiers do not overlap puts up a bond, and the first brief that shows otherwise is paid from it. The buyer is never judged: a brief no tier covers simply gets its money back.",
  ],
  [
    "How the validators agree",
    "Each validator asks its own model which tiers cover the whole brief, twice, and the second time every tier wears a different letter. The answers become one mark per tier. If the two askings differ, the stored value is a question mark. Validators must arrive at the same marks, character for character; the outcome and the money then follow in code.",
  ],
  [
    "What the maker does",
    "Publishes the card and can then walk away: prices are fixed without them. A booked order waits for the maker to accept it, which pays them from escrow, or to decline it. A frozen card needs a revised one, which keeps what is left of the bond; closing a card returns it.",
  ],
];

const MORE: [string, string][] = [
  ["/cards", "Read the published cards"],
  ["/publish", "Publish a card of your own"],
  ["/orders", "Your orders"],
  ["/deploy", "Deploy your own copy"],
];

export default function HomePage() {
  return (
    <div className="container-site space-y-14 py-10 sm:py-14">
      <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div className="min-w-0 space-y-6 lg:sticky lg:top-24">
          <p className="eyebrow inline-flex items-center gap-2 text-brand-secondary">
            <span aria-hidden className="h-px w-6 bg-brand-secondary" />
            Fixed prices on GenLayer
          </p>
          <h1 className="text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Say what you need. <span className="text-gradient">Pay the tier that covers it, and nothing more.</span>
          </h1>
          <p className="max-w-xl text-base text-foreground/80 text-pretty sm:text-lg">
            A translator, an illustrator or a tutor publishes a rate card once. You type a brief, and in one transaction the
            contract tells you which tier it falls under, keeps exactly that price in escrow and sends the rest back. The thing
            on trial is the maker&apos;s rate card, never your request.
          </p>
          <HeroActions />
        </div>
        <RateDemo />
      </section>

      <section aria-labelledby="steps-title" className="space-y-4">
        <h2 id="steps-title" className="text-xl font-semibold tracking-tight">
          How it works, in five steps
        </h2>
        <ol className="cells rounded-2xl shadow-custom sm:grid-cols-2 lg:grid-cols-5">
          {FIVE.map(([title, body], i) => (
            <li key={title} className="space-y-2 p-5 sm:last:col-span-2 lg:last:col-span-1">
              <span className="font-mono text-xs text-brand">{String(i + 1)}</span>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground text-pretty">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="outcomes-title" className="space-y-4">
        <h2 id="outcomes-title" className="text-xl font-semibold tracking-tight">
          The four things that can happen to your money
        </h2>
        <ol className="cells rounded-2xl shadow-custom sm:grid-cols-2">
          {OUTCOMES.map(([when, outcome, body]) => (
            <li key={outcome} className="space-y-2 p-5">
              <OutcomeBadge outcome={outcome} />
              <p className="text-sm font-semibold">{when}</p>
              <p className="text-sm text-muted-foreground text-pretty">{body}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          In every case the part that is not a price is back in your wallet a few seconds after the transaction is final. A quote
          takes one signature and one to two minutes.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="How the price is agreed">
        {WHY.map(([title, body]) => (
          <div key={title} className="surface p-5 sm:p-6">
            <span aria-hidden className="block h-0.5 w-8 bg-linear-to-r from-brand to-brand-secondary" />
            <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gold/30 bg-card p-5 text-sm shadow-[inset_3px_0_0_var(--gold)] sm:p-6">
        <h2 className="font-semibold text-gold">The limit, said plainly</h2>
        <p className="mt-1 text-foreground/85 text-pretty">
          Bracket fixes a price before any work exists; it never judges delivery. Accepting an order pays the maker from escrow,
          and whether the translation, the drawing or the lesson then arrives is between the two of you, as it is with any
          deposit. The agreement is also only as good as the wording: a card with vague tiers will often come back with no price
          fixed, and that is the card being read honestly.
        </p>
      </section>

      <nav aria-label="More" className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {MORE.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center justify-between gap-3 bg-card px-4 py-3 font-mono text-xs text-foreground/85 transition-colors hover:bg-[#151515] hover:text-brand"
          >
            {label}
            <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
