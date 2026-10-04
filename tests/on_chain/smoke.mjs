/* Bracket against GenLayer Studio (chain 61999), with throwaway accounts. Deploys its own copies.
 *
 *   npm ci                                        # genlayer-js 1.1.8 and viem 2.56.8, pinned by package-lock.json
 *   node tests/on_chain/smoke.mjs                 # the whole run, phases A to F
 *   RESUME=1 node tests/on_chain/smoke.mjs        # continue a run that was cut off, from the saved state
 *
 * Four generated accounts play the whole story: M is a translator who publishes rate cards, B1 and
 * B2 are buyers, and S is a stranger who never buys anything.
 *
 * Phases:
 *   A  deploy Bracket and the Listing fixture bound to it; a card sent with too small a bond is refused
 *      and the bond comes back; card C1 is published with a bond of 2 GEN (three tiers that are meant
 *      not to overlap, two of which do); its maker stakes 1 GEN to feature it; a stranger cannot eject
 *      a clean card.
 *   B  briefs on C1. One that only tier 1 covers is booked at tier 1 and accepted by the maker. One that
 *      only tier 2 covers is booked at tier 2 and cancelled by its buyer. One that no tier covers comes
 *      back whole. Three refusals that ask no model: the maker on their own card, the wrong amount, and
 *      a brief already judged. A product page of 550 words, which the readers may or may not hold still
 *      on: whichever way it is read, the whole payment comes back. One that only tier 3 covers, the
 *      dearest: the whole payment is held. Then a brief written in the tiers' own words that sits on
 *      tiers 1 and 2: the payment comes back with a slice of the bond, the pair is flagged and the card
 *      is frozen, and a brief on the frozen card is refused.
 *   C  the consequence in the fixture: the maker can no longer withdraw the stake, the maker cannot
 *      eject their own card, and the stranger ejects it and is paid the stake.
 *   D  the maker revises C1 into C2 with tier 2 rewritten so the two no longer overlap. The order
 *      still booked on C1 is accepted there, on the closed card. The same brief, on C2, is booked at
 *      tier 1 and declined by the maker. A brief on the closed C1 is refused. C2 is featured and its
 *      stake withdrawn.
 *   E  a ladder card, C3: a brief that tiers 2 and 3 cover is booked at tier 2, the narrowest, and
 *      accepted.
 *   F  both open cards are closed and what is left of each bond comes back; the deployed code is read
 *      back and compared with these files byte for byte; the views are read and checked against what
 *      the run did; the balances of all four accounts are compared with what the ledger says each
 *      should have gained or lost.
 *
 * Every refusal is a signed transaction. Payments are read from balances after finalisation.
 * Transactions are polled with eth_getTransactionByHash, never with views (gen_call is limited to
 * 30 a minute per client, shared with sim_fundAccount). A round the validators do not carry stores
 * nothing; it is sent again and both transactions are kept. Every step is saved as it is made, so
 * a run that is cut off continues without sending twice.
 */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey } from "viem/accounts";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RPC = "https://studio.genlayer.com/api";
const STATE = process.env.STATE || join(tmpdir(), "bracket-smoke-state.json");
const RECORD = process.env.RECORD || STATE.replace(/\.json$/, "") + "-record.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const rpc = async (m, p) => {
  let last;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) });
      const j = await r.json();
      if (j.error && (j.error.code === -32029 || r.status === 429)) { await sleep(((j.error.data?.retry_after_seconds) || 20) * 1000); continue; }
      if (j.error) { last = new Error(m + ": " + JSON.stringify(j.error).slice(0, 200)); await sleep(6000); continue; }
      return j.result;
    } catch (e) { last = e; await sleep(4000); }   // the connection itself failed, or the answer was not JSON
  }
  throw last;
};
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); return !!c; };
const GEN = 10n ** 18n;
const gen = (n) => String(BigInt(Math.round(n * 1000)) * GEN / 1000n);
const tally = (v) => `${v.agree} agree, ${v.disagree} disagree, ${v.idle} idle`;

// ---------- state: accounts, addresses and every step already made survive a cut-off run ----------
const st = existsSync(STATE) && process.env.RESUME && !process.env.FRESH ? JSON.parse(readFileSync(STATE, "utf8")) : {};
st.keys = st.keys || {}; st.steps = st.steps || {}; st.views = st.views || {}; st.order = st.order || [];
const save = () => {
  writeFileSync(STATE, JSON.stringify(st, null, 1));
  const { keys, ...shown } = st;       // the record carries no key
  writeFileSync(RECORD, JSON.stringify(shown, null, 1));
};
const ROLES = { m: "the maker, a translator", b1: "the first buyer", b2: "the second buyer", s: "a stranger who buys nothing" };
for (const k of Object.keys(ROLES)) st.keys[k] = st.keys[k] || generatePrivateKey();
const acct = {}, client = {};
for (const k of Object.keys(ROLES)) { acct[k] = createAccount(st.keys[k]); client[k] = createClient({ chain: studionet, account: acct[k] }); }
const rd = createClient({ chain: studionet });
st.accounts = Object.fromEntries(Object.keys(ROLES).map((k) => [k, acct[k].address]));
const low = (k) => acct[k].address.toLowerCase();

