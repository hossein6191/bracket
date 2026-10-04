import Link from "next/link";
import { ArrowRight, BookOpenText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeroCta } from "@/components/hero-cta";
import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/ui/terminal";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border bg-card p-5 sm:p-6";

const FIVE: [string, string][] = [
  ["A maker publishes a rate card", "Once. Two to four numbered tiers in their own words, each with a price, and a bond behind the wording."],
  ["You type a brief", "What you need, in your own words. You send the price of the dearest tier with it."],
  ["The validators read the card", "Each asks which tiers cover your whole brief, twice, with the tiers lettered in two different orders."],
  ["You pay the tier that covers it", "Its price stays in escrow for the maker. The rest comes back in the same transaction."],
  ["The maker accepts, or you cancel", "Accept pays the maker from escrow. Until then you may cancel and take the price back."],
];

const OUTCOMES: [string, string, string][] = [
  ["One tier covers the brief", "Priced", "That tier's price stays in escrow for the maker and the rest of what you sent comes straight back. The order is booked."],
  ["No tier covers it", "Outside the card", "The card has no price for your request, and says so. Everything you sent comes back."],
  ["Two tiers cover it", "Covered twice", "The maker promised tiers that do not overlap, and they do. You are refunded in full and paid a slice of the maker's bond, and the card is frozen until it is revised."],
  ["The validators cannot settle it", "No price fixed", "The two askings disagreed, or a ladder came back with a gap. Everything comes back, and that brief is closed on that card so it cannot be asked until it suits."],
];

export default function HomePage() {
  return (
    <div className="container-site space-y-10 py-8 sm:py-12">
      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="min-w-0 space-y-5">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Fixed prices on GenLayer</p>
          <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-5xl">
            Say what you need. <span className="text-gradient">Pay the tier that covers it, and nothing more.</span>
          </h1>
          <p className="max-w-xl text-base text-foreground/85 sm:text-lg">
            A translator, an illustrator or a tutor publishes a rate card once. You type a brief, and in one transaction the
            contract tells you which tier it falls under, keeps exactly that price in escrow and sends the rest back. The thing
            on trial is the maker&apos;s rate card, never your request.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <HeroCta />
            <Button asChild variant="outline" size="lg">
              <Link href="/ledger">
                <BookOpenText /> See what already happened
              </Link>
            </Button>
          </div>
        </div>
        <Terminal className="max-w-none min-w-0 border-white/10 bg-black/60 backdrop-blur-sm">
          <TypingAnimation duration={18} className="text-foreground">{"> quote(C1)  a translator's card, sent with 4 GEN"}</TypingAnimation>
          <AnimatedSpan className="text-muted-foreground">  brief: a one-page cover letter, about 250 words, no hurry</AnimatedSpan>
          <AnimatedSpan className="text-muted-foreground">  asked twice, the tiers lettered in two different orders</AnimatedSpan>
          <AnimatedSpan className="text-keeps">  stored value 1000   the validators agree</AnimatedSpan>
          <AnimatedSpan className="text-keeps">+ priced: tier 1, 0.5 GEN held in escrow for the maker</AnimatedSpan>
          <AnimatedSpan className="text-keeps">+ 3.5 GEN returned in this transaction</AnimatedSpan>
          <TypingAnimation duration={18} className="text-foreground">{"> quote(C2)  a copywriter's card, sent with 3 GEN"}</TypingAnimation>
          <AnimatedSpan className="text-muted-foreground">  brief: copy for a single landing page, about 350 words</AnimatedSpan>
          <AnimatedSpan className="text-gold">  stored value 110   tiers 1 and 2 both cover it</AnimatedSpan>
          <AnimatedSpan className="text-gold">x covered twice: 3 GEN returned, plus 0.5 GEN from the maker&apos;s bond</AnimatedSpan>
          <AnimatedSpan className="text-breaks">x card C2 frozen until its maker publishes a revised one</AnimatedSpan>
        </Terminal>
      </section>

      <section aria-labelledby="steps-title" className="space-y-4">
        <h2 id="steps-title" className="text-xl font-semibold tracking-tight">
          How it works, in five steps
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FIVE.map(([title, body], i) => (
            <li key={title} className={cn(card, "space-y-2 p-4 sm:p-4")}>
              <span className="flex size-8 items-center justify-center rounded-full bg-linear-to-b from-brand to-brand-secondary text-sm font-semibold text-white">
                {i + 1}
              </span>
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
        <ol className="grid gap-3 sm:grid-cols-2">
          {OUTCOMES.map(([when, name, body]) => (
            <li key={name} className={cn(card, "space-y-1 p-4 sm:p-4")}>
              <p className="text-xs font-semibold text-primary">{when}</p>
              <p className="text-sm font-semibold">{name}</p>
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
        <div className={card}>
          <h2 className="text-lg font-semibold">Why the card is on trial</h2>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            A price list is a promise about wording. If two of its lines fit the same request, the buyer cannot know what they
            will be charged. So a maker who declares that the tiers do not overlap puts up a bond, and the first brief that
            shows otherwise is paid from it. The buyer is never judged: a brief no tier covers simply gets its money back.
          </p>
        </div>
        <div className={card}>
          <h2 className="text-lg font-semibold">How the validators agree</h2>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            Each validator asks its own model which tiers cover the whole brief, twice, and the second time every tier wears a
            different letter. The answers become one mark per tier. If the two askings differ, the stored value is a question
            mark. Validators must arrive at the same marks, character for character; the outcome and the money then follow in
            code.
          </p>
        </div>
        <div className={card}>
          <h2 className="text-lg font-semibold">What the maker does</h2>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            Publishes the card and can then walk away: prices are fixed without them. A booked order waits for the maker to
            accept it, which pays them from escrow, or to decline it. A frozen card needs a revised one, which keeps what is left
            of the bond; closing a card returns it.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gold/40 bg-gold/10 p-5 text-sm sm:p-6">
        <h2 className="font-semibold text-gold">The limit, said plainly</h2>
        <p className="mt-1 text-foreground/85 text-pretty">
          Bracket fixes a price before any work exists; it never judges delivery. Accepting an order pays the maker from escrow,
          and whether the translation, the drawing or the lesson then arrives is between the two of you, as it is with any
          deposit. The agreement is also only as good as the wording: a card with vague tiers will often come back with no price
          fixed, and that is the card being read honestly.
        </p>
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        <Link href="/cards" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          Read the published cards <ArrowRight className="size-3.5" />
        </Link>
        <Link href="/publish" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          Publish a card of your own <ArrowRight className="size-3.5" />
        </Link>
        <Link href="/orders" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          Your orders <ArrowRight className="size-3.5" />
        </Link>
        <Link href="/deploy" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          Deploy your own copy <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </div>
  );
}
