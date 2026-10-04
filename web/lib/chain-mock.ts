// A stand-in for the contract, in memory, for NEXT_PUBLIC_MOCK=1. lib/chain.ts delegates here.
//
// It follows the contract's interface on everything deterministic (who may call what, the money
// path of each outcome, the stored refusals, the freeze, revise and close) and answers every view
// in the contract's own JSON shape, so the mappers in lib/chain.ts run on the same rows in both
// modes. The one thing it cannot do is ask a model: which tiers cover a brief is SCRIPTED here
// (see scriptedMask below) and the demo banner says so on every page.
//
// The demo content is four rate cards: a translator's, a copywriter's whose landing page and
// website tiers overlap, a tutor's ladder, and an illustrator's card that an earlier brief
// already froze. State lives for as long as the tab does; a reload starts it again.

import type { TxStatus, WriteFn } from "./chain";
import { notify } from "./browser-store";
import { COPYWRITER, ILLUSTRATOR_FLAWED, TRANSLATOR, TUTOR, exampleFor, type ExampleCard } from "./examples";

const GEN = 10n ** 18n;
export const MOCK_REGISTER = "0x0000000000000000000000000000000000b4ac3e";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clockNow = () => Math.floor(Date.now() / 1000);

// ---- who the visitor is acting as ---------------------------------------------

export type Persona = { address: string; name: string; note: string };

const VISITOR = "0x0d17b3a9e86f42c50b9e31d7f4a82c6950e1b3d8";
const BUYER = "0x7be2c94f0a6d318e55c7f120b9a84d63e07f1c25";
const TRANSLATOR_AT = "0x93e5f07a2d1c48b6e30f5a79c81d24b6f0a35e7c";
const COPYWRITER_AT = "0x51d0a7e4c2b98f3361ad04c7e85b12f09d3c6a41";
const TUTOR_AT = "0x2f8a61d3b7c05e94a1f6d82c304b7e59c6a0d8f3";
const ILLUSTRATOR_AT = "0xc4096be17a52d38f0e6b91a47d25c803f1e7a69b";
const OTHER_BUYER = "0x3b70e4a6c1d9258f7e03b6a14c8d5f92e60a7b19";

/** The accounts a visitor can act as in mock mode. The first is a newcomer with test GEN and no history. */
export const PERSONAS: Persona[] = [
  { address: VISITOR, name: "A new visitor", note: "a buyer with no orders yet" },
  { address: BUYER, name: "An earlier buyer", note: "has a booked order to cancel" },
  { address: TRANSLATOR_AT, name: "The translator", note: "maker of C1, has an order to accept" },
  { address: COPYWRITER_AT, name: "The copywriter", note: "maker of C2" },
  { address: TUTOR_AT, name: "The tutor", note: "maker of C3" },
  { address: ILLUSTRATOR_AT, name: "The illustrator", note: "maker of C4, frozen: revise it" },
];

let persona = VISITOR;
/** The address the mock treats as the connected wallet. */
export const mockAddress = (): string => persona;
export function setMockPersona(address: string): void {
  if (PERSONAS.some((p) => p.address === address)) persona = address;
  notify();
}

// ---- balances --------------------------------------------------------------------

const balances = new Map<string, bigint>([
  [VISITOR, 25n * GEN],
  [BUYER, 12n * GEN],
  [TRANSLATOR_AT, 9n * GEN],
  [COPYWRITER_AT, 7n * GEN],
  [TUTOR_AT, 6n * GEN],
  [ILLUSTRATOR_AT, 8n * GEN],
  [OTHER_BUYER, 100n * GEN],
]);
const balance = (a: string) => balances.get(a.toLowerCase()) ?? 0n;
const credit = (a: string, v: bigint) => {
  balances.set(a.toLowerCase(), balance(a) + v);
  notify();
};
/** The balance as a decimal string: a stable snapshot for useSyncExternalStore. */
export const mockBalanceText = (address: string): string => balance(address).toString();

// ---- the contract's constants ------------------------------------------------------

const L = { MIN_TITLE: 4, MAX_TITLE: 60, MIN_TIERS: 2, MAX_TIERS: 4, MIN_TIER: 20, MAX_TIER: 240, MIN_BRIEF: 20, MAX_BRIEF: 1200, MIN_BOND: GEN };
/** One ambiguous finding pays the buyer the bond divided by this. */
const BOND_SLICES = 4n;
const PAGE = 24;
const IDS_PAGE = 50;
const REFUSALS_KEPT = 24;