const balance = async (a) => BigInt(await rpc("eth_getBalance", [a, "latest"]) || "0x0");
const nonceOf = async (a) => Number(BigInt(await rpc("eth_getTransactionCount", [a, "latest"]) || "0x0"));
const fundOnce = async (k, whole) => {
  st.funded = st.funded || {};
  if (st.funded[k]) return;
  await rpc("sim_fundAccount", { account_address: acct[k].address, amount: whole * 1e18 });   // a checksummed address
  for (let i = 0; i < 20 && (await balance(acct[k].address)) === 0n; i++) await sleep(3000);
  st.funded[k] = String(await balance(acct[k].address)); save();
};

// ---------- transactions ----------
const errText = (e) => String(e?.details || e?.shortMessage || e?.cause?.message || e?.message || e);
// A request the network refused or never received is made again. When the failure is ambiguous the
// sender's nonce says whether the transaction landed after all, and its hash is read back, so
// nothing is ever sent twice.
const sendRaw = async (who, what, make) => {
  const addr = acct[who].address;
  for (let i = 0; ; i++) {
    const n0 = await nonceOf(addr);
    try { return await make(); } catch (e) {
      const text = errText(e);
      if (i >= 8) throw e;
      console.log(`      ${what} was not taken (${text.slice(0, 70)}); looking again in 20s`);
      await sleep(20000);
      if ((await nonceOf(addr)) > n0) {
        const list = await rpc("sim_getTransactionsForAddress", [addr]);
        const hit = (list || []).find((t) => String(t.from_address).toLowerCase() === addr.toLowerCase() && Number(t.nonce) === n0);
        if (hit?.hash) return hit.hash;
        throw new Error(what + " landed but its hash could not be read back");
      }
    }
  }
};
const countVotes = (t) => { let a = 0, d = 0, idl = 0; for (const k in (t.consensus_data?.votes || {})) { const v = t.consensus_data.votes[k]; if (v === "agree") a++; else if (v === "disagree") d++; else idl++; } return { agree: a, disagree: d, idle: idl }; };
const wait = async (tx) => {
  let stuck = 0;
  for (let i = 0; i < 900; i++) {
    await sleep(4000);
    const t = await rpc("eth_getTransactionByHash", [tx]);
    if (t?.status === "FINALIZED") {
      const lr = t.consensus_data?.leader_receipt, one = Array.isArray(lr) ? lr[0] : lr;
      let msg = "";
      try { msg = Buffer.from(one.result, "base64").toString("utf8").replace(/[^\x20-\x7e]/g, " ").trim(); } catch (e) {}
      const v = countVotes(t);
      return { tx, msg, exec: one?.execution_result || "", votes: v, applied: v.agree * 2 > v.agree + v.disagree + v.idle, address: t.data?.contract_address || t.to_address || "", outcome: t.result_name || "" };
    }
    // a round no majority carried is final as it stands once it has been left alone for ten minutes
    if (t?.status === "UNDETERMINED" && (stuck = stuck + 1) > 150) return { tx, msg: "UNDETERMINED", exec: "", votes: countVotes(t), applied: false, address: "", outcome: t.result_name || "UNDETERMINED" };
    if (t?.status === "CANCELED") return { tx, msg: "CANCELED", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "", outcome: "CANCELED" };
    if (i > 0 && i % 75 === 0) console.log(`      [${stamp()}] still ${t?.status || "unknown"} after ${Math.round(i * 4 / 60)} minutes: ${tx}`);
  }
  return { tx, msg: "TIMEOUT", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "", outcome: "TIMEOUT" };
};
const jsonOf = (msg) => { const b = String(msg).indexOf("{"); if (b === -1) return null; try { return JSON.parse(String(msg).slice(b)); } catch (e) { return null; } };
const settle = async (a, before, want) => { for (let i = 0; i < 45; i++) { const b = await balance(a); if (b - before === want) return b; await sleep(4000); } return await balance(a); };
const noModel = (j) => j?.ok === false && String(j?.reason).includes("a model could not be reached");

