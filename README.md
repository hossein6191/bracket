# Bracket

A maker (a translator, an illustrator, a tutor) publishes a rate card once: two to four numbered tiers in their
own words, a price for each, and an ambiguity bond. A stranger types a brief and pays the price of the dearest
tier. In that one transaction the contract tells them which tier covers the brief, keeps exactly that tier's price
in escrow for the maker and sends the rest straight back. When no tier covers the brief the whole payment comes
back. When the maker's own card covers the brief twice, the buyer is refunded and paid a slice of the maker's
bond, and the card is frozen until the maker publishes a revised one. The thing on trial is the maker's rate card,
never the buyer's request.

What it does not do, said before anything else:

- It does not judge whether the work was delivered or was any good. `accept` pays the maker when the maker takes
  the job. Bracket prices a brief; it is not a delivery escrow.
- It does not know that a brief is honest. A brief is judged once on a card, but a reworded brief is a different
  brief and may be asked again, and somebody looking for an overlap in a card is doing what the bond is there for.
- A flag stays on its card for ever and is counted on every card revised from it, but an address is free: a maker
  can walk away from a flagged card and start again under another address. A consumer that cares binds to the
  maker's address, which `standing(card)` returns.
- A ladder card (tiers nested from the narrowest to the broadest) never pays the bond for overlap, because overlap
  is what a ladder declares. What declaring a ladder costs is structural: its prices must rise tier by tier, and
  a brief is always booked at the narrowest covering tier, which is therefore the cheapest.
- Texts are plain printable ASCII on one line, with no `<` or `>`. A brief in another script is refused at the
  door with the payment returned. Typographic quotes, dashes and the ellipsis are made plain, and runs of
  whitespace become one space, before anything is measured, stored or judged.
- The readers are language models. Two readings in two orders and a vote of validators make a reading hard to
  bend, not impossible to get wrong. A reading that does not hold still books nothing and moves no bond.

## Why this needs GenLayer

The question in the middle of the transaction is "which of these tiers, in the maker's own words, cover the whole
of this brief, in the buyer's own words". No fixed rule answers that, and nobody with money on the outcome should.
On GenLayer the validators each put the question to their own model and must agree on the answer before any money
moves, so the answer and the settlement are one transaction: the buyer never holds an unpriced order, and the
maker never holds an unearned payment.

## How consensus is used

The value reached under consensus is one short string, the mask: one character per tier in published order, `1`
where the tier covers the whole brief and `0` where it does not, or `?`.

1. Inside one non-deterministic block the leader asks twice. The two prompts carry the same instructions and the
   same texts; what differs is the order of the tiers and the letter each one stands under, chosen so that no
   tier keeps its letter or its place. Each answer is a closed table of YES or NO per letter.
2. Code turns each answer into a mask over the tiers in published order. If the two masks are the same, that mask
   is the value. If they differ, or either answer could not be read, the value is `?`. A reader that leans on a
   letter or on a position therefore ends up as `?`, never as somebody's price.
3. Every validator runs the whole of that work again with its own model, inside `try/except`, and compares the
   stored string with its own by exact equality. There is no tolerance: `110` and `100` disagree.
4. The contract writes everything else from the agreed mask: the outcome, the money, and the sentence it
   publishes. No sentence a model wrote is ever stored.

A round in which the nodes agree that no model could be reached is not a reading: the payment is returned, nothing
is spent and the same call may be made again.

Every text that reaches a prompt is untrusted and fenced: `<` and `>` become `(` and `)` and anything that could
end a line becomes a space, inside `<<<NAME>>>` and `<<<END NAME>>>` lines whose names are the contract's own
(`CARD TITLE`, `TIER A` to `TIER D`, `BRIEF`). Nothing a caller typed is ever printed on a delimiter line. No price
is ever printed in a prompt.

## The four outcomes