/** rule(), in the contract's own words. */
const RULE = {
  value:
    "the mask: one character per tier in published order, 1 where the tier covers the whole brief and 0 where it does not, or ? when the reading did not hold still",
  agreement:
    "the leader asks twice, with the tiers shown in two different orders so that no tier keeps its letter, turns each answer into a mask and stores ? unless the two masks are the same; every validator repeats the whole of that work and compares the stored string by exact equality",
  outcomes: {
    exact:
      "one covering tier, or on a ladder card an unbroken run of covering tiers reaching the last one, booked at the narrowest: that tier's price is held for the maker and the rest is sent back in the same transaction",
    outside: "no covering tier: the whole payment is sent back",
    ambiguous:
      "two or more covering tiers on a card that is not a ladder: the whole payment is sent back with one slice of the maker's bond, the first two covering tiers are written on the card as a flag, and the card is frozen until its maker revises it",
    unclear:
      "the mask is ?, or on a ladder card the covering tiers are not an unbroken run reaching the last one: the whole payment is sent back and the brief is spent on that card",
  },
  finality:
    "a brief is judged once on a card, by the digest of its text in lowercase with single spaces; a round in which no model could be reached is not a reading and spends nothing",
  texts:
    "plain printable ASCII on one line, with no < or >; typographic quotes, dashes and the ellipsis are made plain and runs of whitespace become one space before anything is measured, stored or judged",
  ladder: "on a ladder card each tier costs more than the one before it, and a ladder never pays the bond for overlap, because overlap is what it declares",
  revision:
    "a revised card is a new card that carries what is left of the bond; it must change the tiers, and tiers a flag was raised on may not be published again by the same maker",
  not_judged: "whether the work was delivered or was any good, whether a brief is honest, and who a maker is beyond the address that published the card",
};

/** A raised refusal: nothing changes, what was sent comes back, and the receipt carries the sentence. */
class Refused extends Error {}
const fail = (message: string): never => {
  throw new Refused("[EXPECTED] " + message);
};

const norm = (text: unknown) => String(text).toLowerCase().split(/\s+/).filter(Boolean).join(" ");

async function sha256(text: string): Promise<string> {
  try {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // No WebCrypto on this origin: a stable stand-in, good enough to tell two texts apart.
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return h.toString(16).padStart(8, "0").repeat(8);
  }
}
const digestOf = (text: unknown) => sha256(norm(text));

const whole = (raw: unknown): bigint => {
  const s = String(raw).trim();
  return s && s.length <= 40 && /^\d+$/.test(s) ? BigInt(s) : -1n;
};

const TYPOGRAPHIC: [string, string][] = [
  ["\u2018", "'"], ["\u2019", "'"], ["\u201c", '"'], ["\u201d", '"'], ["\u2013", "-"], ["\u2014", "-"], ["\u2026", "..."], ["\u00a0", " "],
];
/** What Python's str.split() breaks on (str.isspace()), as the contract does; JS \s also takes U+FEFF and misses \x1c-\x1f and \x85. */
const PY_SPACE = /[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;
/** The text as it is measured, stored and judged: plain punctuation, single spaces, one line. */
const tidy = (raw: unknown): string => {
  let t = String(raw);
  for (const [fancy, plain] of TYPOGRAPHIC) t = t.split(fancy).join(plain);
  return t.split(PY_SPACE).filter(Boolean).join(" ");
};
function textProblem(text: string, least: number, most: number, what: string): string {
  if (text.length < least || text.length > most) return `${what} is ${least} to ${most} characters; this one is ${text.length}`;
  for (const ch of text) {
    if (ch === "<" || ch === ">") return `${what} may not contain < or >; write the comparison in words`;
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) return `${what} is plain printable ASCII: unaccented Latin letters, digits and common punctuation on one line`;
  }
  return "";
}

// ---- state -----------------------------------------------------------------------

type Tier = { text: string; price: bigint };
type CardRec = {
  n: number; maker: string; title: string; ladder: "0" | "1"; tiers: Tier[]; top: bigint; bond: bigint; slice: bigint;
  open: boolean; frozen: boolean; flags: string[]; orders: number[]; quoted: Map<string, string>; booked: number;
  exact: number; outside: number; ambiguous: number; unclear: number; revisedTo: string; revisedFrom: string; pastFlags: number;
  digest: string; createdAt: number;
};
type RefusalRec = { seq: number; by: string; card: string; reason: string; at: number };
type OrderRec = {
  n: number; card: number; buyer: string; maker: string; brief: string; digest: string; outcome: string; mask: string;
  tier: number; price: bigint; paid: bigint; refunded: bigint; bondPaid: bigint; status: string; line: string; at: number; settledAt: number;
};
type Row = Record<string, unknown>;

const cards = new Map<number, CardRec>();
const orders = new Map<number, OrderRec>();
const byBuyer = new Map<string, number[]>();
let cardCount = 0;
let orderCount = 0;
let refusalCount = 0;
const refusalRing: RefusalRec[] = [];
/** "<maker>:<card digest>" -> the card those tiers were flagged on; the same maker may not publish them again. */
const spentCards = new Map<string, string>();
const tally = new Map<string, bigint>();
const count = (name: string): bigint => tally.get(name) ?? 0n;
const add = (name: string, by: bigint | number): void => void tally.set(name, count(name) + BigInt(by));