// One step of the run: a signed transaction, its tally, what it returned, and the balances it moved.
// opt.value is what is sent with it; opt.watch names addresses whose balances are read before and
// after, and opt.expect the change each should show once the transfer has landed: a table, or a
// function of what the call returned, because what a quote sends back depends on its outcome.
// A step that is already in the saved state is not sent again.
const call = async (id, who, target, fn, args = [], opt = {}) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, target, fn, args: args.map(String), value: String(opt.value || 0n), tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const watch = opt.watch || {};
    if (!rec.before) { rec.before = {}; for (const [k, a] of Object.entries(watch)) rec.before[k] = String(await balance(a)); save(); }
    let r;
    for (;;) {
      if (!rec.pending) {
        rec.pending = await sendRaw(who, fn, () => client[who].writeContract({ address: st[target], functionName: fn, args, ...(opt.value ? { value: opt.value } : {}) }));
        save();
      }
      r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg, outcome: r.outcome });
      rec.mid = {}; for (const [k, a] of Object.entries(watch)) rec.mid[k] = String(await balance(a));   // as finalised, before any transfer back has landed
      rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} ${fn}(${args.map((x) => String(x).slice(0, 22)).join(", ")})${opt.value ? " +" + Number(opt.value) / 1e18 + " GEN" : ""}  ${r.tx}  ${tally(r.votes)}  ${r.exec}`);
      if (r.msg === "TIMEOUT" || rec.tries.length >= 4) break;
      if (!r.applied) { console.log("      the validators did not carry that round (" + tally(r.votes) + "), so nothing was stored; sending it again"); continue; }
      if (noModel(jsonOf(r.msg))) { console.log("      no model could be reached, nothing is spent; sending it again"); continue; }
      break;
    }
    const expect = typeof opt.expect === "function" ? opt.expect(jsonOf(r.msg), rec.tries.length) : opt.expect;
    rec.after = {}; rec.delta = {};
    for (const [k, a] of Object.entries(watch)) {
      const before = BigInt(rec.before[k]);
      const want = expect && expect[k] !== undefined ? BigInt(expect[k]) : null;
      const now = want === null ? await balance(a) : await settle(a, before, want);
      rec.after[k] = String(now); rec.delta[k] = String(now - before);
    }
    rec.done = true; save();
  }
  const last = rec.tries[rec.tries.length - 1];
  return { ...last, j: jsonOf(last.msg), tries: rec.tries, delta: rec.delta || {}, n: rec.tries.length };
};
const refused = (r, words) => r.exec === "ERROR" && r.msg.includes(words);
const moved = (r, k, want) => r.delta[k] === String(want);
const votes = (r) => r.tries.map((t) => tally(t.votes)).join(", then ");

const deploy = async (id, who, path, args) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, target: "", fn: "deploy " + path.split("/").pop(), args: args.map(String), value: "0", tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const code = readFileSync(new URL(path, import.meta.url));
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, "deploy", () => client[who].deployContract({ code, args, leaderOnly: false })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg.slice(0, 300), outcome: r.outcome });
      rec.address = r.address; rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} deploy ${path.split("/").pop()}  ${r.tx}  ${tally(r.votes)}  ${r.exec}  ${r.address}`);
      if (r.applied || r.msg === "TIMEOUT" || rec.tries.length >= 3) break;
    }
    rec.done = true; save();
  }
  return rec.address;
};

// ---------- reads: paced, and made again on a 429 or on "Contract not found" instead of failing ----------
let lastRead = 0;
const read = async (target, fn, args = []) => {
  for (let i = 0; i < 30; i++) {
    const gap = 3500 - (Date.now() - lastRead);
    if (gap > 0) await sleep(gap);
    lastRead = Date.now();
    try { return JSON.parse(String(await rd.readContract({ address: st[target], functionName: fn, args }))); } catch (e) {
      if (i === 29) return { error: "VIEW ERROR " + fn + ": " + errText(e).slice(0, 100) };
      await sleep(/rate|429|limit/i.test(errText(e)) ? 25000 : 10000);
    }
  }
};
// a view read once for a check is kept with the run, so a continued run checks what was seen then
const seen = async (id, target, fn, args = []) => { if (!st.views[id]) { st.views[id] = { target, fn, args, at: stamp(), out: await read(target, fn, args) }; save(); } return st.views[id].out; };

// A quote: the buyer sends the card's top price, and the balance is expected to end lower by exactly
// the price held, or higher by the slice of the bond, whatever the outcome turns out to be.
const quote = (id, who, card, brief, top, sent = top) => call(id, who, "bracket", "quote", [card, brief], {
  value: sent, watch: { [who]: acct[who].address },
  expect: (j) => ({ [who]: j?.order ? BigInt(j.refunded) + BigInt(j.bond_paid) - sent : 0n }),
});
const shows = (r) => `${votes(r)}  mask ${r.j?.mask ?? "-"}  ${r.j?.outcome ?? r.j?.reason ?? r.msg.slice(0, 80)}`;

// ---------- the demonstration text: one translator's rate card, and the briefs strangers bring ----------
const tiers = (list) => JSON.stringify(list.map(([text, whole]) => ({ text, price: gen(whole) })));
const TITLE = "English to Persian translation";
const T1 = "General text of up to 600 words, such as a letter, an email or a short web page, translated from English into Persian.";
const T2 = "General text of 500 to 2000 words, such as an article or a brochure, translated from English into Persian.";
const T3 = "Certified translation of an official document of up to 3 pages, such as a birth certificate or a diploma, with the translator's signed statement.";
const T2_FIXED = "General text of 601 to 2000 words, such as an article or a brochure, translated from English into Persian.";
const CARD = tiers([[T1, 2], [T2, 5], [T3, 8]]);
const CARD_FIXED = tiers([[T1, 2], [T2_FIXED, 5], [T3, 8]]);
const TOP = 8n * GEN, BOND = 2n * GEN, SLICE = BOND / 4n, STAKE = 1n * GEN;
const LADDER_TITLE = "Editing of English text, light to heavy";
const L1 = "Proofreading of an English text of up to 3000 words: spelling, punctuation and typing errors only.";
const L2 = "Proofreading and copy-editing of an English text of up to 3000 words: spelling, punctuation, grammar, word choice and consistency.";
const L3 = "Proofreading, copy-editing and rewriting of an English text of up to 3000 words: spelling, punctuation, grammar, word choice, consistency and the restructuring of unclear paragraphs.";
const LADDER = tiers([[L1, 1], [L2, 3], [L3, 6]]);
const LADDER_TOP = 6n * GEN, LADDER_BOND = 1n * GEN;
const BRIEF_LETTER = "Please translate my 300-word cover letter for a job application from English into Persian.";
const BRIEF_ARTICLE = "I need a 1200-word magazine article about city gardening translated from English into Persian.";
const BRIEF_MANUAL = "Translate a 9000-word technical user manual for a washing machine from English into Persian.";
const BRIEF_PAGE = "Please translate a 550-word product page for my online shop from English into Persian.";
const BRIEF_BOTH = "Please translate a general text of 550 words from English into Persian. It is a plain description of our family bakery and its opening hours.";
const BRIEF_DIPLOMA = "I need a certified translation of my two-page university diploma, with your signed statement.";
const BRIEF_GRAMMAR = "Please correct the spelling and also fix the grammar and the awkward word choice in my 1500-word English essay.";

