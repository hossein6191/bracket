# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Listing: a featured shelf that a rate card keeps only while it is clean.

A second, independent contract that turns a Bracket card's standing into money
moving. It is deployed bound to one Bracket address and reads that register
through an ordinary synchronous view, `standing(card)`. No model runs here. It
is small on purpose and it is here to be read.

A maker stakes a deposit to have a card featured. The stake is accepted only
from the address the register names as that card's maker, and only while the
card is clean: open, not frozen, and carrying no flag. From then on exactly one
of two things can happen to the stake:

    the card still carries no flag    its maker may withdraw the stake
    the card carries a flag           anybody but its maker may eject it, and
                                      the stake is paid to whoever does

So one of the two paths is always open, and the stake is never stuck. A flag
stays on a Bracket card for ever, so a flagged card can never be withdrawn,
only ejected.

A card id is never authority on its own: ids are handed out in order. The
register address is bound at deployment, and the maker is read from the
register, never taken from the caller.

The limit, said plainly: the maker is refused as the ejector, but an address is
free, so a maker who watches the register can eject their own card from another
address before anybody else does. A shelf that wanted more than a demonstration
of the consequence would burn the stake or pay it to the buyer whose brief
raised the flag.
"""

import json
import typing

from genlayer import *


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass


ERROR_EXPECTED = "[EXPECTED]"
ZERO = "0x0000000000000000000000000000000000000000"
HEX = "0123456789abcdef"

FEATURED = "featured"
WITHDRAWN = "withdrawn"        # the maker took the stake back from a card with no flag
EJECTED = "ejected"            # the card carried a flag; the stake went to whoever ejected it

GEN_ATTO = 1000000000000000000
MIN_STAKE = GEN_ATTO           # one GEN: the least a maker stakes to be featured
SHELF_PAGE = 24                # shelf() lists the most recent; every entry is still read by its card id
NOT_A_CARD = "(not a card id)"


def _fail(message: str) -> typing.NoReturn:
    raise gl.vm.UserError(ERROR_EXPECTED + " " + message)


def _low(address: typing.Any) -> str:
    return (address.as_hex if hasattr(address, "as_hex") else str(address)).lower()


def _is_address(text: typing.Any) -> bool:
    s = str(text).strip().lower()
    return len(s) == 42 and s.startswith("0x") and all(ch in HEX for ch in s[2:]) and s != ZERO


def _is_card_id(text: typing.Any) -> bool:
    """Exactly the ids the register assigns: C, then 1 to 10 ASCII digits with no leading zero."""
    s = str(text)
    digits = s[1:]
    return (2 <= len(s) <= 11 and s[0] == "C" and digits[0] != "0"
            and all(ch in "0123456789" for ch in digits))


def _card_word(raw: typing.Any) -> str:
    s = str(raw).strip()
    return s if _is_card_id(s) else NOT_A_CARD


class Listing(gl.Contract):
    register: Address
    n_entries: u32
    rows: TreeMap[str, str]          # "C1"  -> JSON: the latest entry for that card
    shelf_rows: TreeMap[str, str]    # "1"   -> "C1": cards in the order they were featured

    def __init__(self, register: str) -> None:
        if not _is_address(str(register)):
            _fail("the register is a 0x address of 40 hexadecimal digits")
        self.register = Address(str(register).strip())
        self.n_entries = u32(0)
        # Every stake here can only ever be settled by reading this register. So it is read once
        # now, and a deployment against an address that does not answer as one fails, before anybody
        # can send value to a contract that could never give it back.
        if not self._answers():
            _fail("the address given does not answer as a Bracket register: its stats() view did not return "
                  "the counters a register returns")

    @gl.public.write.payable
    def feature(self, card: str) -> str:
        """Stake a deposit to have a card featured. The card's maker only, and only while it is clean.

        The sender check: the register is asked who made the card, and a sender
        who is not that address is refused. It never raises once value has been
        sent: every refusal, a register that could not be read included, returns
        the value in the same transaction and answers ok: false.
        """
        value = int(gl.message.value)
        sender = gl.message.sender_address
        me = _low(sender)
        card_id = str(card).strip()
        problem = ""
        if not _is_card_id(card_id):
            problem = "a card id is C followed by digits, as the register assigns them"
        elif value < MIN_STAKE:
            problem = "the stake is at least " + str(MIN_STAKE) + " atto, which is one GEN"
        elif self._state(card_id) == FEATURED:
            problem = card_id + " is already featured"
        else:
            seen = self._seen_or_none(card_id)
            if seen is None:
                problem = "the register could not be read, so nothing was staked; the same call may be made again"
            elif seen.get("exists") is not True:
                problem = "the register has no card " + card_id
            elif str(seen.get("maker", "")).lower() != me:
                problem = "only the maker of " + card_id + ", as the register names them, may feature it"
            elif seen.get("clean") is not True:
                problem = (card_id + " is not clean: a card is featured only while it is open, not frozen and "
                           "carries no flag")
        if problem:
            if value > 0:
                _Payee(sender).emit_transfer(value=u256(value))
            return json.dumps({"ok": False, "reason": problem, "returned": str(value), "by": me})
        self.n_entries = u32(int(self.n_entries) + 1)
        self.shelf_rows[str(int(self.n_entries))] = card_id
        self.rows[card_id] = json.dumps({"card": card_id, "maker": me, "stake": str(value), "state": FEATURED,
                                         "to": "", "why": ""})
        return json.dumps({"ok": True, "card": card_id, "maker": me, "stake": str(value), "state": FEATURED})

    @gl.public.write
    def withdraw(self, card: str) -> str:
        """Take the stake back from a featured card that carries no flag. The maker who staked it only.

        The sender check is the whole authority rule: the sender must be the
        address written on the entry as its maker, and the stake goes back to
        that address. A card that carries a flag can no longer be withdrawn.
        """
        card_id = str(card).strip()
        row = self._featured(card_id)
        if _low(gl.message.sender_address) != str(row["maker"]):
            _fail("only the maker who staked " + card_id + " may withdraw it")
        if self._flagged(self._seen(card_id)):
            _fail(card_id + " carries a flag on the register, so its stake can no longer be withdrawn; it is "
                  "paid to whoever ejects the card")
        return self._settle(card_id, row, WITHDRAWN, str(row["maker"]), "the card carried no flag")

    @gl.public.write
    def eject(self, card: str) -> str:
        """Eject a featured card that carries a flag; the stake is paid to the caller. Anyone but its maker.

        The sender check: the address that staked the card is refused, and the
        stake is paid to the sender. Otherwise open to anybody on purpose, since
        the caller chooses nothing: whether the card may be ejected is fixed by
        the register's own row before the call is made.
        """
        card_id = str(card).strip()
        row = self._featured(card_id)
        me = _low(gl.message.sender_address)
        if me == str(row["maker"]):
            _fail("the maker who staked " + card_id + " may not eject it")
        seen = self._seen(card_id)
        if not self._flagged(seen):
            _fail(card_id + " carries no flag on the register; a featured card is ejected only once two of its "
                  "tiers were found to overlap")
        return self._settle(card_id, row, EJECTED, me, "the register shows " + str(len(seen["flags"]))
                            + " flag(s) on the card")

    @gl.public.view
    def entry(self, card: str) -> str:
        """The latest entry for one card: who staked it, how much, and what became of the stake."""
        card_id = str(card).strip()
        if card_id not in self.rows:
            return json.dumps({"error": "no entry for " + _card_word(card_id)})
        return json.dumps(json.loads(str(self.rows[card_id])))

    @gl.public.view
    def shelf(self) -> str:
        """The cards featured now, newest first, among the 24 most recent entries."""
        total = int(self.n_entries)
        out = []
        for k in range(total, max(0, total - SHELF_PAGE), -1):
            card_id = str(self.shelf_rows[str(k)])
            if card_id not in out and self._state(card_id) == FEATURED:
                out.append(card_id)
        return json.dumps(out)

    @gl.public.view
    def terms(self) -> str:
        """The register this shelf is bound to, and the rule it enforces, in words."""
        return json.dumps({
            "register": _low(self.register), "entries": int(self.n_entries), "min_stake": str(MIN_STAKE),
            "feature": "the maker the register names, while the card is open, not frozen and carries no flag",
            "withdraw": "that maker, while the card carries no flag",
            "eject": "anybody but that maker, once the card carries a flag; the stake is paid to the caller",
            "binding": "a card id is not authority on its own, because ids are handed out in order; the register "
                       "address is bound at deployment and the maker is read from the register",
        })

    # --------------------------------------------------------------- helpers

    def _answers(self) -> bool:
        """Whether the bound address answers as a register: its stats() view returns the counters.

        The call itself is not wrapped: an address that cannot be read at all
        reverts the deployment, which is the outcome wanted.
        """
        raw = gl.get_contract_at(self.register).view().stats()
        try:
            out = json.loads(str(raw))
        except Exception:
            out = None
        return isinstance(out, dict) and "cards" in out and "held_bonds" in out

    def _state(self, card_id: str) -> str:
        if card_id not in self.rows:
            return ""
        return str(json.loads(str(self.rows[card_id])).get("state", ""))

    def _featured(self, card_id: str) -> typing.Dict[str, typing.Any]:
        if card_id not in self.rows:
            _fail("no entry for " + _card_word(card_id))
        row = json.loads(str(self.rows[card_id]))
        if str(row["state"]) != FEATURED:
            _fail(card_id + " is already " + str(row["state"]))
        return row

    def _seen(self, card_id: str) -> typing.Dict[str, typing.Any]:
        """What the bound register says about one card, through an ordinary synchronous view.

        The call itself is not wrapped: a register that cannot be read reverts
        the whole transaction, which changes nothing and leaves the caller free
        to try again. Only a call that carries no value goes through here.
        """
        raw = gl.get_contract_at(self.register).view().standing(str(card_id))
        try:
            out = json.loads(str(raw))
        except Exception:
            out = {}
        return out if isinstance(out, dict) else {}

    def _seen_or_none(self, card_id: str) -> typing.Any:
        """The same reading for a call that carries value: a failure is an answer, never a raise.

        Value sent with a call that raises is not returned, so the payable path
        turns an unreadable register into a refusal that returns the stake.
        """
        try:
            return self._seen(card_id)
        except Exception:
            return None

    def _flagged(self, seen: typing.Dict[str, typing.Any]) -> bool:
        """Whether the register shows at least one flag on the card. A flag stays for ever."""
        flags = seen.get("flags", [])
        return isinstance(flags, list) and len(flags) > 0

    def _settle(self, card_id: str, row: typing.Dict[str, typing.Any], state: str, to: str, why: str) -> str:
        """Latch the outcome on this contract, then pay. The latch precedes the transfer, every time."""
        amount = int(row["stake"])
        row["state"] = state
        row["to"] = to
        row["why"] = why
        self.rows[card_id] = json.dumps(row)
        if amount > 0:
            _Payee(Address(str(to))).emit_transfer(value=u256(amount))
        return json.dumps({"ok": True, "card": card_id, "state": state, "to": to, "amount": str(amount),
                           "reason": why})