const cardNumber = (raw: unknown): number => Number(/^C([1-9]\d{0,8})$/.exec(String(raw).trim())?.[1] ?? 0);
const orderNumber = (raw: unknown): number => Number(/^O([1-9]\d{0,8})$/.exec(String(raw).trim())?.[1] ?? 0);
const cardWord = (raw: unknown) => (cardNumber(raw) ? "C" + cardNumber(raw) : "(not a card id)");
const orderWord = (raw: unknown) => (orderNumber(raw) ? "O" + orderNumber(raw) : "(not an order id)");

const cardRow = (c: CardRec): Row => ({
  card: "C" + c.n, maker: c.maker, title: c.title, ladder: c.ladder,
  tiers: c.tiers.map((t) => ({ text: t.text, price: t.price.toString() })), top_price: c.top.toString(),
  bond: c.bond.toString(), bond_slice: c.slice.toString(), open: c.open, frozen: c.frozen, flags: c.flags, orders: c.orders.length,
  booked: c.booked, exact: c.exact, outside: c.outside, ambiguous: c.ambiguous, unclear: c.unclear, revised_to: c.revisedTo,
  revised_from: c.revisedFrom, past_flags: c.pastFlags, digest: c.digest, created_at: c.createdAt,
});

const orderRow = (o: OrderRec): Row => ({
  order: "O" + o.n, card: "C" + o.card, buyer: o.buyer, maker: o.maker, brief: o.brief, brief_digest: o.digest, outcome: o.outcome,
  mask: o.mask, tier: o.tier, price: o.price.toString(), paid: o.paid.toString(), refunded: o.refunded.toString(),
  bond_paid: o.bondPaid.toString(), status: o.status, line: o.line, at: o.at, settled_at: o.settledAt,
});

/**
 * A refusal that is remembered: no model is asked, the reason goes into a ring of the most recent
 * rows, and what was sent comes back in the same call.
 */
function refuse(c: Ctx, cardId: string, reason: string): Row {
  const known = cards.has(cardNumber(cardId)) ? cardId : "";
  const seq = ++refusalCount;
  refusalRing[(seq - 1) % REFUSALS_KEPT] = { seq, by: c.sender, card: known, reason, at: c.now };
  if (c.value > 0n) credit(c.sender, c.value);
  return { ok: false, reason, card: known, by: c.sender, recorded: true, returned: c.value.toString() };
}

// ---- the card's own text -------------------------------------------------------------

/** The tiers of a card, or the reason they are refused. */
function parseTiers(raw: unknown, ladder: string): Tier[] | string {
  let items: unknown;
  try {
    items = JSON.parse(String(raw));
  } catch {
    return `the tiers are a JSON list of ${L.MIN_TIERS} to ${L.MAX_TIERS} objects, each with a text and a price in atto, like [{"text": "...", "price": "2000000000000000000"}]`;
  }
  if (!Array.isArray(items)) return "the tiers are a JSON list of objects";
  if (items.length < L.MIN_TIERS || items.length > L.MAX_TIERS) return `a card has ${L.MIN_TIERS} to ${L.MAX_TIERS} tiers; this one has ${items.length}`;
  const out: Tier[] = [];
  for (let k = 0; k < items.length; k++) {
    const item = items[k];
    const where = "tier " + (k + 1);
    if (!item || typeof item !== "object" || Array.isArray(item)) return `${where} is an object with a text and a price`;
    const o = item as Row;
    const text = tidy(o.text ?? "");
    const problem = textProblem(text, L.MIN_TIER, L.MAX_TIER, "the text of " + where);
    if (problem) return problem;
    const price = whole(o.price ?? "");
    if (price < 1n) return `the price of ${where} is a whole number of atto greater than zero, written in digits`;
    const twin = out.findIndex((t) => norm(t.text) === norm(text));
    if (twin >= 0) return `${where} says the same words as tier ${twin + 1}`;
    if (ladder === "1" && out.length && price <= out[out.length - 1].price)
      return `on a ladder card each tier costs more than the one before it, because a brief is booked at the narrowest tier that covers it; ${where} does not cost more than tier ${k}`;
    out.push({ text, price });
  }
  return out;
}

const LADDER_PROBLEM =
  'the ladder is "1" when the tiers are nested from the narrowest to the broadest in the order given, and "0" when they are meant not to overlap';

/** The identity of what a card promises: its ladder flag, and each tier's words and price, in order. */
const cardDigest = (ladder: string, tiers: Tier[]) => sha256([ladder, ...tiers.map((t) => norm(t.text) + "|" + t.price)].join("||"));
const spentProblem = (maker: string, digest: string): string => {
  const on = spentCards.get(maker + ":" + digest);
  return on ? `these tiers were found to overlap on ${on}; the same tiers may not be published again by the same maker` : "";
};

