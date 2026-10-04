"""Remove each defence of Bracket and its Listing fixture in turn, and record the test that killed it.

    python tools/mutate.py        # writes tests/MUTATIONS.md; exit 1 if any mutant survives

A passing count is a claim; this table is the evidence. Each mutant is written
to its own file (never over the source) and the suite runs against it with
bytecode caching off, so a stale .pyc can never attribute a kill to the wrong
code. The harness refuses to run over a failing baseline, refuses an anchor
that is not found exactly once, and treats a mutant that does not even import
as a broken anchor, never as a kill.
"""
import concurrent.futures
import os
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = (ROOT / "contracts" / "bracket.py").read_text(encoding="utf-8")
FSRC = (ROOT / "contracts" / "fixtures" / "listing.py").read_text(encoding="utf-8")
PYTEST = [sys.executable, "-m", "pytest", "-q", "-x", "--no-header", "-p", "no:cacheprovider",
          str(ROOT / "tests" / "test_pure.py")]
MINIMUM = 60

DOOR_LENGTH = '    if len(text) < least or len(text) > most:'
DOOR_ASCII = '        if ord(ch) < 32 or ord(ch) > 126:'
COMBINE = '    if first != "" and first == second:'
CLEAN = '    if len(text) == n and all(ch in "01" for ch in text):'
COMPARE = '    return str(theirs.get("v", "")) == str(mine["v"])'
RERUN = ('    try:\n'
         '        mine = leader_fn()\n'
         '    except Exception:\n'
         '        return False\n')
AMOUNT = '        if value != top:'
CARD_IDENTITY = '        parts.append(_norm(t["text"]) + "|" + str(t["price"]))'
CLEAN_CARD = 'clean = bool(c["open"]) and not bool(c["frozen"]) and len(c["flags"]) == 0'

# Each stretch runs from the first thing latched to the transfer, so that moving the transfer in front of the
# latch is a move and not a second payment.
Q_WRITE = '        self.order_count = u32(int(self.order_count) + 1)\n'
Q_PAY = ('        if refunded + bond_paid > 0:\n'
         '            _Payee(sender).emit_transfer(value=u256(refunded + bond_paid))\n')
QUOTED = SRC[SRC.index(Q_WRITE):SRC.index(Q_PAY) + len(Q_PAY)]
O_LATCH = '        o["status"] = status\n        o["settled_at"] = _stamp()\n'
O_PAY = ('        if amount > 0:\n'
         '            _Payee(Address(to)).emit_transfer(value=u256(amount))\n')
ENDED = SRC[SRC.index(O_LATCH):SRC.index(O_PAY) + len(O_PAY)]
C_LATCH = '        c["open"] = False\n        c["bond"] = "0"\n        self.card_rows[card_id] = json.dumps(c)\n'
C_PAY = ('        if bond > 0:\n'
         '            _Payee(Address(me)).emit_transfer(value=u256(bond))\n')
CLOSED = SRC[SRC.index(C_LATCH):SRC.index(C_PAY) + len(C_PAY)]
F_LATCH = ('        row["state"] = state\n'
           '        row["to"] = to\n'
           '        row["why"] = why\n'
           '        self.rows[card_id] = json.dumps(row)\n')
F_PAY = ('        if amount > 0:\n'
         '            _Payee(Address(str(to))).emit_transfer(value=u256(amount))\n')
F_SETTLED = FSRC[FSRC.index(F_LATCH):FSRC.index(F_PAY) + len(F_PAY)]

