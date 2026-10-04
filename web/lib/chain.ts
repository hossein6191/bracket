// Chain access for Bracket: the ONE file that knows the contract's interface.
//
// Every method name, argument order, view shape and outcome token of the contract that the site
// depends on is written here and nowhere else. Pages import typed reads, typed call builders and
// mapped outcomes from this module; when the contract's interface changes, this is the file to
// edit (and lib/chain-mock.ts, which stands in for the contract in mock mode and answers in the
// contract's own JSON shapes, so the mappers below run in both modes).
//
// Real implementation: genlayer-js against GenLayer Studio (chain 61999).
// Mock implementation (NEXT_PUBLIC_MOCK=1): lib/chain-mock.ts, an in-memory stand-in.
//
// Reads go through readContract (gen_call) with the retry policy in lib/rpc.ts: eight tries
// over about forty seconds, because Studio answers "Contract not found" for a healthy contract
// for about a minute after a deploy. A failed read is never "no data" and never proof that a
// write failed. Studio allows 30 gen_call a minute from one browser (the faucet shares them),
// so every view answer is cached for 30 s, two components asking for the same view share one
// request, and invalidateReads() drops the cache once a transaction is final. A read call
// fails once its encoded calldata passes 256 bytes, so every view here takes ids, counts and
// addresses only.

import * as mock from "./chain-mock";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress, type Address } from "viem";
import { registerOverride, siteRegister } from "./register";
import {
  RATE_LIMITED,
  createReadCache,
  decodeTx,
  isMissingMethodError,
  noteFailure,
  rpc,
  sleep,
  waitForCooldown,
  withRetry,
  type RawTx,
} from "./rpc";
import { getChainId, getSigner, chainName } from "./wallet";

export { RATE_LIMITED, cooldownRemainingMs, waitForCooldown } from "./rpc";

export const CHAIN_ID = 61999;
export const CHAIN_ID_HEX = "0xf22f";
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

/** The file /deploy serves and deploys: a byte copy of the repository's contract (tools/sync-contract.mjs). */
export const CONTRACT_SOURCE_PATH = "/contracts/bracket.py";
export const CONTRACT_FILE = "contracts/bracket.py";

export const isMock = process.env.NEXT_PUBLIC_MOCK === "1";
/** The contract in use: this browser's choice from /deploy first, then the site's default. */
export const contractAddress = (): string => registerOverride() || siteRegister();

export const NETWORK_ERROR = "could not reach the network";
/** Thrown by reads when the site has no contract address yet. */
export const NO_REGISTER = "no contract is configured yet";
/** What the faucet says when Studio refused sim_fundAccount three times. */
export const FAUCET_REFUSED =
  "Studio refused the faucet request (it allows 30 requests a minute from one browser). Try again in a minute.";

// ---- the contract's closed vocabulary ---------------------------------------

/** The caps written into the contract. The live values come from rule() through readRule(). */
export type Limits = {
  title: [number, number];
  tiers: [number, number];
  tierText: [number, number];
  brief: [number, number];
  /** the least ambiguity bond a card may be published with, in atto */
  minBondAtto: string;
  /** one brief covered twice pays its buyer the bond the card was published with, divided by this */
  bondSlices: number;
  /** the most rows one page of cards or of the ledger carries */
  page: number;
};

export const LIMITS: Limits = {
  title: [4, 60],
  tiers: [2, 4],
  tierText: [20, 240],
  brief: [20, 1200],
  minBondAtto: (10n ** 18n).toString(),
  bondSlices: 4,
  page: 24,
};

export type Outcome = "exact" | "outside" | "ambiguous" | "unclear" | "";
export const OUTCOMES: Outcome[] = ["exact", "outside", "ambiguous", "unclear"];
export type OrderStatus = "booked" | "accepted" | "declined" | "cancelled" | "refunded" | "";
export const STATUSES: OrderStatus[] = ["booked", "accepted", "declined", "cancelled", "refunded"];

/** The typographic characters a keyboard or a phone puts in by itself, and the plain ones the contract turns them into. */
const TYPOGRAPHIC: [string, string][] = [
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u201c", '"'],
  ["\u201d", '"'],
  ["\u2013", "-"],
  ["\u2014", "-"],
  ["\u2026", "..."],
  ["\u00a0", " "],
];

/**
 * The characters Python's str.split() breaks on (str.isspace()), which is what the contract's tidy
 * uses. JS \s differs: it also takes U+FEFF, and it misses \x1c-\x1f and \x85.
 */