function newCard(
  maker: string, title: string, tiers: Tier[], ladder: "0" | "1", digest: string, bond: bigint, slice: bigint, revisedFrom: string,
  pastFlags: number, now: number,
): CardRec {
  const n = ++cardCount;
  const top = tiers.reduce((m, t) => (t.price > m ? t.price : m), 0n);
  const c: CardRec = {
    n, maker, title, ladder, tiers, top, bond, slice, open: true, frozen: false, flags: [], orders: [], quoted: new Map(), booked: 0,
    exact: 0, outside: 0, ambiguous: 0, unclear: 0, revisedTo: "", revisedFrom, pastFlags, digest, createdAt: now,
  };
  cards.set(n, c);
  return c;
}

// ---- the scripted stand-in for the consensus round --------------------------------------

const STOP = new Set(["about", "there", "their", "which", "would", "could", "should", "these", "those", "within", "words", "other", "every", "under", "after", "before"]);
const keywords = (text: string): string[] =>
  Array.from(new Set(norm(text).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length >= 5 && !STOP.has(w))));

/**
 * The briefs of the seeded orders are not among the example briefs (a visitor must be free to ask
 * those), so their scripted answers are written here, by normalised text.
 */
const SEEDED_BRIEFS = {
  hostel:
    "Our hostel's house rules run to about 1,200 words in English. We need them in Spanish for the summer season, any time in the next three weeks.",
  conference: "Please interpret live at our two-day conference in Valencia, English to Spanish, with a booth and headsets for 200 people.",
  agreement: "A 900-word supplier agreement in English that I must send to our partner in Spanish within 48 hours. It is plain text.",
  lesson: "One 45-minute online lesson for my son on simultaneous equations, this weekend if possible.",
  vague: "Some maths help for my child, a few times maybe, we will see how it goes and what turns out to be needed.",
  cookbook: "I need a full-colour illustration for the front cover of my cookbook: a table of late-summer vegetables seen from above.",
};
const SEEDED_MASKS: Record<string, string> = {
  [norm(SEEDED_BRIEFS.hostel)]: "0100",
  [norm(SEEDED_BRIEFS.conference)]: "0000",
  [norm(SEEDED_BRIEFS.agreement)]: "0001",
  [norm(SEEDED_BRIEFS.lesson)]: "111",
  [norm(SEEDED_BRIEFS.vague)]: "?",
  [norm(SEEDED_BRIEFS.cookbook)]: "011",
};

/**
 * Which tiers cover the whole brief, as the stored value: one character per tier in published
 * order, or "?" when the two askings would differ. A real quote asks a model twice under two
 * letterings; this one looks the brief up among the example briefs written for the card, and for
 * any other text falls back to counting the tier's own words inside the brief.
 */
function scriptedMask(c: CardRec, brief: string): string {
  const seededMask = SEEDED_MASKS[norm(brief)];
  if (seededMask) return seededMask;
  const example: ExampleCard | null = exampleFor(c.tiers.map((t) => t.text));
  const known = example?.briefs.find((b) => norm(b.brief) === norm(brief));
  if (known) {
    if (known.covers === "?") return "?";
    const covers = known.covers;
    return c.tiers.map((_, i) => (covers.includes(i + 1) ? "1" : "0")).join("");
  }
  const text = norm(brief);
  const words = new Set(keywords(brief));
  const bits = c.tiers.map((t) => {
    if (text.includes(norm(t.text))) return true;
    const mine = keywords(t.text);
    const shared = mine.filter((w) => words.has(w)).length;
    return mine.length > 0 && shared >= Math.max(3, Math.ceil(mine.length * 0.6));
  });
  // On a ladder every broader tier contains the narrower ones.
  if (c.ladder === "1") for (let i = 1; i < bits.length; i++) bits[i] = bits[i] || bits[i - 1];
  return bits.map((b) => (b ? "1" : "0")).join("");
}

type Reading = { outcome: "exact" | "outside" | "ambiguous" | "unclear"; tier: number; pair: string; shape: string };

/** The outcome the contract computes in code from the agreed mask. */
function readMask(c: CardRec, mask: string): Reading {
  if (mask === "?") return { outcome: "unclear", tier: 0, pair: "", shape: "differ" };
  const on = mask.split("").flatMap((ch, i) => (ch === "1" ? [i + 1] : []));
  if (on.length === 0) return { outcome: "outside", tier: 0, pair: "", shape: "" };
  if (c.ladder === "0") {
    if (on.length === 1) return { outcome: "exact", tier: on[0], pair: "", shape: "" };
    return { outcome: "ambiguous", tier: 0, pair: `${on[0]}:${on[1]}`, shape: "" };
  }
  const k = c.tiers.length;
  const unbroken = on[on.length - 1] === k && on.every((n, i) => n === on[0] + i);
  if (!unbroken) return { outcome: "unclear", tier: 0, pair: "", shape: "broken" };
  return { outcome: "exact", tier: on[0], pair: "", shape: "" };
}