| mask, on a card that is not a ladder | mask, on a ladder card | outcome | the money |
|---|---|---|---|
| exactly one `1` | an unbroken run of `1` reaching the last tier | `exact`, at that tier or at the narrowest of the run | the tier's price is held for the maker; the rest is sent back in the same transaction; the order is booked |
| no `1` | no `1` | `outside` | the whole payment is sent back |
| two or more `1` | never | `ambiguous` | the whole payment is sent back with one slice of the bond (a quarter of the bond the card was published with); the first two covering tiers are written on the card as a flag such as `1:2`; the card is frozen |
| `?` | `?`, or any other shape | `unclear` | the whole payment is sent back; the brief is spent on that card |

## Who may do what

| call | who | what happens |
|---|---|---|
| `publish_card` | anyone; the sender is the maker | the value sent is the bond, at least 1 GEN |
| `quote` | anyone but the card's maker | the value sent must equal the card's top price exactly |
| `accept` | the card's maker | the escrow of a booked order is paid to the maker |
| `decline` | the card's maker | the escrow of a booked order goes back to its buyer |
| `cancel` | the buyer who placed the order | the escrow of a booked order goes back to that buyer |
| `revise_card` | the card's maker | a new card id carries what is left of the bond; the old card is closed, points to it and keeps its flags |
| `close_card` | the card's maker, when no order is booked on it | what is left of the bond goes back to the maker |

Nobody can be left stuck. A booked order can be ended by either side at any time. A maker can always reach
`close_card` by accepting or declining what is booked. A frozen card can be revised while its bond still covers a
slice, and closed once nothing is booked on it.

A payable call never raises. Value sent with a call that raises is not returned on this network, so every refusal
of `publish_card` and `quote` returns the value in the same transaction, answers `ok: false` with the reason, and
is kept in a ring of the 24 most recent refusals (`refusals()`). These are refused without asking a model: the
maker quoting their own card, a frozen or closed card, the wrong amount, a brief already judged on that card, a
card that does not exist, and a text that fails the door.

## A second contract that acts on the answer

`contracts/fixtures/listing.py` is a small, separate contract bound to one Bracket address at deployment. A maker
stakes 1 GEN or more to have a card featured, and the stake is accepted only from the address the register names
as the maker and only while `standing(card)` says the card is clean. While the card carries no flag its maker may
withdraw the stake. Once it carries a flag, anybody but its maker may eject it and is paid the stake. Its limit is
stated in the file: a maker can race the public from a second address.

## The site

The site is in `web/`. It reads the deployed contract and signs with a browser wallet.

## Running the tests

```
pip install -r requirements-dev.txt
python -m pytest tests/ -q
genvm-lint check contracts/bracket.py
genvm-lint check contracts/fixtures/listing.py
python tools/mutate.py
```

The offline suite is 104 tests with no network. A stub stands in for the runtime and a small simulator for the
validators: the leader and each validator get their own scripted model, and the scripted models answer by what a
tier says, never by its letter. `tools/mutate.py` removes 127 defences one at a time and records the test that
failed for each in `tests/MUTATIONS.md`; it writes nothing if one survives.

`tests/on_chain/smoke.mjs` is the run against GenLayer Studio (chain 61999) with four generated accounts. It
deploys its own copies of both contracts, plays every outcome and every refusal, records each transaction hash,
vote tally and balance change, and reads the deployed code back to compare it with these files byte for byte.

```
npm ci
node tests/on_chain/smoke.mjs
```

## Layout

```
contracts/bracket.py            the contract
contracts/fixtures/listing.py   a consumer that acts on standing(card)
tests/test_pure.py              the offline suite
tests/MUTATIONS.md              the mutation table
tests/on_chain/smoke.mjs        the on-chain run
tests/on_chain.md               what that run did, step by step
tools/mutate.py                 generates the mutation table
CONTRACTS.md                    every method, argument and returned field
DECISIONS.md                    why it is built this way
web/                            the site
```

## Evidence

One run on GenLayer Studio (chain 61999) on 4 October 2026: 40 transactions in 40 steps, none sent a second time,
59 of 59 checks true. Every step, with its transaction, vote tally and balance change, is in
[`tests/on_chain.md`](tests/on_chain.md).