export const PY_SPACE = /[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;

/**
 * A text as the contract measures, stores and judges it: typographic quotes, dashes and the
 * ellipsis made plain, and every run of whitespace, line breaks included, turned into one space.
 */
export function tidy(text: string): string {
  let t = String(text ?? "");
  for (const [fancy, plain] of TYPOGRAPHIC) t = t.split(fancy).join(plain);
  return t.split(PY_SPACE).filter(Boolean).join(" ");
}

/**
 * Why the contract would refuse a title, a tier or a brief, as a sentence; "" when it may be sent.
 * The contract keeps plain printable ASCII on one line, inside its cap, with no angle bracket.
 */
export function textProblem(text: string, [least, most]: [number, number], what: string): string {
  const t = tidy(text);
  if (t.length < least || t.length > most) return `${what} is ${least} to ${most} characters (this one is ${t.length}).`;
  for (const ch of t) {
    if (ch === "<" || ch === ">") return `${what} may not contain < or >; write the comparison in words.`;
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126)
      return `${what} is plain keyboard characters only: unaccented Latin letters, digits and common punctuation. "${ch}" is not one of them.`;
  }
  return "";
}

// ---- types the pages use -----------------------------------------------------

export type Tier = { text: string; priceAtto: string };

export type Card = {
  id: string; // "C1"
  maker: string;
  title: string;
  /** true when the tiers are nested from narrowest to broadest in the order given */
  ladder: boolean;
  tiers: Tier[];
  /** what a buyer sends with a quote: the dearest tier's price */
  topPriceAtto: string;
  /** what is left of the ambiguity bond */
  bondAtto: string;
  /** what one ambiguous brief pays its buyer out of the bond */
  bondSliceAtto: string;
  open: boolean;
  frozen: boolean;
  /** the tier pairs found to overlap, as "1:2" (counted from 1) */
  flags: string[];
  orders: number;
  exact: number;
  outside: number;
  ambiguous: number;
  unclear: number;
  /** orders whose price is in escrow now, waiting for the maker or the buyer */
  booked: number;
  /** the card that replaced this one, "" when none */
  revisedTo: string;
  /** the card this one replaced, "" when none */
  revisedFrom: string;
  /** flags raised on the cards this one descends from */
  pastFlags: number;
  createdAt: number;
};

export type CardList = { count: number; rows: Card[] };

export type Order = {
  id: string; // "O1"
  card: string;
  buyer: string;
  maker: string;
  brief: string;
  briefDigest: string;
  outcome: Outcome;
  /** one character per tier in published order, "1" when the tier covers the whole brief; "?" when the two askings differed */
  mask: string;
  /** the tier that sets the price, counted from 1; 0 when none */
  tier: number;
  priceAtto: string;
  paidAtto: string;
  refundedAtto: string;
  bondPaidAtto: string;
  status: OrderStatus;
  /** the sentence the contract wrote from its closed tokens */
  line: string;
  at: number;
  settledAt: number;
};

export type Standing = { card: string; exists: boolean; open: boolean; frozen: boolean; flags: string[]; clean: boolean };

/** rule(): the agreement rule as the contract words it, part by part, and the caps it enforces. */
export type Rule = { sections: { title: string; text: string }[]; limits: Limits };

/** A refusal that asked no model: who called, on which card, and the contract's reason. */
export type Refusal = { seq: number; by: string; card: string; reason: string; at: number };

/** stats(): whatever counters the contract publishes, in its own order. */
export type Stats = { entries: { key: string; value: string }[] };

export type Votes = { agree: number; disagree: number; idle: number };
export type TxStatus = {
  status: string; // PENDING | PROPOSING | COMMITTING | REVEALING | ACCEPTED | FINALIZED | CANCELED | UNKNOWN
  votes: Votes;
  applied: boolean | null; // null until votes exist
  undetermined: boolean; // finished with no majority: nothing was stored
  exec: string | null; // SUCCESS | ERROR | null
  result: Record<string, unknown> | null; // the contract's JSON return, if any
  message: string; // raw decoded return / error text
};

export type ReadResult<T> = { data: T; source: "chain" | "mock" };

// ---- ids ----------------------------------------------------------------------

const CARD_RE = /^C?([1-9]\d{0,8})$/i;
const ORDER_RE = /^O?([1-9]\d{0,8})$/i;

/** "C3" from "C3", "c3" or "3"; "" for anything else. */
export function parseCardId(raw: string): string {
  let text = "";
  try {
    text = decodeURIComponent(raw ?? "").trim();
  } catch {
    return "";
  }
  const m = CARD_RE.exec(text);
  return m ? "C" + m[1] : "";
}