/** The published sentence, composed from the contract's own closed phrases and its own numbers. */
function lineFor(c: CardRec, r: Reading, mask: string, sentBack: bigint): string {
  const total = c.tiers.length;
  const rest = sentBack > 0n ? "and the rest of the payment was sent back" : "and that is the whole payment, so nothing was left to send back";
  if (r.outcome === "exact" && c.ladder === "1") {
    if (r.tier === total)
      return `Only tier ${r.tier}, the broadest tier of this ladder card, covers the whole brief, so its price is held for the maker ${rest}.`;
    return `Tiers ${r.tier} to ${total} of this ladder card cover the whole brief, so the order is booked at the narrowest of them, tier ${r.tier}: its price is held for the maker ${rest}.`;
  }
  if (r.outcome === "exact") return `Tier ${r.tier} of ${total} covers the whole brief and no other tier does, so its price is held for the maker ${rest}.`;
  if (r.outcome === "outside") return "No tier of this card covers the whole brief, so nothing is booked and the whole payment was sent back.";
  if (r.outcome === "ambiguous") {
    const [one, two] = r.pair.split(":");
    return `Tiers ${one} and ${two} of this card both cover the whole brief, and the maker published them as tiers that do not overlap, so nothing is booked, the whole payment was sent back with a slice of the maker's bond, and the card takes no new brief until the maker revises it.`;
  }
  if (mask === "?")
    return "The two readings of this brief, made with the tiers in two different orders, did not name the same tiers, so nothing is booked, the whole payment was sent back and this brief is spent on this card.";
  return "The tiers read as covering this brief are not an unbroken run up to the broadest tier, which is what a ladder card promises, so nothing is booked, the whole payment was sent back and this brief is spent on this card.";
}

// ---- the methods that write ----------------------------------------------------------

type Ctx = { sender: string; value: bigint; now: number };

const movedTo = (c: CardRec) => (c.revisedTo ? "; it was revised to " + c.revisedTo : "");

async function publishCard(c: Ctx, title: string, tiersJson: string, ladder: string): Promise<Row> {
  const name = tidy(title);
  const rung = String(ladder).trim();
  let problem = textProblem(name, L.MIN_TITLE, L.MAX_TITLE, "the title");
  if (!problem && rung !== "0" && rung !== "1") problem = LADDER_PROBLEM;
  const tiers = problem ? [] : parseTiers(tiersJson, rung);
  if (typeof tiers === "string") problem = tiers;
  if (!problem && c.value < L.MIN_BOND)
    problem = `the ambiguity bond is the value sent with the card, and it is at least ${L.MIN_BOND} atto, which is one GEN`;
  const digest = problem || typeof tiers === "string" ? "" : await cardDigest(rung, tiers);
  if (!problem) problem = spentProblem(c.sender, digest);
  if (problem || typeof tiers === "string") return refuse(c, "", problem);
  const card = newCard(c.sender, name, tiers, rung as "0" | "1", digest, c.value, c.value / BOND_SLICES, "", 0, c.now);
  add("held_bonds", c.value);
  add("open_cards", 1);
  return {
    ok: true, card: "C" + card.n, maker: c.sender, tiers: tiers.length, top_price: card.top.toString(), bond: card.bond.toString(),
    bond_slice: card.slice.toString(), ladder: rung,
  };
}

async function reviseCard(c: Ctx, cardId: string, title: string, tiersJson: string, ladder: string): Promise<Row> {
  const old = cards.get(cardNumber(cardId)) ?? fail("no card " + cardWord(cardId));
  const id = "C" + old.n;
  if (c.sender !== old.maker) fail(`only the maker of ${id} may revise it`);
  if (!old.open) fail(`${id} is closed${movedTo(old)}`);
  const name = tidy(title);
  const rung = String(ladder).trim();
  const problem = textProblem(name, L.MIN_TITLE, L.MAX_TITLE, "the title");
  if (problem) fail(problem);
  if (rung !== "0" && rung !== "1") fail('the ladder is "1" for nested tiers and "0" for tiers that are meant not to overlap');
  const tiers = parseTiers(tiersJson, rung);
  if (typeof tiers === "string") return fail(tiers);
  const digest = await cardDigest(rung, tiers);
  if (digest === old.digest) fail(`a revision changes the tiers; these are the tiers ${id} already has, word for word and price for price`);
  const spent = spentProblem(c.sender, digest);
  if (spent) fail(spent);
  if (old.bond < old.slice || old.bond < 1n)
    fail(`the bond left on ${id} is ${old.bond} atto, less than one slice of ${old.slice}; close this card and publish a new one with a fresh bond`);
  const fresh = newCard(c.sender, name, tiers, rung as "0" | "1", digest, old.bond, old.slice, id, old.pastFlags + old.flags.length, c.now);
  if (old.frozen) add("frozen_cards", -1);
  add("revisions", 1);
  old.open = false;
  old.bond = 0n;
  old.revisedTo = "C" + fresh.n;
  return {
    ok: true, card: "C" + fresh.n, revised_from: id, maker: c.sender, tiers: tiers.length, top_price: fresh.top.toString(),
    bond: fresh.bond.toString(), bond_slice: fresh.slice.toString(), ladder: rung, past_flags: fresh.pastFlags,
  };
}