await fundOnce("m", 20); await fundOnce("b1", 40); await fundOnce("b2", 40); await fundOnce("s", 2);
if (!st.start) { st.start = {}; for (const k of Object.keys(ROLES)) st.start[k] = String(await balance(acct[k].address)); st.started = new Date().toISOString(); save(); }
console.log(`[${stamp()}] ${Object.keys(ROLES).map((k) => k.toUpperCase().padEnd(2) + " " + acct[k].address + "  " + ROLES[k]).join("\n           ")}\n           state ${STATE}`);
const M = { m: acct.m.address };

// ================================================================ phase A
console.log(`\n[${stamp()}] ---- phase A: deploy, publish the card, feature it`);
st.bracket = st.bracket || await deploy("deployBracket", "m", "../../contracts/bracket.py", []);
save();
st.listing = st.listing || await deploy("deployListing", "m", "../../contracts/fixtures/listing.py", [st.bracket]);
save();
console.log(`      Bracket at ${st.bracket}\n      Listing at ${st.listing}`);
{
  const thin = await call("publishThin", "m", "bracket", "publish_card", [TITLE, CARD, "0"], { value: GEN / 2n, watch: M, expect: { m: 0n } });
  ok("a card sent with half a GEN is refused and the half GEN comes back", thin.j?.ok === false && String(thin.j?.reason).includes("the ambiguity bond") && thin.j?.returned === String(GEN / 2n) && moved(thin, "m", 0n), `${votes(thin)}  ${thin.j?.reason}`);
  const c1 = await call("publishC1", "m", "bracket", "publish_card", [TITLE, CARD, "0"], { value: BOND, watch: M, expect: { m: -BOND } });
  ok("C1 is published with a bond of 2 GEN and a slice of half a GEN", c1.j?.ok === true && c1.j?.card === "C1" && c1.j?.top_price === String(TOP) && c1.j?.bond === String(BOND) && c1.j?.bond_slice === String(SLICE) && moved(c1, "m", -BOND), `${votes(c1)}  ${c1.msg.slice(0, 120)}`);
  const f1 = await call("featureC1", "m", "listing", "feature", ["C1"], { value: STAKE, watch: M, expect: { m: -STAKE } });
  ok("the maker stakes 1 GEN and C1 is featured while it is clean", f1.j?.ok === true && f1.j?.state === "featured" && moved(f1, "m", -STAKE), `${votes(f1)}  ${f1.msg.slice(0, 120)}`);
  const early = await call("ejectEarly", "s", "listing", "eject", ["C1"]);
  ok("a stranger cannot eject a card that carries no flag", refused(early, "C1 carries no flag on the register"), `${votes(early)}  ${early.msg.slice(0, 100)}`);
}

