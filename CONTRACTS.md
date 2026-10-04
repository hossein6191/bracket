# Contracts

Two contracts. `contracts/bracket.py` is the register. `contracts/fixtures/listing.py` is a consumer of it.

Every method returns a JSON string. Amounts are decimal strings of atto (1 GEN is 10^18 atto). Addresses come back
in lowercase. Card ids are `C1`, `C2`, ... and order ids are `O1`, `O2`, ..., assigned by the contract.

## Bracket: writes

### `publish_card(title, tiers_json, ladder)` payable

The value sent is the ambiguity bond, at least 1 GEN. Anyone; the sender is the maker.

- `title`: 4 to 60 characters.
- `tiers_json`: a JSON list of 2 to 4 objects `{"text": ..., "price": ...}`. Each text is 20 to 240 characters.
  Each price is a whole number of atto greater than zero, as a string of digits (a JSON integer is accepted; a
  number with a decimal point is refused). Two tiers may not say the same words.
- `ladder`: `"1"` when the tiers are nested from the narrowest to the broadest in the order given, `"0"` when
  they are meant not to overlap. On a ladder card each tier must cost more than the one before it.

Returns `{ok: true, card, maker, tiers, top_price, bond, bond_slice, ladder}`. `top_price` is the dearest tier.
`bond_slice` is the bond divided by four, rounded down.

A refusal returns the value in the same transaction and
`{ok: false, reason, returned, card: "", by, recorded: true}`. It never raises.

### `quote(card, brief)` payable

The value sent must equal the card's `top_price` exactly. Anyone but the card's maker. `brief` is 20 to 1200
characters.

A judged quote returns
`{ok: true, order, card, outcome, mask, tier, price, refunded, bond_paid, status, line}`:

| field | meaning |
|---|---|
| `outcome` | `exact`, `outside`, `ambiguous` or `unclear` |
| `mask` | one `0` or `1` per tier in published order, such as `0100`, or `?` |
| `tier` | the booked tier, counted from 1; `0` when none |
| `price` | what is held in escrow; `"0"` unless the outcome is `exact` |
| `refunded` | what was sent back of the payment in this transaction |
| `bond_paid` | the slice of the maker's bond sent to the buyer; `"0"` unless the outcome is `ambiguous` |
| `status` | `booked` for `exact`, otherwise `refunded` |
| `line` | a sentence the contract composes from its own phrases and numbers |

`ok` is `true` for all four outcomes: a quote that was judged is an order with an id, whatever it came to.

Refusals that ask no model return the value in the same transaction and
`{ok: false, reason, returned, card, by, recorded: true}`:

- the card does not exist
- the sender is the card's maker
- the card is closed (the reason names the card it was revised to, when there is one)
- the card is frozen
- the value is not exactly the top price
- the brief fails the door (length, a `<` or `>`, a character outside printable ASCII)
- the same brief was already judged on that card (compared in lowercase with single spaces)

A round in which the nodes agreed that no model could be reached is returned the same way; nothing is spent and
the call may be made again. `quote` never raises.

### `accept(order)`, `decline(order)`, `cancel(order)`

On a booked order only. `accept` and `decline` are for the maker of the order's card; `cancel` is for the buyer
who placed it. `accept` pays the escrow to the maker; the other two send it back to the buyer.

Return `{ok: true, order, card, status, paid, to}` with `status` `accepted`, `declined` or `cancelled`.
A call by anybody else, on an order that is not booked, or on an order that does not exist, fails with an
`[EXPECTED]` error and changes nothing.

### `revise_card(card, title, tiers_json, ladder)`

The card's maker only, on an open card. The arguments are held to every rule of `publish_card`. The tiers must
differ from the card's present tiers (a new title alone is not a revision), and tiers a flag was raised on may not
be published again by the same maker. The bond left on the card must still cover one slice.

Returns `{ok: true, card, revised_from, maker, tiers, top_price, bond, bond_slice, ladder, past_flags}`. `card` is
the new id. It carries the old card's remaining bond and the same slice. The old card is closed, its `revised_to`
names the new card, and its flags stay on it. Orders booked on the old card stay there and can still be ended.
Fails with an `[EXPECTED]` error otherwise.

### `close_card(card)`

The card's maker only, on an open card with no booked order. Returns `{ok: true, card, open: false, returned, to}`
and sends what is left of the bond to the maker. Fails with an `[EXPECTED]` error otherwise.

## Bracket: views

Every view takes an id, an address or a number. List views return a bare JSON list.

| view | returns |
|---|---|
| `card(card)` | one card row, or `{error}` |
| `cards()` | the 24 newest card rows, newest first |
| `cards_from(start)` | up to 24 card rows from card number `start` downwards (`"6"` or `"C6"`), newest first; after `cards()` the next page starts one below the lowest number shown |
| `standing(card)` | `{card, exists, open, frozen, flags, clean, maker, revised_to, past_flags}`; `clean` is true only for a card that exists, is open, is not frozen and carries no flag |
| `order(order)` | one order row, or `{error}` |
| `orders_of(card)` | order ids judged on that card, newest first, the last 50 |
| `orders_by(address)` | order ids of that buyer, newest first, the last 50 |
| `ledger(count)` | the newest order rows of every card, newest first; at most 24 whatever is asked for |
| `refusals()` | the 24 most recent refusals that asked no model: `{seq, by, card, reason, at}` |
| `stats()` | the counters below |
| `rule()` | the agreement rule in words, with every cap |

A card row:

```
{card, maker, title, ladder, tiers: [{text, price}], top_price, bond, bond_slice, open, frozen,
 flags: ["1:2"], orders, booked, exact, outside, ambiguous, unclear, revised_to, revised_from,
 past_flags, digest, created_at}
```

`orders` counts every judged quote; `booked` counts the orders that still hold escrow; `past_flags` counts the
flags on the cards this one was revised from; `digest` is the identity of the tiers (the ladder flag and each
tier's words and price).

An order row:

```
{order, card, buyer, maker, brief, brief_digest, outcome, mask, tier, price, paid, refunded,
 bond_paid, status, line, at, settled_at}
```

`status` is `booked`, `accepted`, `declined`, `cancelled` or `refunded`. `brief` is the text as it was judged.
`brief_digest` is the sha256 of that text in lowercase with single spaces. `at` and `settled_at` are seconds since
1970 on the transaction's own clock.

`stats()`:

```
{cards, orders, refusals, exact, outside, ambiguous, unclear, accepted, declined, cancelled, booked,
 open_cards, frozen_cards, flags, revisions, held_bonds, held_escrow, paid_to_makers, bond_paid_out}
```

`held_bonds` plus `held_escrow` is everything the contract holds.

## Listing: the consumer

Deployed with one argument, the Bracket address. Deployment fails if that address does not answer as a register.

| call | who | what happens |
|---|---|---|
| `feature(card)` payable | the maker the register names for that card | the value sent, at least 1 GEN, is staked; accepted only while `standing(card).clean` is true. A refusal returns the value and `{ok: false, reason, returned, by}`; it never raises, a register that could not be read included |
| `withdraw(card)` | the maker who staked it | the stake goes back, while the card carries no flag |
| `eject(card)` | anybody but that maker | allowed once the card carries a flag; the stake is paid to the caller |
| `entry(card)` view | | `{card, maker, stake, state, to, why}` with `state` `featured`, `withdrawn` or `ejected` |
| `shelf()` view | | the ids featured now, newest first |
| `terms()` view | | the bound register and the rule in words |