async function closeCard(c: Ctx, cardId: string): Promise<Row> {
  const card = cards.get(cardNumber(cardId)) ?? fail("no card " + cardWord(cardId));
  const id = "C" + card.n;
  if (c.sender !== card.maker) fail(`only the maker of ${id} may close it`);
  if (!card.open) fail(`${id} is already closed${movedTo(card)}`);
  if (card.booked > 0) fail(`${id} has ${card.booked} booked order(s); accept or decline each one before closing the card`);
  const back = card.bond;
  card.bond = 0n;
  card.open = false;
  add("held_bonds", -back);
  add("open_cards", -1);
  if (card.frozen) add("frozen_cards", -1);
  if (back > 0n) credit(c.sender, back);
  return { ok: true, card: id, open: false, returned: back.toString(), to: c.sender };
}

async function quote(c: Ctx, cardRaw: string, brief: string): Promise<Row> {
  const cardId = String(cardRaw).trim();
  const card = cards.get(cardNumber(cardId));
  if (!card) return refuse(c, "", "no card " + cardWord(cardId));
  const id = "C" + card.n;
  if (c.sender === card.maker) return refuse(c, id, `the maker of ${id} may not quote their own card`);
  if (!card.open) return refuse(c, id, `${id} is closed and takes no brief${movedTo(card)}`);
  if (card.frozen)
    return refuse(c, id, `${id} is frozen: two of its tiers were found to overlap, and it takes no brief until its maker publishes a revised card`);
  if (c.value !== card.top)
    return refuse(c, id, `a quote on ${id} is sent with exactly its top price, ${card.top} atto; whatever the brief does not need comes back in the same transaction`);
  const text = tidy(brief);
  const problem = textProblem(text, L.MIN_BRIEF, L.MAX_BRIEF, "the brief");
  if (problem) return refuse(c, id, problem);
  const digest = await digestOf(text);
  const seen = card.quoted.get(digest);
  if (seen) return refuse(c, id, `this brief was already judged on ${id} as ${seen}; a brief is judged once on a card and its outcome is final`);

  const mask = scriptedMask(card, text);
  const r = readMask(card, mask);
  const price = r.outcome === "exact" ? card.tiers[r.tier - 1].price : 0n;
  const bondPaid = r.outcome === "ambiguous" ? (card.slice < card.bond ? card.slice : card.bond) : 0n;
  const refunded = c.value - price;
  const status = r.outcome === "exact" ? "booked" : "refunded";
  const n = ++orderCount;
  const orderId = "O" + n;
  const line = lineFor(card, r, mask, refunded);
  orders.set(n, {
    n, card: card.n, buyer: c.sender, maker: card.maker, brief: text, digest, outcome: r.outcome, mask, tier: r.tier, price, paid: c.value,
    refunded, bondPaid, status, line, at: c.now, settledAt: r.outcome === "exact" ? 0 : c.now,
  });
  card.quoted.set(digest, orderId);
  card.orders.push(n);
  card[r.outcome] += 1;
  byBuyer.set(c.sender, [...(byBuyer.get(c.sender) ?? []), n]);
  add(r.outcome, 1);
  if (r.outcome === "exact") {
    card.booked += 1;
    add("held_escrow", price);
  }
  if (r.outcome === "ambiguous") {
    card.frozen = true;
    card.flags = [...card.flags, r.pair];
    card.bond -= bondPaid;
    spentCards.set(card.maker + ":" + card.digest, id);
    add("held_bonds", -bondPaid);
    add("bond_paid_out", bondPaid);
    add("frozen_cards", 1);
    add("flags", 1);
  }
  if (refunded + bondPaid > 0n) credit(c.sender, refunded + bondPaid);
  return {
    ok: true, order: orderId, card: id, outcome: r.outcome, mask, tier: r.tier, price: price.toString(), refunded: refunded.toString(),
    bond_paid: bondPaid.toString(), status, line,
  };
}

/** accept, decline and cancel: one booked order leaves escrow, to the maker or back to the buyer. */
async function settle(c: Ctx, orderRaw: string, how: "accepted" | "declined" | "cancelled"): Promise<Row> {
  const o = orders.get(orderNumber(String(orderRaw).trim())) ?? fail("no order " + orderWord(orderRaw));
  const id = "O" + o.n;
  if (o.status !== "booked") fail(`${id} is ${o.status}, not booked; nothing is held on it`);
  if (how === "cancelled" && c.sender !== o.buyer) fail(`only the buyer who placed ${id} may cancel it`);
  if (how !== "cancelled" && c.sender !== o.maker) fail(`only the maker of C${o.card} may ${how === "accepted" ? "accept" : "decline"} ${id}`);
  o.status = how;
  o.settledAt = c.now;
  const card = cards.get(o.card);
  if (card && card.booked > 0) card.booked -= 1;
  add("held_escrow", -o.price);
  add(how, 1);
  if (how === "accepted") add("paid_to_makers", o.price);
  const to = how === "accepted" ? o.maker : o.buyer;
  if (o.price > 0n) credit(to, o.price);
  return { ok: true, order: id, card: "C" + o.card, status: how, paid: o.price.toString(), to };
}