- Register: [`0x8B694ddc287Dd1E3a644960A4891d55B6992d62C`](https://explorer-studio.genlayer.com/address/0x8B694ddc287Dd1E3a644960A4891d55B6992d62C),
  byte for byte `contracts/bracket.py`, sha256 `d3333b1ddb9e7aa508624d7f086bef833f5bf613aec189f26a26baeb46d6cc7c`.
- Listing fixture: [`0x6E2668c76d19CA000DF8A59acbB8b062Cc940D15`](https://explorer-studio.genlayer.com/address/0x6E2668c76d19CA000DF8A59acbB8b062Cc940D15),
  byte for byte `contracts/fixtures/listing.py`, sha256 `40e6fa4953f793d8655b3a9e7708b2b83b82c8935e1f8ca6529e00c251d7799c`.
- Four generated accounts: M, a translator who publishes the cards; B1 and B2, buyers; S, a stranger who buys
  nothing and ejects the flagged card from the fixture.

| outcome | brief, on card | mask | transaction | money, in the same transaction |
|---|---|---|---|---|
| exact | a 300-word letter, C1 | `100` | [0x3ffc44f8...](https://explorer-studio.genlayer.com/tx/0x3ffc44f84ad1390b477d2cb4710e0b621f983f412dfddcdd0462ad62a98afb6e) | 2 GEN held for tier 1, 6 GEN back |
| exact | a two-page certified diploma, C1 | `001` | [0x46d4a4cc...](https://explorer-studio.genlayer.com/tx/0x46d4a4cc5d2248f15368a140ca324570157e2f43e82c73fc67eb1d670f8afef1) | all 8 GEN held for tier 3 |
| outside | a 9000-word manual, C1 | `000` | [0x97102d0a...](https://explorer-studio.genlayer.com/tx/0x97102d0a4dc3438dcb5af1fa558d8933823e7b58abebf66320aa00ca96344541) | all 8 GEN back |
| unclear | a 550-word product page, C1 | `?` | [0xb009cf24...](https://explorer-studio.genlayer.com/tx/0xb009cf2416e58ebc1d2333b883e276961cf108981f65fe76fdb831ba5d882d4c) | all 8 GEN back, no bond moved |
| ambiguous | a general text of 550 words, C1 | `110` | [0x9cfe2321...](https://explorer-studio.genlayer.com/tx/0x9cfe23219c3a2d93ac5af29ee57fbbc12ccb37d06419d19e83a79876189d6d2f) | all 8 GEN back plus 0.5 GEN of the bond; C1 flagged `1:2` and frozen |
| exact | the same brief, on the revised C2 | `100` | [0x61222986...](https://explorer-studio.genlayer.com/tx/0x6122298671cec4c02b2c5b03d0682f77fba1ba0947f246c64b0748a38956ff4e) | 2 GEN held for tier 1, 6 GEN back |
| exact, ladder | spelling and grammar in an essay, C3 | `011` | [0x37d13232...](https://explorer-studio.genlayer.com/tx/0x37d1323275c092e201de614d99be86409405fbf14d328823ed552b1df732e1c3) | 3 GEN held for tier 2, the narrowest, 3 GEN back |

The flag then moved money in the second contract: the maker could no longer withdraw the 1 GEN stake on C1, and
the stranger ejected the card and was paid it
([0xf8a58cc6...](https://explorer-studio.genlayer.com/tx/0xf8a58cc6601986cad6df021bca50128b7ca8d69e292e5a97a618f4a5c66073cf)).
At the end every card was closed, the register and the fixture each held 0, and every account's balance had moved
by exactly what the ledger says.

Two things did not go as first written, and `tests/on_chain.md` says both: the product page was expected to be
read as an overlap and was read as unclear, so the overlap was shown with a second brief; and that brief's first
round was carried by no majority (2 agree, 3 disagree) before a new leader's round stored `110`.

## Licence

MIT. See `LICENSE`.