// ================================================================ phase B
console.log(`\n[${stamp()}] ---- phase B: briefs on C1`);
let letter, article;
{
  letter = await quote("quoteLetter", "b1", "C1", BRIEF_LETTER, TOP);
  ok("a 300-word letter is covered by tier 1 alone: 2 GEN is held and 6 GEN comes back in the same transaction", letter.j?.outcome === "exact" && letter.j?.mask === "100" && letter.j?.tier === 1 && letter.j?.price === gen(2) && letter.j?.refunded === gen(6) && moved(letter, "b1", -2n * GEN), shows(letter));
  if (letter.j?.status === "booked") {
    const acc = await call("acceptLetter", "m", "bracket", "accept", [letter.j.order], { watch: M, expect: { m: BigInt(letter.j.price) } });
    ok("the maker accepts the order and is paid the escrow", acc.j?.status === "accepted" && acc.j?.to === low("m") && moved(acc, "m", BigInt(letter.j.price)), `${votes(acc)}  ${acc.msg.slice(0, 100)}`);
  } else ok("the maker accepts the order and is paid the escrow", false, "the letter was not booked, so there was nothing to accept");

  article = await quote("quoteArticle", "b2", "C1", BRIEF_ARTICLE, TOP);
  ok("a 1200-word article is covered by tier 2 alone: 5 GEN is held and 3 GEN comes back", article.j?.outcome === "exact" && article.j?.mask === "010" && article.j?.tier === 2 && article.j?.price === gen(5) && moved(article, "b2", -5n * GEN), shows(article));
  if (article.j?.status === "booked") {
    const wrong = await call("cancelByMaker", "m", "bracket", "cancel", [article.j.order]);
    ok("the maker cannot cancel a buyer's order", refused(wrong, "only the buyer who placed"), `${votes(wrong)}  ${wrong.msg.slice(0, 100)}`);
    const can = await call("cancelArticle", "b2", "bracket", "cancel", [article.j.order], { watch: { b2: acct.b2.address }, expect: { b2: BigInt(article.j.price) } });
    ok("the buyer cancels and the escrow comes back", can.j?.status === "cancelled" && can.j?.to === low("b2") && moved(can, "b2", BigInt(article.j.price)), `${votes(can)}  ${can.msg.slice(0, 100)}`);
  } else ok("the buyer cancels and the escrow comes back", false, "the article was not booked, so there was nothing to cancel");

  const manual = await quote("quoteManual", "b1", "C1", BRIEF_MANUAL, TOP);
  ok("a 9000-word manual is outside every tier and the whole payment comes back", manual.j?.outcome === "outside" && manual.j?.mask === "000" && manual.j?.refunded === String(TOP) && moved(manual, "b1", 0n), shows(manual));

  const own = await quote("quoteOwn", "m", "C1", BRIEF_DIPLOMA, TOP);
  ok("refused with no model asked: the maker quoting their own card", own.j?.ok === false && String(own.j?.reason).includes("may not quote their own card") && own.j?.returned === String(TOP) && moved(own, "m", 0n), shows(own));
  const short = await quote("quoteShort", "b1", "C1", BRIEF_DIPLOMA, TOP, 5n * GEN);
  ok("refused with no model asked: 5 GEN sent where the top price is 8", short.j?.ok === false && String(short.j?.reason).includes("exactly its top price") && short.j?.returned === gen(5) && moved(short, "b1", 0n), shows(short));
  const twice = await quote("quoteTwice", "b2", "C1", BRIEF_LETTER, TOP);
  ok("refused with no model asked: a brief already judged on this card, whoever sends it", twice.j?.ok === false && String(twice.j?.reason).includes("already judged on C1") && moved(twice, "b2", 0n), shows(twice));

  // The readers may or may not hold still on a product page: tier 1 names a short web page and tier 2
  // an article or a brochure. What the contract promises does not depend on which way it is read.
  const page = await quote("quotePage", "b2", "C1", BRIEF_PAGE, TOP);
  const pageFlag = page.j?.outcome === "ambiguous";
  ok("a 550-word product page is read as unclear or as on two tiers: either way nothing is booked and the whole payment comes back", page.j?.refunded === String(TOP) && page.j?.price === "0" && (pageFlag ? page.j?.bond_paid === String(SLICE) && moved(page, "b2", SLICE) : page.j?.outcome === "unclear" && page.j?.mask === "?" && page.j?.bond_paid === "0" && moved(page, "b2", 0n)), shows(page));
  if (!pageFlag) {
    const calm = await seen("cardC1unclear", "bracket", "card", ["C1"]);
    ok("an unclear reading freezes nothing and moves no bond: C1 is open, carries no flag and its bond is whole", calm.frozen === false && calm.flags.length === 0 && calm.bond === String(BOND) && calm.unclear === 1, JSON.stringify({ frozen: calm.frozen, flags: calm.flags, bond: calm.bond, unclear: calm.unclear }));
    const diploma = await quote("quoteDiploma", "b1", "C1", BRIEF_DIPLOMA, TOP);
    ok("a certified two-page diploma is covered by tier 3 alone, the dearest: the whole 8 GEN is held and nothing is left to send back", diploma.j?.outcome === "exact" && diploma.j?.mask === "001" && diploma.j?.tier === 3 && diploma.j?.price === String(TOP) && diploma.j?.refunded === "0" && moved(diploma, "b1", -TOP), shows(diploma));
    const twiceUnclear = await quote("quotePageAgain", "b1", "C1", BRIEF_PAGE, TOP);
    ok("refused with no model asked: the brief that was read as unclear is spent on this card", twiceUnclear.j?.ok === false && String(twiceUnclear.j?.reason).includes("already judged on C1") && moved(twiceUnclear, "b1", 0n), shows(twiceUnclear));
    const both = await quote("quoteBoth", "b2", "C1", BRIEF_BOTH, TOP);
    ok("a general text of 550 words sits on tiers 1 and 2: the payment comes back with half a GEN of the maker's bond", both.j?.outcome === "ambiguous" && both.j?.mask === "110" && both.j?.refunded === String(TOP) && both.j?.bond_paid === String(SLICE) && moved(both, "b2", SLICE), shows(both));
    st.flagged = both.j?.outcome === "ambiguous";
  } else st.flagged = true;
  st.overlap = pageFlag ? BRIEF_PAGE : BRIEF_BOTH; save();
  const c1 = await seen("cardC1frozen", "bracket", "card", ["C1"]);
  ok("C1 is frozen, carries the flag 1:2, and its bond is one slice lower", c1.frozen === true && JSON.stringify(c1.flags) === '["1:2"]' && c1.bond === String(BOND - SLICE), JSON.stringify({ frozen: c1.frozen, flags: c1.flags, bond: c1.bond }));
  const cold = await quote("quoteFrozen", "b1", "C1", BRIEF_ARTICLE, TOP);
  ok("refused with no model asked: a brief on the frozen card", cold.j?.ok === false && String(cold.j?.reason).includes("C1 is frozen") && moved(cold, "b1", 0n), shows(cold));
}

// ================================================================ phase C
console.log(`\n[${stamp()}] ---- phase C: what the flag does in the Listing fixture`);
{
  const back = await call("withdrawFlagged", "m", "listing", "withdraw", ["C1"]);
  ok("the maker can no longer withdraw the stake of a flagged card", refused(back, "carries a flag on the register"), `${votes(back)}  ${back.msg.slice(0, 100)}`);
  const self = await call("ejectOwn", "m", "listing", "eject", ["C1"]);
  ok("the maker cannot eject their own card", refused(self, "may not eject it"), `${votes(self)}  ${self.msg.slice(0, 100)}`);
  const out = await call("ejectC1", "s", "listing", "eject", ["C1"], { watch: { s: acct.s.address }, expect: { s: STAKE } });
  ok("the stranger ejects the flagged card and is paid the 1 GEN stake", out.j?.state === "ejected" && out.j?.to === low("s") && moved(out, "s", STAKE), `${votes(out)}  ${out.msg.slice(0, 120)}`);
}