async function run(fn: WriteFn, args: (string | number)[], c: Ctx): Promise<Row> {
  const a = args.map((x) => String(x));
  switch (fn) {
    case "publish_card": return publishCard(c, a[0], a[1], a[2] ?? "");
    case "quote": return quote(c, a[0], a[1] ?? "");
    case "accept": return settle(c, a[0], "accepted");
    case "decline": return settle(c, a[0], "declined");
    case "cancel": return settle(c, a[0], "cancelled");
    case "revise_card": return reviseCard(c, a[0], a[1], a[2], a[3] ?? "");
    case "close_card": return closeCard(c, a[0]);
  }
}

// ---- the demo content ----------------------------------------------------------------

const HOUR = 3600;
const DAY = 86400;

let seeded: Promise<void> | null = null;
function ready(): Promise<void> {
  if (!seeded) seeded = seed();
  return seeded;
}

const toAtto = (genText: string): bigint => {
  const [w, f = ""] = genText.split(".");
  return BigInt(w) * GEN + BigInt((f + "0".repeat(18)).slice(0, 18));
};
const tiersOf = (e: ExampleCard) => JSON.stringify(e.tiers.map((t) => ({ text: t.text, price: toAtto(t.price).toString() })));

async function seed(): Promise<void> {
  const t0 = clockNow();
  // Every seeded call pays like a real one: what it sends leaves the sender's demo balance first.
  const paying = (sender: string, value: bigint, now: number): Ctx => {
    balances.set(sender, balance(sender) - value);
    return { sender, value, now };
  };
  const publish = (who: string, e: ExampleCard, now: number) =>
    publishCard(paying(who, toAtto(e.bond), now), e.title, tiersOf(e), e.ladder ? "1" : "0");
  const ask = (who: string, cardId: string, brief: string, now: number) =>
    quote(paying(who, cards.get(cardNumber(cardId))?.top ?? 0n, now), cardId, brief);

  await publish(TRANSLATOR_AT, TRANSLATOR, t0 - 6 * DAY);
  await publish(COPYWRITER_AT, COPYWRITER, t0 - 5 * DAY);
  await publish(TUTOR_AT, TUTOR, t0 - 4 * DAY);
  await publish(ILLUSTRATOR_AT, ILLUSTRATOR_FLAWED, t0 - 3 * DAY);

  // C1: one order priced and accepted, one brief outside the card, one priced and waiting for the maker.
  await ask(OTHER_BUYER, "C1", SEEDED_BRIEFS.hostel, t0 - 5 * DAY + 2 * HOUR);
  await settle({ sender: TRANSLATOR_AT, value: 0n, now: t0 - 5 * DAY + 5 * HOUR }, "O1", "accepted");
  await ask(OTHER_BUYER, "C1", SEEDED_BRIEFS.conference, t0 - 4 * DAY);
  await ask(BUYER, "C1", SEEDED_BRIEFS.agreement, t0 - 3 * HOUR);
  // C3, a ladder: one lesson is covered by every tier and the narrowest sets the price; a vague brief fixes nothing.
  await ask(OTHER_BUYER, "C3", SEEDED_BRIEFS.lesson, t0 - 2 * DAY);
  await ask(OTHER_BUYER, "C3", SEEDED_BRIEFS.vague, t0 - 30 * HOUR);
  // C4: a book cover is covered by the cover tier and by the "any subject" tier, so the card froze.
  await ask(OTHER_BUYER, "C4", SEEDED_BRIEFS.cookbook, t0 - 26 * HOUR);
}

// ---- views, in the contract's JSON shapes -------------------------------------------

const newest = (ids: number[], count: number): number[] => ids.slice(-count).reverse();