# (name, before, after) against bracket.py, or (name, before, after, "fixture").
MUTATIONS = [
    # --- the prompt boundary
    ("the fence leaves an opening angle bracket as it is",
     '        if ch == "<":\n            out.append("(")', '        if ch == "<":\n            out.append("<")'),
    ("the fence leaves a closing angle bracket as it is",
     '        elif ch == ">":\n            out.append(")")', '        elif ch == ">":\n            out.append(">")'),
    ("the fence deletes instead of replacing", '            out.append("(")', '            out.append("")'),
    ("a line break survives the fence",
     '        elif ord(ch) < 32 or ord(ch) in LINE_ENDERS:\n            out.append(" ")',
     '        elif ord(ch) < 32 or ord(ch) in LINE_ENDERS:\n            out.append(ch)'),
    ("only the control characters are taken for line breaks, and the other characters that end a line pass",
     '        elif ord(ch) < 32 or ord(ch) in LINE_ENDERS:', '        elif ord(ch) < 32:'),
    ("a text reaches the prompt unfenced",
     '">>>\\n" + _fence(text) + "\\n<<<END "', '">>>\\n" + str(text) + "\\n<<<END "'),
    ("the block builder prints whatever label it is handed on the delimiter line",
     'tag = label if label in LABELS else LABEL_FALLBACK', 'tag = label'),
    ("a card id is printed as it was typed, whatever is in it",
     '    return s if _is_id(s, "C") else NOT_A_CARD', '    return s'),
    ("an order id is printed as it was typed, whatever is in it",
     '    return s if _is_id(s, "O") else NOT_AN_ORDER', '    return s'),
    ("angle brackets pass the door", '        if ch == "<" or ch == ">":', '        if False:'),
    ("characters above ASCII pass the door", DOOR_ASCII, '        if ord(ch) < 32:'),
    ("control characters pass the door", DOOR_ASCII, '        if ord(ch) > 126:'),
    ("a text over its cap is judged anyway instead of refused at the door",
     DOOR_LENGTH, '    if len(text) < least:'),
    ("a text under its minimum passes the door", DOOR_LENGTH, '    if len(text) > most:'),
    ("the prompt no longer says the maker's and the buyer's words are untrusted",
     '        + UNTRUSTED_RULE + "\\n\\n"\n', ''),
    ("the prompt no longer says the letters and the order carry no meaning",
     '        + LETTER_RULE + "\\n\\n"\n', ''),
    ("the prompt no longer says a tier must cover every part of the brief",
     '        + COVER_RULE + "\\n\\n"\n', ''),
    ("the prompt no longer says each tier is judged on its own",
     '        + EACH_ALONE_RULE + "\\n\\n"\n', ''),
    ("the prompt no longer says not to guess at what the brief leaves out",
     '        + NO_GUESS_RULE + "\\n\\n"\n', ''),
    ("the card's title is left out of what is judged",
     'blocks = [_block(LABEL_TITLE, title)]', 'blocks = []'),
    ("the second asking shows the tiers in the same order as the first",
     'orders = (_first_order(total), _second_order(total))', 'orders = (_first_order(total), _first_order(total))'),
    ("the second order leaves the middle tier of three where it was",
     '    if n % 2 == 1 and n > 1:', '    if False:'),
    ("every tier is printed under its own letter whatever order was asked for",
     'blocks.append(_block(TIER_LABELS[p], texts[order[p] - 1]))', 'blocks.append(_block(TIER_LABELS[p], texts[p]))'),

    # --- reading the answer
    ("an answer is read as if the tiers had been shown in published order",
     '            bits[order[p] - 1] = "1"', '            bits[p] = "1"'),
    ("any word that is not YES is read as NO",
     '        elif word != WORD_NO:\n            return ""', '        elif False:\n            return ""'),
    ("two askings that differ are stored as the first one", COMBINE, '    if first != "":'),
    ("two askings nobody could read are stored as agreeing", COMBINE, '    if first == second:'),
    ("a value of the wrong length is stored as it came", CLEAN, '    if all(ch in "01" for ch in text):'),
    ("a value with other characters in it is stored as it came", CLEAN, '    if len(text) == n:'),
    ("the agreed value is stored without being held to the mask alphabet",
     '        return _clean_value(agreed.get("v", "") if isinstance(agreed, dict) else "", total)',
     '        return str(agreed.get("v", "")) if isinstance(agreed, dict) else "?"'),

    # --- the outcome
    ("two covering tiers on a card that is not a ladder book the first of them",
     '    if len(covering) == 1:', '    if len(covering) >= 1:'),
    ("a ladder card is read as a card that is not one",
     '    if ladder == "1":\n        if covering ==', '    if False:\n        if covering =='),
    ("a broken run on a ladder card is booked at its first covering tier",
     '        if covering == list(range(covering[0], len(mask) + 1)):', '        if True:'),
    ("a ladder card books the broadest covering tier",
     '            return EXACT, covering[0], ""\n        return UNCLEAR, 0, ""',
     '            return EXACT, covering[-1], ""\n        return UNCLEAR, 0, ""'),
    ("a reading that did not hold still is taken for no tier covering",
     '    if mask == SPLIT or mask == "":\n        return UNCLEAR, 0, ""',
     '    if False:\n        return UNCLEAR, 0, ""'),
    ("the flag names the last two covering tiers",
     'str(covering[0]) + ":" + str(covering[1])', 'str(covering[-2]) + ":" + str(covering[-1])'),

    # --- consensus
    ("the validator accepts whatever the leader stored", COMPARE, '    return True'),
    ("the validator compares how many tiers cover, not which",
     COMPARE, '    return str(theirs.get("v", "")).count("1") == str(mine["v"]).count("1")'),
    ("a validator whose own model fails raises instead of disagreeing", RERUN, '    mine = leader_fn()\n'),
    ("a validator whose own model fails agrees",
     '    except Exception:\n        return False\n    return str(theirs',
     '    except Exception:\n        return True\n    return str(theirs'),
    ("a leader's result that is not a table is accepted",
     '    if not isinstance(theirs, dict):\n        return False',
     '    if not isinstance(theirs, dict):\n        return True'),
    ("a leader's error is agreed with by a validator that saw none",
     '        leader_fn()\n        return False\n', '        leader_fn()\n        return True\n'),
    ("a validator that could not reach a model agrees with any error of the leader's",
     '        if mine.startswith(ERROR_TRANSIENT) and leader_msg.startswith(ERROR_TRANSIENT):',
     '        if mine.startswith(ERROR_TRANSIENT):'),
    ("two different rules are agreed on as the same error",
     '            return mine == leader_msg', '            return True'),
    ("a model that could not be reached is answered for instead of classified",
     '                    raise gl.vm.UserError(ERROR_TRANSIENT + " the model could not be reached")',
     '                    answer = {}'),
    ("a round no model could be reached for spends the brief",
     '        if mask == "":\n', '        if False:\n'),

    # --- publishing a card
    ("a card is published with no bond", '        if not problem and value < MIN_BOND:', '        if False:'),
    ("the ladder flag may be anything",
     '        if not problem and rung not in ("0", "1"):', '        if False:'),
    ("prices on a ladder card need not rise",
     '        if ladder == "1" and out and price <= int(out[-1]["price"]):', '        if False:'),
    ("two tiers of a ladder card may cost the same",
     'price <= int(out[-1]["price"])', 'price < int(out[-1]["price"])'),
    ("two tiers may say the same words",
     '            if _norm(out[j]["text"]) == _norm(text):', '            if False:'),
    ("a tier may cost nothing", '        if price < 1:', '        if price < 0:'),
    ("a card may have one tier or five",
     '    if len(items) < MIN_TIERS or len(items) > MAX_TIERS:', '    if False:'),
    ("a tier's words are kept as typed, not as they are judged",
     '        text = _tidy(item.get("text", ""))', '        text = str(item.get("text", ""))'),
    ("a card's title is kept as typed, not as it is judged",
     '        name = _tidy(title)\n        rung = str(ladder).strip()\n        tiers: typing.List[typing.Any] = []',
     '        name = str(title)\n        rung = str(ladder).strip()\n        tiers: typing.List[typing.Any] = []'),
    ("one ambiguous finding takes the whole bond", 'value // BOND_SLICES', 'value'),
    ("the top price is the last tier's, not the dearest",
     '        top = max(int(t["price"]) for t in tiers)', '        top = int(tiers[-1]["price"])'),
    ("tiers a flag was raised on are published again as a new card",
     '        if not problem and (me + ":" + digest) in self.spent_cards:', '        if False:'),
    ("a refused payment is kept",
     '        if int(value) > 0:\n            _Payee(sender).emit_transfer(value=u256(int(value)))',
     '        if False:\n            _Payee(sender).emit_transfer(value=u256(int(value)))'),
    ("a refusal is not counted", '        self.refusal_count = u32(seq)\n', ''),
    ("the refusal ring grows with every refused call",
     '        slot = (seq - 1) % REFUSALS_KEPT + 1', '        slot = seq'),

    # --- the quote
    ("a quote on a card that does not exist raises with the payment in hand",
     '        if card_id not in self.card_rows:\n            return self._refuse_payable(sender, value, "", "no card "',
     '        if False:\n            return self._refuse_payable(sender, value, "", "no card "'),
    ("the maker may quote their own card", '        if me == str(c["maker"]):', '        if False:'),
    ("a closed card takes a brief",
     '        if not c["open"]:\n            return self._refuse_payable(',
     '        if False:\n            return self._refuse_payable('),
    ("a frozen card takes a brief", '        if c["frozen"]:', '        if False:'),
    ("a quote sent with more than the top price is taken", AMOUNT, '        if value < top:'),
    ("a quote sent with less than the top price is taken", AMOUNT, '        if value > top:'),
    ("the same brief is judged twice on one card", '        if seen_key in self.brief_seen:', '        if False:'),
    ("a brief is identified as it was typed, so a change of case is a fresh reading",
     '        digest = _digest(text)', '        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()'),
    ("a brief is kept as typed, not as it is judged", '        text = _tidy(brief)', '        text = str(brief)'),
    ("a brief is not checked at the door",
     '        problem = _text_problem(text, MIN_BRIEF, MAX_BRIEF, "the brief")', '        problem = ""'),
    ("an unclear reading does not spend the brief, so it can be asked again",
     '        self.brief_seen[seen_key] = order_id\n',
     '        if outcome != UNCLEAR:\n            self.brief_seen[seen_key] = order_id\n'),
    ("what the brief does not need is not sent back",
     '        if refunded + bond_paid > 0:', '        if False:'),
    ("an ambiguous finding pays the buyer nothing from the bond",
     '            bond_paid = min(int(c["bond_slice"]), int(c["bond"]))', '            bond_paid = 0'),
    ("the slice paid to the buyer is not taken off the bond",
     '            c["bond"] = str(int(c["bond"]) - bond_paid)\n', ''),
    ("an ambiguous finding does not freeze the card", '            c["frozen"] = True\n', ''),
    ("an ambiguous finding leaves no flag on the card",
     '            c["flags"] = list(c["flags"]) + [pair]\n', ''),
    ("flagged tiers are not remembered against their maker",
     '            self.spent_cards[str(c["maker"]) + ":" + str(c["digest"])] = card_id\n', ''),
    ("an exact order holds the top price whatever tier covers",
     '        price = int(tiers[tier - 1]["price"]) if outcome == EXACT else 0',
     '        price = top if outcome == EXACT else 0'),
    ("the refund moves before the order and the card are written", QUOTED, Q_PAY + QUOTED[:-len(Q_PAY)]),

    # --- ending an order
    ("anybody may accept an order",
     '        if _low(gl.message.sender_address) != str(o["maker"]):\n            _fail("only the maker of " '
     '+ str(o["card"]) + " may accept "',
     '        if False:\n            _fail("only the maker of " + str(o["card"]) + " may accept "'),
    ("anybody may decline an order",
     '        if _low(gl.message.sender_address) != str(o["maker"]):\n            _fail("only the maker of " '
     '+ str(o["card"]) + " may decline "',
     '        if False:\n            _fail("only the maker of " + str(o["card"]) + " may decline "'),
    ("anybody may cancel an order",
     '        if _low(gl.message.sender_address) != str(o["buyer"]):', '        if False:'),
    ("a declined order pays the maker",
     'return self._close_order(order_id, o, DECLINED, str(o["buyer"]))',
     'return self._close_order(order_id, o, DECLINED, str(o["maker"]))'),
    ("an accepted order pays the buyer",
     'return self._close_order(order_id, o, ACCEPTED, str(o["maker"]))',
     'return self._close_order(order_id, o, ACCEPTED, str(o["buyer"]))'),
    ("an order is ended twice", '        if str(o["status"]) != BOOKED:', '        if False:'),
    ("the escrow moves before the order's status is latched", ENDED, O_PAY + ENDED[:-len(O_PAY)]),
    ("an ended order still counts as escrow held", '        self._add("held_escrow", -amount)\n', ''),
    ("an ended order still counts as booked on its card, so the card can never be closed",
     '        c["booked"] = int(c["booked"]) - 1\n', ''),

    # --- revising and closing a card
    ("anybody may revise a card",
     '        if me != str(c["maker"]):\n            _fail("only the maker of " + card_id + " may revise it")',
     '        if False:\n            _fail("only the maker of " + card_id + " may revise it")'),
    ("anybody may close a card and take its bond",
     '        if me != str(c["maker"]):\n            _fail("only the maker of " + card_id + " may close it")',
     '        if False:\n            _fail("only the maker of " + card_id + " may close it")'),
    ("a card with a booked order is closed", '        if int(c["booked"]) > 0:', '        if False:'),
    ("the same tiers pass for a revision", '        if digest == str(c["digest"]):', '        if False:'),
    ("tiers a flag was raised on pass for a revision",
     '        if (me + ":" + digest) in self.spent_cards:', '        if False:'),
    ("a card's identity leaves out its prices", CARD_IDENTITY, '        parts.append(_norm(t["text"]))'),
    ("a card's identity changes with the case of a letter",
     CARD_IDENTITY, '        parts.append(str(t["text"]) + "|" + str(t["price"]))'),
    ("a closed card is revised",
     '        if not c["open"]:\n            _fail(card_id + " is closed"',
     '        if False:\n            _fail(card_id + " is closed"'),
    ("a closed card is closed again",
     '        if not c["open"]:\n            _fail(card_id + " is already closed"',
     '        if False:\n            _fail(card_id + " is already closed"'),
    ("a revised card forgets the flags of the cards before it",
     'int(c["past_flags"]) + len(c["flags"])', '0'),
    ("the old card stays open after it is revised",
     '        c["open"] = False\n        c["bond"] = "0"\n        c["revised_to"] = new_id\n',
     '        c["bond"] = "0"\n        c["revised_to"] = new_id\n'),
    ("the bond is counted on the old card and on the revised one",
     '        c["bond"] = "0"\n        c["revised_to"] = new_id\n', '        c["revised_to"] = new_id\n'),
    ("a bond that no longer covers a slice backs a revised card",
     '        if bond < piece or bond < 1:', '        if False:'),
    ("closing a card keeps its bond",
     '        if bond > 0:\n            _Payee(Address(me)).emit_transfer(value=u256(bond))',
     '        if False:\n            _Payee(Address(me)).emit_transfer(value=u256(bond))'),
    ("the bond moves before the card is latched closed", CLOSED, C_PAY + CLOSED[:-len(C_PAY)]),

    # --- views
    ("a closed card reads as clean", CLEAN_CARD, 'clean = not bool(c["frozen"]) and len(c["flags"]) == 0'),
    ("a frozen card with a flag reads as clean", CLEAN_CARD, 'clean = bool(c["open"])'),
    ("the ledger returns as many rows as it is asked for",
     '        want = PAGE if (want < 1 or want > PAGE) else want', '        want = PAGE if want < 1 else want'),
    ("a page of cards has no end",
     '        for k in range(top, max(0, top - PAGE), -1):\n            key = "C" + str(k)',
     '        for k in range(top, 0, -1):\n            key = "C" + str(k)'),
    ("the ids of a card's orders are listed without end",
     '[str(self.card_orders[card_id + ":" + str(k)])\n                           '
     'for k in range(n, max(0, n - IDS_PAGE), -1)]',
     '[str(self.card_orders[card_id + ":" + str(k)])\n                           for k in range(n, 0, -1)]'),

    # --- the Listing fixture
    ("anybody may feature somebody else's card",
     '            elif str(seen.get("maker", "")).lower() != me:', '            elif False:', "fixture"),
    ("a card that is not clean is featured",
     '            elif seen.get("clean") is not True:', '            elif False:', "fixture"),
    ("a card the register does not clearly say exists is featured",
     '            elif seen.get("exists") is not True:', '            elif not seen.get("exists"):', "fixture"),
    ("a stake below the minimum is taken", '        elif value < MIN_STAKE:', '        elif False:', "fixture"),
    ("a card is featured twice at once",
     '        elif self._state(card_id) == FEATURED:', '        elif False:', "fixture"),
    ("a card id of any shape is sent to the register",
     '        if not _is_card_id(card_id):', '        if False:', "fixture"),
    ("a refused stake is kept",
     '            if value > 0:\n                _Payee(sender).emit_transfer(value=u256(value))',
     '            if False:\n                _Payee(sender).emit_transfer(value=u256(value))', "fixture"),
    ("a register that cannot be read raises with the stake in hand",
     '        try:\n            return self._seen(card_id)\n        except Exception:\n            return None',
     '        return self._seen(card_id)', "fixture"),
    ("anybody may withdraw a stake",
     '        if _low(gl.message.sender_address) != str(row["maker"]):', '        if False:', "fixture"),
    ("the stake of a flagged card is withdrawn",
     '        if self._flagged(self._seen(card_id)):', '        if False:', "fixture"),
    ("the maker ejects their own card and keeps the stake",
     '        if me == str(row["maker"]):', '        if False:', "fixture"),
    ("a card with no flag is ejected", '        if not self._flagged(seen):', '        if False:', "fixture"),
    ("an answer that is not a list of flags counts as a flag",
     '        return isinstance(flags, list) and len(flags) > 0', '        return bool(flags)', "fixture"),
    ("a settled stake is settled again", '        if str(row["state"]) != FEATURED:', '        if False:', "fixture"),
    ("the stake of an ejected card goes back to its maker",
     'return self._settle(card_id, row, EJECTED, me, ', 'return self._settle(card_id, row, EJECTED, str(row["maker"]), ',
     "fixture"),
    ("the stake moves before the outcome is latched", F_SETTLED, F_PAY + F_LATCH, "fixture"),
    ("the register is taken on trust at deployment", '        if not self._answers():', '        if False:', "fixture"),
    ("any text is taken for the register's address",
     '        if not _is_address(str(register)):', '        if False:', "fixture"),
]