/** "O7" from "O7", "o7" or "7"; "" for anything else. */
export function parseOrderId(raw: string): string {
  let text = "";
  try {
    text = decodeURIComponent(raw ?? "").trim();
  } catch {
    return "";
  }
  const m = ORDER_RE.exec(text);
  return m ? "O" + m[1] : "";
}

export const cardPath = (id: string) => `/card/${id}`;
export const orderPath = (id: string) => `/order/${id}`;
/** The number inside an id: 3 for "C3" and for "O3"; 0 when there is none. */
export const idNumber = (id: string): number => Number(/(\d+)$/.exec(id)?.[1] ?? 0);

// ---- low-level view access --------------------------------------------------

// The SDK's studionet object carries another explorer URL; the RPC and explorer hosts are set here.
const studio = {
  ...studionet,
  rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "GenLayer Studio Explorer", url: EXPLORER_URL } },
};

const reader = () => createClient({ chain: studio });

type Row = Record<string, unknown>;
type Arg = string | number;

const num = (v: unknown, dflt = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : dflt;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return dflt;
};
const str = (v: unknown, dflt = ""): string => (v === undefined || v === null ? dflt : String(v));
const atto = (v: unknown): string => {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isFinite(v) ? BigInt(Math.trunc(v)).toString() : "0";
  const s = str(v, "0").trim();
  return /^\d+$/.test(s) ? s : "0";
};
const bool = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";
const addr = (v: unknown): string => str(v).toLowerCase();
/** Seconds; a contract writes -1 or 0 when a call had no readable clock. */
const secs = (v: unknown): number => Math.max(0, num(v));

