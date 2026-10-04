# Decisions

Why Bracket is built the way it is. Each entry is a choice that could have gone another way.

## One transaction

The buyer sends the top price and the contract settles in the same call: the tier's price stays, the rest goes
back. A two-step design (ask, then pay) leaves a quote nobody has paid for and a window in which either side can
walk. Sending the top price up front means the contract can never be short of the price of whichever tier
applies, and never needs a second transaction from the buyer.

## What the validators agree on

One short string, the mask: `1` or `0` per tier in published order, or `?`. It is the smallest thing from which
the outcome, the money and the published sentence can all be computed, so that is all a model contributes. The
outcome is not asked for directly ("which tier applies?") because that question invites a best-fit answer and
hides an overlap; asking about every tier separately is what makes an overlap visible.

Validators compare the mask by exact string equality. A rule such as "the same number of covering tiers" or "the
same outcome" would let two nodes hold materially different readings and call it agreement.

## Two orders, and `?` as a value

A reader that favours the first item, or the letter A, would be consistent with itself and wrong. So the leader
asks twice with the tiers in two orders in which no tier keeps its letter or its place, and keeps the mask only
when both askings name the same tiers. Otherwise the stored value is `?`. Disagreement between the two orders is a
finding with its own value, not something to average away.

Both askings are inside the leader closure, and every validator runs both. A validator's own re-run is wrapped in
`try/except`: a node whose model misbehaves disagrees, it does not escape.

## `?` books nothing, moves no bond, and spends the brief

A reading that did not hold still is not evidence against the card, so the bond is not touched. It is not a
booking either. The brief is spent on that card so that the same words cannot be sent again and again until a
round comes out the way somebody wants. A reworded brief is a different brief; that cannot be prevented and the
README says so.

## A brief is judged once on a card

Every judged brief is recorded by the digest of its text in lowercase with single spaces, whatever the outcome
and whoever sent it. Verdicts are final: a cancelled order's brief cannot be re-quoted on the same card either.
The cost is that a buyer who cancels and changes their mind must change a word. The gain is that no outcome on
record can be re-rolled.

A round in which the nodes agreed that no model could be reached is different: nothing was read, so nothing is
spent.

## Refusals return, they do not raise

Value sent with a call that raises is not returned on this network. So `publish_card` and `quote` never raise:
every refusal sends the value back in the same transaction and answers `ok: false`. The refusals are kept in a
ring of 24, so a refused caller cannot grow the state. The calls that carry no value (`accept`, `decline`,
`cancel`, `revise_card`, `close_card`) decide nothing that must be remembered when they are refused, so they fail
with a deterministic error.

## The bond, the slice and the freeze

The bond is at least 1 GEN and one ambiguous finding pays a quarter of the bond the card was published with. The
slice is fixed for the life of the card and of every card revised from it, so after the fourth finding the bond
no longer covers a slice; a slice recomputed from what is left would shrink each time and never run out. When the
bond no longer covers a slice the card can only be closed.

An ambiguous finding freezes the card. Without the freeze the same overlap could be found by one brief after
another and drain the bond in minutes; with it, one overlap costs one slice, and the maker must change the card
before it prices anything again.

## A revision must be different, and flagged tiers are not published again

`revise_card` refuses the tiers the card already has, so a new title over the same overlap is not a way out of a
freeze. Tiers a flag was raised on are remembered against their maker and refused by both `publish_card` and
`revise_card`, so closing a flagged card and publishing the same tiers afresh is not a way out either. The
contract checks that a revision is different, never that it is better: the next brief tests that, and the bond
pays again if it is not.

An address is free, so this binds a maker's address and not a person. A consumer that cares reads `maker` and
`past_flags` from `standing(card)`.

## The ladder flag is self-declared, so it has a structural cost

A maker who declares a ladder is never charged for overlap. If that cost nothing, every maker would declare one.
So on a ladder card prices must rise tier by tier and a brief is booked at the narrowest covering tier, which is
therefore always the cheapest: the maker gives up the dearer tier whenever two apply. The covering tiers must be
an unbroken run reaching the last tier, because that is what "nested" means.