// ================================================================ phase D
console.log(`\n[${stamp()}] ---- phase D: the revised card`);
{
  const same = await call("reviseSame", "m", "bracket", "revise_card", ["C1", "The same tiers under a new title", CARD, "0"]);
  ok("the same tiers under a new title do not pass for a revision", refused(same, "a revision changes the tiers"), `${votes(same)}  ${same.msg.slice(0, 100)}`);
  const other = await call("reviseStranger", "s", "bracket", "revise_card", ["C1", TITLE, CARD_FIXED, "0"]);
  ok("a stranger cannot revise the card", refused(other, "only the maker of C1 may revise it"), `${votes(other)}  ${other.msg.slice(0, 100)}`);
  const rev = await call("reviseC1", "m", "bracket", "revise_card", ["C1", TITLE, CARD_FIXED, "0"], { watch: M, expect: { m: 0n } });
  ok("the maker revises C1 into C2, which carries what is left of the bond", rev.j?.ok === true && rev.j?.card === "C2" && rev.j?.revised_from === "C1" && rev.j?.bond === String(BigInt(st.views.cardC1frozen.out.bond)) && rev.j?.bond_slice === String(SLICE) && moved(rev, "m", 0n), `${votes(rev)}  ${rev.msg.slice(0, 140)}`);
  if (st.steps.quoteDiploma) {
    const o = jsonOf(st.steps.quoteDiploma.tries.at(-1).msg);
    if (o?.status === "booked") {
      const late = await call("acceptDiploma", "m", "bracket", "accept", [o.order], { watch: M, expect: { m: BigInt(o.price) } });
      ok("the order booked on C1 before it was revised is still the maker's to end: accepted on the closed card, and the escrow is paid", late.j?.status === "accepted" && late.j?.card === "C1" && moved(late, "m", BigInt(o.price)), `${votes(late)}  ${late.msg.slice(0, 100)}`);
    }
  }
  const again = await quote("quoteBothC2", "b2", "C2", st.overlap || BRIEF_BOTH, TOP);
  ok("the brief that sat on two tiers, on the revised card, is covered by tier 1 alone", again.j?.outcome === "exact" && again.j?.mask === "100" && again.j?.tier === 1 && moved(again, "b2", -2n * GEN), shows(again));
  if (again.j?.status === "booked") {
    const dec = await call("declinePage", "m", "bracket", "decline", [again.j.order], { watch: { b2: acct.b2.address }, expect: { b2: BigInt(again.j.price) } });
    ok("the maker declines the order and the escrow goes back to the buyer", dec.j?.status === "declined" && dec.j?.to === low("b2") && moved(dec, "b2", BigInt(again.j.price)), `${votes(dec)}  ${dec.msg.slice(0, 100)}`);
  } else ok("the maker declines the order and the escrow goes back to the buyer", false, "the brief was not booked on C2");
  const gone = await quote("quoteClosed", "b1", "C1", BRIEF_DIPLOMA, TOP);
  ok("refused with no model asked: a brief on the closed card, which names the card it was revised to", gone.j?.ok === false && String(gone.j?.reason).includes("C1 is closed") && String(gone.j?.reason).includes("revised to C2") && moved(gone, "b1", 0n), shows(gone));
  const old = await call("featureOld", "m", "listing", "feature", ["C1"], { value: STAKE, watch: M, expect: { m: 0n } });
  ok("the flagged card cannot be featured again and the stake comes back", old.j?.ok === false && moved(old, "m", 0n), `${votes(old)}  ${old.j?.reason}`);
  const f2 = await call("featureC2", "m", "listing", "feature", ["C2"], { value: STAKE, watch: M, expect: { m: -STAKE } });
  ok("the revised card is clean and is featured", f2.j?.ok === true && moved(f2, "m", -STAKE), `${votes(f2)}  ${f2.msg.slice(0, 100)}`);
  const w2 = await call("withdrawC2", "m", "listing", "withdraw", ["C2"], { watch: M, expect: { m: STAKE } });
  ok("and its maker withdraws the stake, because it carries no flag", w2.j?.state === "withdrawn" && moved(w2, "m", STAKE), `${votes(w2)}  ${w2.msg.slice(0, 100)}`);
}