/** A view returns a JSON string; parse it. Some decoders already hand back the object. */
function parseView(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
const rowsOf = (v: unknown): Row[] => {
  const raw = typeof v === "string" ? parseView(v) : v;
  return (Array.isArray(raw) ? raw : [])
    .map((r) => (typeof r === "string" ? parseView(r) : r))
    .filter((r): r is Row => !!r && typeof r === "object" && !Array.isArray(r));
};
const asRow = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const strings = (v: unknown): string[] => {
  const raw = typeof v === "string" ? parseView(v) : v;
  return Array.isArray(raw) ? raw.filter((x) => typeof x === "string" || typeof x === "number").map((x) => String(x)) : [];
};
/** A list a view answered with: the list itself, or the list under the first of the given keys that holds one. */
const listOf = (v: unknown, keys: string[]): unknown[] | null => {
  if (Array.isArray(v)) return v;
  const o = asRow(v);
  for (const k of keys) if (Array.isArray(o[k])) return o[k] as unknown[];
  return null;
};

/** A view answered with nothing (an unknown id): null, "", {} or an {error} / {ok: false} / {exists: false} shape. */
const isEmptyRow = (v: unknown): boolean => {
  if (v === null || v === undefined || v === "" || v === "null") return true;
  if (typeof v !== "object") return true;
  if (Array.isArray(v)) return false;
  const o = v as Row;
  if (Object.keys(o).length === 0) return true;
  if ("error" in o) return true;
  if (o.ok === false || o.exists === false) return true;
  return false;
};

/** How long a view answer is reused. */
export const READ_TTL_MS = 30_000;
const onServer = typeof window === "undefined";
type Answer = { raw: unknown; at: number };
const views = createReadCache<Answer>(onServer ? 0 : READ_TTL_MS);

/** Forget every cached view answer. Called once a transaction is final or the faucet paid. */
export const invalidateReads = () => views.clear();

const viewKey = (address: string, fn: string, args: Arg[]) => `${address.toLowerCase()}|${fn}|${JSON.stringify(args)}`;

type ViewOptions = {
  /** drop the cached answer first, so this read is live */
  fresh?: boolean;
  /** read another contract than the one in use (the /deploy page probes a pasted address) */
  register?: string;
};

/**
 * One view call through the cache. Throws RATE_LIMITED when Studio is rate-limiting this
 * browser, NO_REGISTER when no contract is set, and the plain network error when Studio never
 * answered.
 */
async function view(fn: string, args: Arg[] = [], opts: ViewOptions = {}): Promise<unknown> {
  if (isMock) return parseView(await mock.view(fn, args));
  const address = opts.register || contractAddress();
  if (!address) throw new Error(NO_REGISTER);
  const key = viewKey(address, fn, args);
  if (opts.fresh) views.forget(key);
  try {
    const answer = await views.get(key, async () => {
      const raw = await withRetry(
        () => reader().readContract({ address: address as Address, functionName: fn, args }),
        // A contract with no such view is an answer, not flakiness: do not spend the bucket on it.
        { bucket: "gen", giveUp: isMissingMethodError },
      );
      return { raw, at: Date.now() };
    });
    return parseView(answer.raw);
  } catch (e) {
    if (e instanceof Error && e.message === RATE_LIMITED) throw e;
    throw new Error(NETWORK_ERROR);
  }
}

const SOURCE: ReadResult<unknown>["source"] = isMock ? "mock" : "chain";
const result = <T>(data: T): ReadResult<T> => ({ data, source: SOURCE });

// ---- row mappers (every missing field gets a default) ---------------------------

const outcomeOf = (v: unknown): Outcome => {
  const s = str(v) as Outcome;
  return OUTCOMES.includes(s) ? s : "";
};
const statusOf = (v: unknown): OrderStatus => {
  const s = str(v) as OrderStatus;
  return STATUSES.includes(s) ? s : "";
};
const ladderOf = (v: unknown): boolean => v === true || v === 1 || str(v).trim() === "1" || str(v).trim().toLowerCase() === "true";

const maxAtto = (values: string[]): string => values.reduce((top, v) => (BigInt(v) > BigInt(top) ? v : top), "0");

export function mapCard(r: Row, id = ""): Card {
  const tiers: Tier[] = rowsOf(r.tiers).map((t) => ({ text: str(t.text), priceAtto: atto(t.price) }));
  const frozen = bool(r.frozen);
  return {
    id: str(r.card ?? r.id ?? id),
    maker: addr(r.maker),
    title: str(r.title),
    ladder: ladderOf(r.ladder),
    tiers,
    topPriceAtto: r.top_price === undefined ? maxAtto(tiers.map((t) => t.priceAtto)) : atto(r.top_price),
    bondAtto: atto(r.bond),
    bondSliceAtto: atto(r.bond_slice),
    open: r.open === undefined ? true : bool(r.open),
    frozen,
    flags: strings(r.flags),
    orders: num(r.orders),
    exact: num(r.exact),
    outside: num(r.outside),
    ambiguous: num(r.ambiguous),
    unclear: num(r.unclear),
    booked: num(r.booked),
    revisedTo: str(r.revised_to),
    revisedFrom: str(r.revised_from),
    pastFlags: num(r.past_flags),
    createdAt: secs(r.created_at),
  };
}

export function mapOrder(r: Row, id = ""): Order {
  return {
    id: str(r.order ?? r.id ?? id),
    card: str(r.card),
    buyer: addr(r.buyer),
    maker: addr(r.maker),
    brief: str(r.brief),
    briefDigest: str(r.brief_digest),
    outcome: outcomeOf(r.outcome),
    mask: str(r.mask),
    tier: num(r.tier),
    priceAtto: atto(r.price),
    paidAtto: atto(r.paid),
    refundedAtto: atto(r.refunded),
    bondPaidAtto: atto(r.bond_paid),
    status: statusOf(r.status),
    line: str(r.line),
    at: secs(r.at),
    settledAt: secs(r.settled_at),
  };
}

const pair = (v: unknown, dflt: [number, number]): [number, number] =>
  Array.isArray(v) && v.length === 2 ? [num(v[0], dflt[0]), num(v[1], dflt[1])] : dflt;

const words = (key: string): string => {
  const t = key.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** rule(): every part the contract wrote in words, and the caps over the defaults above. */
export function mapRule(r: Row): Rule {
  const l = asRow(r.caps ?? r.limits);
  const sections: Rule["sections"] = [];
  for (const [key, v] of Object.entries(r)) {
    if (typeof v === "string" && v.trim()) sections.push({ title: words(key), text: v });
    else if (key !== "caps" && key !== "limits" && v && typeof v === "object" && !Array.isArray(v))
      for (const [k, x] of Object.entries(v as Row)) if (typeof x === "string" && x.trim()) sections.push({ title: `${words(key)}: ${k.replace(/_/g, " ")}`, text: x });
  }
  const minBond = atto(l.min_bond);
  return {
    sections,
    limits: {
      title: pair(l.title, LIMITS.title),
      tiers: pair(l.tiers, LIMITS.tiers),
      tierText: pair(l.tier_text, LIMITS.tierText),
      brief: pair(l.brief, LIMITS.brief),
      minBondAtto: minBond === "0" ? LIMITS.minBondAtto : minBond,
      bondSlices: Math.max(1, num(l.bond_slices, LIMITS.bondSlices)),
      page: Math.max(1, num(l.page, LIMITS.page)),
    },
  };
}

// ---- reads: one function per view ------------------------------------------------

const cardRows = (value: unknown): Card[] | null => {
  const list = listOf(value, ["rows", "cards"]);
  return list ? rowsOf(list).map((r) => mapCard(r)).filter((c) => c.id) : null;
};
const newestFirst = <T extends { id: string }>(rows: T[]): T[] => rows.slice().sort((a, b) => idNumber(b.id) - idNumber(a.id));

/** cards(): the 24 newest cards, newest first. `register` reads another contract (the /deploy probe). */
export async function readCards(register?: string, opts: { fresh?: boolean } = {}): Promise<ReadResult<CardList>> {
  const value = await view("cards", [], { register, fresh: opts.fresh });
  const rows = cardRows(value);
  // An address that is not a Bracket contract answers something else entirely.
  if (!rows) throw new Error(NETWORK_ERROR);
  const sorted = newestFirst(rows);
  return result({ count: num(asRow(value).count, sorted.length ? idNumber(sorted[0].id) : 0), rows: sorted });
}

/**
 * cards_from(start): one page of cards from card number `start` downwards, newest first. After
 * cards() the next page starts one below the lowest number shown. The number travels as text.
 */
export async function readCardsFrom(start: number): Promise<ReadResult<Card[]>> {
  if (start < 1) return result([]);
  const value = await view("cards_from", [String(Math.trunc(start))]);
  return result(newestFirst(cardRows(value) ?? []));
}

/** card(card): null when the contract holds no such card. */
export async function readCard(card: string, opts: { fresh?: boolean } = {}): Promise<ReadResult<Card | null>> {
  const value = await view("card", [card], opts);
  if (isEmptyRow(value)) return result(null);
  const c = mapCard(value as Row, card);
  return result(c.maker || c.tiers.length ? c : null);
}

/** order(order): null when the contract holds no such order. */
export async function readOrder(order: string, opts: { fresh?: boolean } = {}): Promise<ReadResult<Order | null>> {
  const value = await view("order", [order], opts);
  if (isEmptyRow(value)) return result(null);
  const o = mapOrder(value as Row, order);
  return result(o.card || o.buyer ? o : null);
}

/** orders_of(card): the ids of the card's last 50 orders, newest first. */
export async function readOrdersOf(card: string, opts: { fresh?: boolean } = {}): Promise<ReadResult<string[]>> {
  const value = await view("orders_of", [card], opts);
  return result(strings(listOf(value, ["orders", "rows", "ids"]) ?? []));
}

/** orders_by(address): the ids of the address's last 50 orders as a buyer, newest first. */
export async function readOrdersBy(address: string, opts: { fresh?: boolean } = {}): Promise<ReadResult<string[]>> {
  const value = await view("orders_by", [address.toLowerCase()], opts);
  return result(strings(listOf(value, ["orders", "rows", "ids"]) ?? []));
}

/** ledger(count): the newest orders of every card, newest first; one page at most, whatever is asked for. The count travels as an integer. */
export async function readLedger(count: number = LIMITS.page, opts: { fresh?: boolean } = {}): Promise<ReadResult<Order[]>> {
  const value = await view("ledger", [Math.max(1, Math.trunc(count))], opts);
  const list = listOf(value, ["rows", "orders"]);
  if (!list) throw new Error(NETWORK_ERROR);
  return result(newestFirst(rowsOf(list).map((r) => mapOrder(r)).filter((o) => o.id)));
}

/** stats(): the contract's counters, whatever they are called. */
export async function readStats(): Promise<ReadResult<Stats>> {
  const value = await view("stats", []);
  const entries = Object.entries(asRow(value))
    .filter(([, v]) => typeof v === "number" || typeof v === "bigint" || (typeof v === "string" && /^\d+$/.test(v)))
    .map(([key, v]) => ({ key, value: String(v) }));
  return result({ entries });
}

/** rule(): the agreement rule in the contract's words, with its caps. The built-in caps stand in when it cannot be read. */
export async function readRule(): Promise<ReadResult<Rule>> {
  const value = await view("rule", []);
  if (typeof value === "string") return result({ sections: value.trim() ? [{ title: "Rule", text: value }] : [], limits: LIMITS });
  return result(isEmptyRow(value) ? { sections: [], limits: LIMITS } : mapRule(value as Row));
}

/** refusals(): the most recent calls the contract refused without asking any model, newest first. */
export async function readRefusals(): Promise<ReadResult<Refusal[]>> {
  const value = await view("refusals", []);
  const rows = rowsOf(listOf(value, ["rows", "refusals"]) ?? []).map((r) => ({
    seq: num(r.seq),
    by: addr(r.by),
    card: str(r.card),
    reason: str(r.reason),
    at: secs(r.at),
  }));
  return result(rows.sort((a, b) => b.seq - a.seq));
}

/** standing(card): what a consumer of the contract reads before it trusts a card. */
export async function readStanding(card: string): Promise<ReadResult<Standing>> {
  const r = asRow(await view("standing", [card]));
  const flags = strings(r.flags);
  const exists = r.exists === undefined ? !("error" in r) : bool(r.exists);
  return result({
    card: str(r.card, card),
    exists,
    open: bool(r.open),
    frozen: bool(r.frozen),
    flags,
    clean: r.clean === undefined ? exists && flags.length === 0 && !bool(r.frozen) : bool(r.clean),
  });
}

// ---- writes: one builder per method ----------------------------------------------

export type WriteFn = "publish_card" | "quote" | "accept" | "decline" | "cancel" | "revise_card" | "close_card";

/** One contract call, ready to sign: the method, its arguments in the contract's order, and the value sent. */
export type Call = { fn: WriteFn; args: Arg[]; value?: bigint };

export type TierInput = { text: string; priceAtto: bigint };
/** tiers_json: a JSON list of {"text", "price"} with the price as a decimal string of atto. */
const tiersJson = (tiers: TierInput[]) => JSON.stringify(tiers.map((t) => ({ text: t.text.trim(), price: t.priceAtto.toString() })));
const ladderArg = (ladder: boolean) => (ladder ? "1" : "0");

export const calls = {
  /** publish_card(title, tiers_json, ladder), payable: the value sent is the ambiguity bond. */
  publishCard: (title: string, tiers: TierInput[], ladder: boolean, bondAtto: bigint): Call => ({
    fn: "publish_card",
    args: [title.trim(), tiersJson(tiers), ladderArg(ladder)],
    value: bondAtto,
  }),
  /** quote(card, brief), payable: the value sent must equal the card's top price exactly. */
  quote: (card: string, brief: string, topPriceAtto: bigint): Call => ({ fn: "quote", args: [card, brief.trim()], value: topPriceAtto }),
  /** accept(order): the card's maker, on a booked order. */
  accept: (order: string): Call => ({ fn: "accept", args: [order] }),
  /** decline(order): the card's maker, on a booked order. */
  decline: (order: string): Call => ({ fn: "decline", args: [order] }),
  /** cancel(order): the buyer, on a booked order. */
  cancel: (order: string): Call => ({ fn: "cancel", args: [order] }),
  /** revise_card(card, title, tiers_json, ladder): the maker; a new card id carries the remaining bond. */
  reviseCard: (card: string, title: string, tiers: TierInput[], ladder: boolean): Call => ({
    fn: "revise_card",
    args: [card, title.trim(), tiersJson(tiers), ladderArg(ladder)],
  }),
  /** close_card(card): the maker, when the card has no booked order. */
  closeCard: (card: string): Call => ({ fn: "close_card", args: [card] }),
};

/** True for the one call the validators judge: the rail then shows their votes. */
export const isJudged = (fn: WriteFn) => fn === "quote";

const WRONG_CHAIN = (chainId: number | null) =>
  `Your wallet is on ${chainName(chainId)}. Switch it to GenLayer Studio (chain 61999) before signing.`;

/** Sends a call through the connected EIP-1193 provider. Resolves to the transaction hash. */
export async function write(call: Call): Promise<string> {
  if (isMock) return mock.write(call.fn, call.args, call.value ?? 0n);
  const address = contractAddress();
  if (!address)
    throw new Error(
      "This site is not pointed at a deployed contract yet. Deploy your own from the Deploy page; it takes one signature and this browser then reads it.",
    );
  const signer = getSigner();
  if (!signer) throw new Error("Connect a wallet first.");
  // Studio is gasless and the SDK skips its own chain check for it, so the refusal to sign on
  // another chain lives here, and it says which chain the wallet is on.
  const chainId = await getChainId(signer.provider);
  if (chainId !== CHAIN_ID) throw new Error(WRONG_CHAIN(chainId));
  const client = createClient({ chain: studio, account: signer.address as Address, provider: signer.provider });
  const hash = await client.writeContract({
    address: address as Address,
    functionName: call.fn,
    args: call.args,
    value: call.value ?? 0n,
  });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("The wallet returned no transaction hash.");
  return hash;
}

// ---- outcomes: what a finished call's JSON return means ----------------------------

const stripTag = (m: string) => m.replace(/^\s*\[(EXPECTED|TRANSIENT)\]\s*/i, "").trim();

/** The contract's reason for refusing a call, without its tag; "" when the call was not refused. */
export function refusalReason(s: TxStatus | null): string {
  if (!s) return "";
  const r = s.result;
  if (r && r.ok === false) return stripTag(str(r.reason) || str(r.why) || str(r.line));
  if (s.exec === "ERROR") {
    const m = /\[EXPECTED\]\s*([^"}\n]+)/.exec(s.message || "");
    return m ? m[1].trim() : stripTag(s.message || "");
  }
  return "";
}

export type QuoteOutcome =
  /** the model was asked and the answer is stored: exact, outside, ambiguous or unclear */
  | { kind: "result"; order: Order }
  /** a stored refusal: no model was asked and what was sent came back */
  | { kind: "refused"; reason: string; returnedAtto: string; order: string }
  | { kind: "unknown" };

/**
 * True when the leader's return is what the chain stored. A round with no majority, a cancelled
 * tx or one the validators did not accept still carries the leader's JSON, but nothing of it was kept.
 */
const stored = (s: TxStatus | null): s is TxStatus => !!s && !s.undetermined && s.applied !== false && s.status !== "CANCELED";

/** quote() answers in its JSON return: an order with its outcome, or a refusal that returned the payment. */
export function quoteOutcome(s: TxStatus | null): QuoteOutcome {
  if (!stored(s)) return { kind: "unknown" };
  const r = s.result;
  if (!r) return { kind: "unknown" };
  if (r.ok === true && outcomeOf(r.outcome)) return { kind: "result", order: mapOrder(r) };
  if (r.ok === false)
    return { kind: "refused", reason: stripTag(str(r.reason)), returnedAtto: atto(r.returned ?? r.refunded), order: str(r.order) };
  return { kind: "unknown" };
}

/** publish_card's return: the card it created, or null (a refusal returns the bond sent). */
export function publishedCard(s: TxStatus | null): { card: string; bondAtto: string; bondSliceAtto: string; topPriceAtto: string } | null {
  if (!stored(s)) return null;
  const r = s.result;
  if (!r || r.ok !== true || !r.card) return null;
  return { card: str(r.card), bondAtto: atto(r.bond), bondSliceAtto: atto(r.bond_slice), topPriceAtto: atto(r.top_price) };
}

/** revise_card's return: the id of the NEW card, "" when the call did not make one. */
export function revisedCard(s: TxStatus | null): string {
  if (!stored(s)) return "";
  const r = s.result;
  if (!r || r.ok !== true) return "";
  return parseCardId(str(r.revised_to ?? r.new_card ?? r.card));
}

/** What a call returned to its sender, in atto: a refused bond or payment, a closed card's bond, a refund. */
export function returnedAtto(s: TxStatus | null): string {
  const r = s?.result;
  if (!r) return "0";
  for (const k of ["returned", "bond_returned", "refunded", "paid"]) if (atto(r[k]) !== "0") return atto(r[k]);
  return "0";
}

const MONEY_KEYS = ["returned", "refunded", "bond_paid", "bond_returned", "paid", "released", "to_maker", "to_buyer"];
const SETTLED: unknown[] = ["accepted", "declined", "cancelled"];

/** True when GEN moves to or from somebody because of this call, so balances are watched afterwards. */
export function movesMoney(s: TxStatus): boolean {
  const r = s.result;
  if (!r) return false;
  if (MONEY_KEYS.some((k) => k in r && atto(r[k]) !== "0")) return true;
  return r.ok === true && SETTLED.includes(r.status);
}

/**
 * True once the network has accepted a transaction and its result can be read. Studio applies
 * the state at ACCEPTED and finalizes about half a minute later. Money a call moves still leaves
 * only once it is FINALIZED.
 */
export function isAccepted(s: TxStatus | null): boolean {
  return !!s && (s.status === "ACCEPTED" || s.status === "FINALIZED") && s.applied === true && (s.result !== null || s.exec !== null);
}

/** True when nothing more will happen to the transaction (finalized, cancelled, or no majority). */
export function isSettled(s: TxStatus | null): boolean {
  return !!s && (s.undetermined || s.status === "FINALIZED" || s.status === "CANCELED" || s.status === "UNDETERMINED");
}

// ---- deploy, transactions, balances -------------------------------------------------

/** Deploys the contract source from the connected wallet (the /deploy page). Resolves to the deploy tx hash. */
export async function deploy(code: string): Promise<string> {
  if (isMock) return mock.deploy();
  const signer = getSigner();
  if (!signer) throw new Error("Connect a wallet first.");
  const chainId = await getChainId(signer.provider);
  if (chainId !== CHAIN_ID) throw new Error(WRONG_CHAIN(chainId));
  const client = createClient({ chain: studio, account: signer.address as Address, provider: signer.provider });
  // The contract's constructor takes no arguments.
  const hash = await client.deployContract({ code, args: [], leaderOnly: false });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("The wallet returned no transaction hash.");
  return hash;
}

/** The address a deploy transaction created; "" until the network has accepted it. */
export async function deployedAddress(hash: string): Promise<string> {
  if (isMock) return mock.MOCK_REGISTER;
  const tx = await withRetry(() => rpc<RawTx | null>("eth_getTransactionByHash", [hash]), { tries: 2, bucket: "eth", ownBudget: true });
  const data = tx?.data as { contract_address?: string } | undefined;
  return typeof data?.contract_address === "string" ? data.contract_address : "";
}

/** One poll of a transaction. Pages call this every 3 s until it is final. */
export async function txStatus(hash: string): Promise<TxStatus> {
  if (isMock) return mock.txStatus(hash);
  // Two quick tries: the caller polls anyway, so a dropped request is just a later poll.
  // eth_* has its own bucket and its own retry budget, so neither a gen_call cooldown nor
  // the gen_call retry loops queued for the shared slots ever stall the rail.
  const tx = await withRetry(() => rpc<RawTx | null>("eth_getTransactionByHash", [hash]), { tries: 2, bucket: "eth", ownBudget: true });
  return decodeTx(tx);
}

/** Balance in atto of an address (eth_getBalance). */
export async function balanceOf(address: string): Promise<bigint> {
  if (isMock) return mock.balanceOf(address);
  const hex = await withRetry(() => rpc<string>("eth_getBalance", [address, "latest"]), { tries: 3, bucket: "eth", ownBudget: true });
  return BigInt(hex || "0x0");
}

/** Pause between faucet tries: sim_fundAccount shares the 30 a minute bucket with the reads. */
const FAUCET_PAUSE_MS = 10_000;
const FAUCET_TRIES = 3;
/** How long the faucet waits for the credit to show in the balance. */
const FAUCET_WAIT_MS = 60_000;

/**
 * Faucet: sim_fundAccount with 10 GEN (amount in wei as a JS number), up to three tries ten
 * seconds apart, each one after the gen_call cooldown. Resolves when the balance moved; a
 * refusal on every try is FAUCET_REFUSED. `stillWanted` is asked between balance polls: once
 * it says no (the wallet switched accounts), the wait ends with an error nobody shows.
 */
export async function faucet(address: string, opts: { stillWanted?: () => boolean } = {}): Promise<bigint> {
  if (isMock) return mock.faucet(address);
  // Studio credits only a checksummed address: sim_fundAccount with the lowercase spelling
  // the site keeps is accepted, finalizes with value 10 GEN, and never reaches the balance.
  let account: string;
  try {
    account = getAddress(address);
  } catch {
    throw new Error("That is not a valid 0x address, so the faucet was not asked.");
  }
  let before: bigint;
  try {
    before = await balanceOf(account);
  } catch {
    throw new Error("Could not read this wallet's balance from Studio, so the faucet was not asked. Try again in a few seconds.");
  }
  let sent = false;
  for (let i = 0; i < FAUCET_TRIES && !sent; i++) {
    await waitForCooldown("gen");
    try {
      // `amount` is wei as a JS number; a decimal string makes the node compare str with int.
      await rpc("sim_fundAccount", { account_address: account, amount: 10e18 });
      sent = true;
    } catch (e) {
      // A refusal is a refusal whatever the shape: 429 behind CORS, -32029, or a dropped
      // request. A rate-limited one also starts the gen_call cooldown, so the reads back off too.
      noteFailure(e, Date.now(), "gen");
      if (i === FAUCET_TRIES - 1) throw new Error(FAUCET_REFUSED);
      await sleep(FAUCET_PAUSE_MS);
    }
  }
  const started = Date.now();
  while (Date.now() - started < FAUCET_WAIT_MS) {
    await sleep(2000);
    if (opts.stillWanted && !opts.stillWanted()) throw new Error("The faucet wait ended: the wallet switched accounts.");
    try {
      const now = await balanceOf(account);
      if (now !== before) return now;
    } catch {
      /* a dropped poll is not a failed faucet; keep polling */
    }
  }
  throw new Error("The faucet did not credit the account within 60 s. Try again.");
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