export async function view(fn: string, args: (string | number)[]): Promise<unknown> {
  await ready();
  await delay(90);
  const a = args.map((x) => String(x).trim());
  switch (fn) {
    case "cards": {
      const rows = newest([...cards.keys()], PAGE).map((n) => cardRow(cards.get(n)!));
      return JSON.stringify(rows);
    }
    case "cards_from": {
      // From a given card number downwards, newest first; "6" or "C6".
      const top = Math.min(Number(whole((a[0] ?? "").replace(/^C/, ""))), cardCount);
      const rows = [];
      for (let n = top; n > Math.max(0, top - PAGE); n--) rows.push(cardRow(cards.get(n)!));
      return JSON.stringify(rows);
    }
    case "card": {
      const c = cards.get(cardNumber(a[0]));
      return JSON.stringify(c ? cardRow(c) : { error: "no card " + cardWord(a[0]) });
    }
    case "order": {
      const o = orders.get(orderNumber(a[0]));
      return JSON.stringify(o ? orderRow(o) : { error: "no order " + orderWord(a[0]) });
    }
    case "orders_of": {
      const c = cards.get(cardNumber(a[0]));
      return JSON.stringify(newest(c?.orders ?? [], IDS_PAGE).map((n) => "O" + n));
    }
    case "orders_by":
      return JSON.stringify(newest(byBuyer.get((a[0] ?? "").toLowerCase()) ?? [], IDS_PAGE).map((n) => "O" + n));
    case "ledger": {
      // At most one page, whatever is asked for.
      const asked = Number(whole(a[0] ?? ""));
      const want = asked < 1 || asked > PAGE ? PAGE : asked;
      return JSON.stringify(newest([...orders.keys()], want).map((n) => orderRow(orders.get(n)!)));
    }
    case "refusals":
      return JSON.stringify(refusalRing.filter(Boolean).sort((x, y) => y.seq - x.seq));
    case "stats": {
      const names = ["exact", "outside", "ambiguous", "unclear", "accepted", "declined", "cancelled", "open_cards", "frozen_cards", "flags", "revisions"];
      const out: Row = { cards: cardCount, orders: orderCount, refusals: refusalCount };
      for (const name of names) out[name] = Number(count(name));
      out.booked = Number(count("exact") - count("accepted") - count("declined") - count("cancelled"));
      for (const name of ["held_bonds", "held_escrow", "paid_to_makers", "bond_paid_out"]) out[name] = count(name).toString();
      return JSON.stringify(out);
    }
    case "rule":
      return JSON.stringify({
        ...RULE,
        caps: {
          title: [L.MIN_TITLE, L.MAX_TITLE], tiers: [L.MIN_TIERS, L.MAX_TIERS], tier_text: [L.MIN_TIER, L.MAX_TIER],
          brief: [L.MIN_BRIEF, L.MAX_BRIEF], min_bond: L.MIN_BOND.toString(), bond_slices: Number(BOND_SLICES), page: PAGE,
          ids_page: IDS_PAGE, refusals_kept: REFUSALS_KEPT,
        },
      });
    case "standing": {
      const c = cards.get(cardNumber(a[0]));
      if (!c)
        return JSON.stringify({
          card: cardWord(a[0]), exists: false, open: false, frozen: false, flags: [], clean: false, maker: "", revised_to: "", past_flags: 0,
        });
      return JSON.stringify({
        card: "C" + c.n, exists: true, open: c.open, frozen: c.frozen, flags: c.flags, clean: c.open && !c.frozen && c.flags.length === 0,
        maker: c.maker, revised_to: c.revisedTo, past_flags: c.pastFlags,
      });
    }
    default:
      throw new Error("the mock has no view " + fn);
  }
}

// ---- transactions ----------------------------------------------------------------------

const pending = new Map<string, { fn: string; polls: number; result: Row; error: string }>();
let txCount = 0;
const fakeHash = () => "0x" + (++txCount).toString(16).padStart(8, "0") + "b4ac".repeat(14);

export async function write(fn: WriteFn, args: (string | number)[], value: bigint): Promise<string> {
  await ready();
  await delay(250);
  const sender = persona.toLowerCase();
  if (value > balance(sender)) throw new Error("insufficient funds for this demo account");
  if (value > 0n) credit(sender, -value);
  let result: Row = {};
  let error = "";
  try {
    result = await run(fn, args, { sender, value, now: clockNow() });
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    // A raised refusal changes nothing, returns what was sent, and leaves its sentence in the receipt.
    if (value > 0n) credit(sender, value);
    error = e.message;
  }
  const hash = fakeHash();
  pending.set(hash, { fn, polls: 0, result, error });
  return hash;
}

export async function deploy(): Promise<string> {
  await delay(250);
  const hash = fakeHash();
  pending.set(hash, { fn: "deploy", polls: 0, result: {}, error: "" });
  return hash;
}

const STAGES = ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "FINALIZED"];
const NO_VOTES = { agree: 0, disagree: 0, idle: 0 };

export async function txStatus(hash: string): Promise<TxStatus> {
  await delay(60);
  const p = pending.get(hash);
  if (!p) return { status: "UNKNOWN", votes: NO_VOTES, applied: null, undetermined: false, exec: null, result: null, message: "" };
  p.polls += 1;
  // As on Studio, the result can be read from ACCEPTED on, one stage before FINALIZED.
  const done = p.polls >= STAGES.length - 1;
  // Studio assigns five validators and one is often idle in a round; the mock shows the same shape.
  const agree = p.fn === "quote" ? Math.min(p.polls, 4) : done ? 4 : 0;
  return {
    status: STAGES[Math.min(p.polls - 1, STAGES.length - 1)],
    votes: { agree, disagree: 0, idle: 5 - agree },
    applied: done ? true : null,
    undetermined: false,
    exec: done ? (p.error ? "ERROR" : "SUCCESS") : null,
    result: done && !p.error ? p.result : null,
    message: done ? p.error || JSON.stringify(p.result) : "",
  };
}

export async function balanceOf(address: string): Promise<bigint> {
  await delay(40);
  return balance(address);
}

export async function faucet(address: string): Promise<bigint> {
  await delay(600);
  credit(address, 10n * GEN);
  return balance(address);
}