// ================================================================ phase E
console.log(`\n[${stamp()}] ---- phase E: a ladder card`);
{
  const flat = await call("publishFlat", "m", "bracket", "publish_card", [LADDER_TITLE, tiers([[L1, 3], [L2, 3], [L3, 6]]), "1"], { value: LADDER_BOND, watch: M, expect: { m: 0n } });
  ok("a ladder whose prices do not rise is refused and the bond comes back", flat.j?.ok === false && String(flat.j?.reason).includes("on a ladder card each tier costs more") && moved(flat, "m", 0n), `${votes(flat)}  ${flat.j?.reason}`);
  const c3 = await call("publishC3", "m", "bracket", "publish_card", [LADDER_TITLE, LADDER, "1"], { value: LADDER_BOND, watch: M, expect: { m: -LADDER_BOND } });
  ok("the ladder card is published as C3", c3.j?.ok === true && c3.j?.card === "C3" && c3.j?.ladder === "1" && c3.j?.top_price === String(LADDER_TOP), `${votes(c3)}  ${c3.msg.slice(0, 120)}`);
  const essay = await quote("quoteEssay", "b1", "C3", BRIEF_GRAMMAR, LADDER_TOP);
  ok("spelling and grammar are covered by tiers 2 and 3: the order is booked at tier 2, the narrowest, and 3 GEN comes back", essay.j?.outcome === "exact" && essay.j?.mask === "011" && essay.j?.tier === 2 && essay.j?.price === gen(3) && essay.j?.bond_paid === "0" && moved(essay, "b1", -3n * GEN), shows(essay));
  if (essay.j?.status === "booked") {
    const acc = await call("acceptEssay", "m", "bracket", "accept", [essay.j.order], { watch: M, expect: { m: BigInt(essay.j.price) } });
    ok("the maker accepts it and is paid the escrow", acc.j?.status === "accepted" && moved(acc, "m", BigInt(essay.j.price)), `${votes(acc)}  ${acc.msg.slice(0, 100)}`);
  } else ok("the maker accepts it and is paid the escrow", false, "the essay was not booked on C3");
}