def _env(**extra):
    return dict(os.environ, PYTHONDONTWRITEBYTECODE="1", **extra)


def run(main_path: pathlib.Path, fixture_path: pathlib.Path) -> str:
    out = subprocess.run(PYTEST, env=_env(BRACKET_SOURCE=str(main_path), LISTING_SOURCE=str(fixture_path)),
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode == 0:
        return ""
    text = out.stdout + out.stderr
    if "error during collection" in text or "IndentationError" in text or "SyntaxError" in text:
        raise RuntimeError("the mutant does not even import; that is a broken anchor, not a killed defence:\n"
                           + text[-600:])
    m = re.search(r"FAILED tests/test_pure\.py::(\S+)", text)
    if not m:
        raise RuntimeError("a test failed but its name could not be read:\n" + text[-800:])
    return m.group(1)


def main() -> int:
    baseline = subprocess.run(PYTEST, env=_env(), capture_output=True, text=True, cwd=ROOT)
    if baseline.returncode != 0:
        print("the unmutated suite does not pass; a mutation table over a failing suite proves nothing")
        print((baseline.stdout + baseline.stderr)[-600:])
        return 3
    bad = 0
    for entry in MUTATIONS:
        base = FSRC if (len(entry) > 3 and entry[3] == "fixture") else SRC
        if base.count(entry[1]) != 1 or entry[1] == entry[2]:
            print(f"  ! anchor found {base.count(entry[1])} times, expected once: {entry[0]}")
            bad += 1
    if bad:
        return 2
    if len({e[0] for e in MUTATIONS}) != len(MUTATIONS):
        print("  ! two mutations share a name")
        return 2
    rows, escaped = [], []
    with tempfile.TemporaryDirectory() as tmp:
        def one(k):
            entry = MUTATIONS[k]
            name, old, new = entry[0], entry[1], entry[2]
            target = entry[3] if len(entry) > 3 else "bracket"
            main_path = pathlib.Path(tmp) / f"bracket_{k}.py"
            fixture_path = pathlib.Path(tmp) / f"listing_{k}.py"
            main_path.write_text(SRC.replace(old, new) if target == "bracket" else SRC, encoding="utf-8")
            fixture_path.write_text(FSRC.replace(old, new) if target == "fixture" else FSRC, encoding="utf-8")
            return name, target, run(main_path, fixture_path)

        jobs = max(1, int(os.environ.get("MUTATE_JOBS", "4")))
        with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
            for name, target, killer in pool.map(one, range(len(MUTATIONS))):
                (rows if killer else escaped).append((name, target, killer))
                print(f"  {'killed ' if killer else 'ESCAPED'}  {name}" + (f"  <- {killer}" if killer else ""))
    if escaped:
        print(f"\n{len(escaped)} mutant(s) escaped; no table written.")
        return 1
    if len(rows) < MINIMUM:
        print(f"\nonly {len(rows)} defences are covered and {MINIMUM} are required; no table written.")
        return 1
    table = ["# Mutations", "",
             f"{len(rows)} defences in `contracts/bracket.py` and `contracts/fixtures/listing.py`, each removed "
             "or inverted in turn, and the test that failed because of it. Generated by `tools/mutate.py`; it refuses "
             "to write this file if any mutant survives, if an anchor is not found exactly once, or if the "
             "unmutated suite is not green.", "",
             "| file | defence removed | killed by |", "|---|---|---|"]
    table += [f"| {'listing.py' if t == 'fixture' else 'bracket.py'} | {n} | `{k}` |" for n, t, k in rows] + [""]
    (ROOT / "tests" / "MUTATIONS.md").write_text("\n".join(table), encoding="utf-8")
    print(f"\n{len(rows)} / {len(rows)} killed - tests/MUTATIONS.md written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