A broken run (a narrower tier covers and a broader one does not) is `unclear` and moves no bond. With nested tiers
a broken run can come from the card or from the reading, and the two cannot be told apart from the mask, so no
money is taken from anybody on it.

## Plain ASCII on one line

Every text is held to printable ASCII with no `<` or `>` at the door, and fenced again where the prompt is built.
With one alphabet there is no look-alike of a delimiter to worry about and no invisible character. The price is
that a brief in another script is refused; it is refused before any model is asked and the payment comes back.

Typographic quotes, dashes and the ellipsis are made plain and runs of whitespace become one space before the
text is measured. That is done once, at the door, so the stored text is the judged text character for character,
and a page can show exactly what was read.

## No price in the prompt

The question is what a tier covers. A reader that could see the prices could be drawn into choosing the best
deal, for either side.

## The card's title is judged

Tiers are often written against their title ("up to 500 words" of what?). The buyer reads the title with the
tiers, so the readers do too, in its own fenced block and marked untrusted like everything else the maker wrote.

## `accept` pays at once

Bracket ends where the job starts. Holding the money until delivery would need a judgement of the delivered work,
which is a different question with different evidence. Until the maker accepts, the buyer can cancel; once the
maker accepts, the price is the maker's. The README states this as the first limit.

## The maker may not quote their own card

It would only produce orders between a maker and themselves. A second address gets round it, so the counters on
a card are a record of what was judged, not a reputation.

## List views return bare lists

`cards()`, `cards_from`, `orders_of`, `orders_by`, `ledger` and `refusals` return a JSON list and nothing around
it. The total a page needs for paging is in `stats()`, and each row carries its own id.

## The Listing fixture

A verdict that only sits in a register is an opinion. The fixture is a second contract in which a card's standing
moves money: a stake is taken only for a clean card, returned only while the card carries no flag, and paid to
whoever ejects the card once it carries one. It binds to the register's address at deployment and reads the maker
from the register, because a card id alone is only the next number.

The payable path wraps the register read: a register that cannot be read is a refusal that returns the stake. The
paths that carry no value leave it unwrapped, so an unreadable minute reverts and can never look like "no flag".

## Verified on chain

What the one run on GenLayer Studio (`tests/on_chain.md`) settled that the offline suite could not:

- A refused `publish_card`, `quote` or `feature` returns the value it carried in the same transaction: eight
  stored refusals, each with the sender's balance unchanged once it was final.
- A `quote` keeps exactly one tier's price and sends the rest back in the same transaction: 6, 3, 0 and 6 GEN came
  back on four exact readings, 3 GEN on the ladder card, and the whole 8 GEN on the outside and unclear ones.
- An ambiguous reading pays the slice of the bond to the buyer in the same transaction, flags the pair `1:2`,
  freezes the card and lowers its bond by one slice; the next brief on the frozen card was refused.
- All four outcomes were reached with real models and a vote of validators: exact, outside, ambiguous and
  unclear. A reading the two orders did not agree on was stored as `?` and moved nothing.
- A round carried by no majority stored nothing: the overlap brief's first round went 2 agree, 3 disagree, and
  only the next leader's round, carried with 3 agree and 2 idle, wrote the order and moved the money.
- `revise_card` carries what is left of the bond to the new id, and an order booked before the revision is still
  accepted on the closed card. A ladder books at the narrowest covering tier and never touches the bond.
- The fixture reads `standing(card)` from the register under consensus and acts on it: a clean card is staked and
  withdrawn, a flagged one cannot be withdrawn or staked again, and a stranger who ejects it is paid the stake.
- With every card closed and every order ended, the register and the fixture each hold 0, and every account's
  balance moved by exactly what the ledger says. Studio charges no gas.
- The deployed bytes of both contracts are the repository files, read back with `gen_getContractCode`.

Not settled by the run: what Studio does with the value of a `quote` whose every round is left undetermined. The
one round that went without a majority was carried by the next leader, so that case never came up.

## What was left out

- No deadline on a booked order. Either side can end it at any time, so nothing waits on a clock.
- No appeal of a reading. The reading is cheap to ask again in other words, and the bond moves only on a mask that
  two orders and a majority of validators agreed on.
- No fee. The contract holds bonds and escrow and nothing else; `held_bonds` plus `held_escrow` is its balance.