// ================================================================ phase F
console.log(`\n[${stamp()}] ---- phase F: close the cards, read the code back, read the views`);
{
  const thief = await call("closeStranger", "s", "bracket", "close_card", ["C3"]);
  ok("a stranger cannot close a card", refused(thief, "only the maker of C3 may close it"), `${votes(thief)}  ${thief.msg.slice(0, 100)}`);
  const c2 = await read("bracket", "card", ["C2"]), c3 = await read("bracket", "card", ["C3"]);
  if (Number(c3.booked) === 0) {
    const x3 = await call("closeC3", "m", "bracket", "close_card", ["C3"], { watch: M, expect: { m: BigInt(c3.bond || 0) } });
    ok("C3 is closed and its whole bond comes back, because a ladder never pays it", x3.j?.ok === true && x3.j?.returned === String(LADDER_BOND) && moved(x3, "m", LADDER_BOND), `${votes(x3)}  ${x3.msg.slice(0, 100)}`);
  } else ok("C3 is closed and its whole bond comes back", false, "C3 still has a booked order");
  if (Number(c2.booked) === 0) {
    const x2 = await call("closeC2", "m", "bracket", "close_card", ["C2"], { watch: M, expect: { m: BigInt(c2.bond || 0) } });
    ok("C2 is closed and what is left of the bond comes back", x2.j?.ok === true && x2.j?.returned === String(c2.bond) && moved(x2, "m", BigInt(c2.bond || 0)), `${votes(x2)}  ${x2.msg.slice(0, 100)}`);
  } else ok("C2 is closed and what is left of the bond comes back", false, "C2 still has a booked order");

  const sha = (b) => createHash("sha256").update(b).digest("hex");
  st.code = st.code || {};
  for (const [name, target, path] of [["bracket.py", "bracket", "../../contracts/bracket.py"], ["listing.py", "listing", "../../contracts/fixtures/listing.py"]]) {
    const file = readFileSync(new URL(path, import.meta.url));
    const chain = Buffer.from(String(await rpc("gen_getContractCode", [st[target]])), "base64");
    st.code[name] = { address: st[target], bytes: chain.length, sha256: sha(chain), file_bytes: file.length, file_sha256: sha(file), identical: Buffer.compare(chain, file) === 0 };
    save();
    ok(`the code deployed at ${st[target]} is byte for byte ${name}`, st.code[name].identical, `${chain.length} bytes, sha256 ${st.code[name].sha256}`);
  }

  const get = (id, target, fn, args = []) => seen(id, target, fn, args);
  const k1 = await get("cardC1", "bracket", "card", ["C1"]);
  ok("card(C1): closed, revised to C2, its flag still on it", k1.open === false && k1.revised_to === "C2" && JSON.stringify(k1.flags) === '["1:2"]' && k1.bond === "0", JSON.stringify({ open: k1.open, revised_to: k1.revised_to, flags: k1.flags, orders: k1.orders }));
  const s1 = await get("standingC1", "bracket", "standing", ["C1"]);
  ok("standing(C1): not clean", s1.exists === true && s1.clean === false && s1.maker === low("m"), JSON.stringify(s1));
  const s2 = await get("standingC2", "bracket", "standing", ["C2"]);
  ok("standing(C2): no flag of its own, one flag behind it", s2.exists === true && s2.flags.length === 0 && s2.past_flags === 1, JSON.stringify(s2));
  const all = await get("cards", "bracket", "cards", []);
  ok("cards(): three cards, newest first", Array.isArray(all) && all.map((r) => r.card).join() === "C3,C2,C1", Array.isArray(all) ? all.map((r) => r.card + ":" + (r.open ? "open" : "closed")).join(" ") : JSON.stringify(all).slice(0, 80));
  const judged = st.order.map((id) => ({ s: st.steps[id], j: jsonOf(st.steps[id].tries.at(-1).msg) })).filter((x) => x.s.fn === "quote" && x.j?.order);
  const led = await get("ledger", "bracket", "ledger", [24]);
  ok("ledger(24): every judged brief, newest first, each with the sentence the contract wrote", Array.isArray(led) && led.length === judged.length && led.every((r) => typeof r.line === "string" && r.line.length > 20), Array.isArray(led) ? led.map((r) => r.order + ":" + r.outcome + ":" + r.mask + ":" + r.status).join(" ") : "");
  const of1 = await get("ordersOfC1", "bracket", "orders_of", ["C1"]);
  ok("orders_of(C1): every brief judged on C1", Array.isArray(of1) && of1.length === judged.filter((x) => x.j.card === "C1").length, JSON.stringify(of1));
  const by2 = await get("ordersByB2", "bracket", "orders_by", [low("b2")]);
  ok("orders_by(B2): every judged brief the second buyer sent", Array.isArray(by2) && by2.length === judged.filter((x) => x.s.who === "b2").length, JSON.stringify(by2));
  if (letter?.j?.order) {
    const o1 = await get("orderLetter", "bracket", "order", [letter.j.order]);
    ok("order(the letter): accepted, with the brief as it was judged and its digest", o1.status === "accepted" && o1.brief === BRIEF_LETTER && o1.buyer === low("b1") && o1.maker === low("m") && o1.brief_digest === createHash("sha256").update(BRIEF_LETTER.toLowerCase()).digest("hex"), JSON.stringify({ status: o1.status, mask: o1.mask, tier: o1.tier }));
  }
  const stats = await get("stats", "bracket", "stats", []);
  ok("stats(): nothing is held once every card is closed and every order ended", stats.held_bonds === "0" && stats.held_escrow === "0" && stats.cards === 3 && stats.orders === judged.length && stats.booked === 0, JSON.stringify(stats));
  ok("the contract's own balance is zero", (await balance(st.bracket)) === 0n, String(await balance(st.bracket)));
  const ring = await get("refusals", "bracket", "refusals", []);
  ok("refusals(): the refused calls, each with who made it and why", Array.isArray(ring) && ring.length >= 7 && ring.every((r) => /^0x[0-9a-f]{40}$/.test(r.by) && typeof r.reason === "string"), Array.isArray(ring) ? `${ring.length} rows` : "");
  const rule = await get("rule", "bracket", "rule", []);
  ok("rule(): the agreement rule in words, with the caps", typeof rule.agreement === "string" && rule.caps?.brief?.[1] === 1200 && rule.caps?.bond_slices === 4, Object.keys(rule).join(","));
  const terms = await get("terms", "listing", "terms", []);
  ok("terms() of the fixture: bound to this register", String(terms.register) === String(st.bracket).toLowerCase() && terms.entries === 2, JSON.stringify({ register: terms.register, entries: terms.entries }));
  const e1 = await get("entryC1", "listing", "entry", ["C1"]);
  const e2 = await get("entryC2", "listing", "entry", ["C2"]);
  ok("entry(C1) ejected to the stranger, entry(C2) withdrawn by the maker", e1.state === "ejected" && e1.to === low("s") && e2.state === "withdrawn" && e2.to === low("m"), JSON.stringify({ C1: e1.state, C2: e2.state }));
  ok("the fixture's own balance is zero", (await balance(st.listing)) === 0n, String(await balance(st.listing)));

  const outcomes = new Set();
  for (const id of st.order) { const j = jsonOf(st.steps[id].tries.at(-1).msg); if (j?.outcome) outcomes.add(j.outcome); }
  ok("the run saw exact, outside and ambiguous" + (outcomes.has("unclear") ? ", and unclear as well" : ""), ["exact", "outside", "ambiguous"].every((x) => outcomes.has(x)), [...outcomes].join(" "));
  st.end = {}; for (const k of Object.keys(ROLES)) st.end[k] = String(await balance(acct[k].address));
  st.ended = new Date().toISOString();
  save();
  const net = (k) => BigInt(st.end[k]) - BigInt(st.start[k]);
  // what each account should have gained or lost, read off the ledger: an accepted order moves its
  // price from the buyer to the maker, an ambiguous one moves a slice of the bond from the maker to
  // the buyer, and the stake of the ejected card moved from the maker to the stranger
  const want = { m: -STAKE, b1: 0n, b2: 0n, s: STAKE };
  const key = Object.fromEntries(Object.keys(ROLES).map((k) => [low(k), k]));
  for (const r of Array.isArray(led) ? led : []) {
    const buyer = key[r.buyer];
    if (r.status === "accepted") { want[buyer] -= BigInt(r.price); want.m += BigInt(r.price); }
    want[buyer] += BigInt(r.bond_paid); want.m -= BigInt(r.bond_paid);
  }
  ok("over the run every account ends exactly where the ledger says: the maker up by the accepted orders less the slice of bond and the lost stake, each buyer down by what was accepted and up by any slice, and the stranger holding the stake", Object.keys(want).every((k) => net(k) === want[k]), Object.keys(want).map((k) => k.toUpperCase() + " " + Number(net(k)) / 1e18 + " (ledger " + Number(want[k]) / 1e18 + ")").join("  "));
}

st.checks = { pass, fail }; save();
console.log(`\n${pass} passed, ${fail} failed`);
console.log("Bracket:", st.bracket, "- Listing:", st.listing);
console.log("transactions:", st.order.reduce((n, id) => n + st.steps[id].tries.length, 0), "in", st.order.length, "steps; sent a second time:", st.order.filter((id) => st.steps[id].tries.length > 1).join(", ") || "none");
for (const id of st.order) { const s = st.steps[id], j = jsonOf(s.tries.at(-1).msg); if (j?.mask) console.log(`${id.padEnd(12)} ${s.tries.map((t) => t.tx + " " + tally(t.votes)).join(" | ")}  ${j.mask} ${j.outcome} ${j.order}`); }
console.log("record:", RECORD);
process.exit(fail ? 1 : 0);
