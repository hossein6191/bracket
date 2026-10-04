// The site's own wording for what the contract stores: the four outcomes, the five order
// statuses, a card's standing, and the contract's refusal texts turned into sentences a person
// can act on. No React here.

import type { Card, Order, OrderStatus, Outcome } from "./chain";
import { gen, when } from "./format";

/** One or two words for an outcome, for a badge. */
export function outcomeLabel(o: Outcome): string {
  switch (o) {
    case "exact":
      return "Priced";
    case "outside":
      return "Outside the card";
    case "ambiguous":
      return "Covered twice";
    case "unclear":
      return "No price fixed";
    default:
      return "No result";
  }
}

/**
 * What the outcome means for the buyer's money, in one plain sentence. `mask` is the order's tier
 * marks: a ladder card books several covering tiers at the narrowest, and calls a mask that is not
 * an unbroken run unclear; a card that is not a ladder has one "1" when exact and "?" when unclear.
 */
export function outcomeMeaning(o: Outcome, mask = ""): string {
  switch (o) {
    case "exact":
      if (mask.split("1").length > 2)
        return "Several nested tiers of this ladder card cover the whole brief, and the narrowest of them sets the price. Its price stays in escrow for the maker and the rest of what you sent came straight back.";
      return "One tier covers the whole brief. Its price stays in escrow for the maker and the rest of what you sent came straight back.";
    case "outside":
      return "No tier covers the whole brief, so the card has no price for it and everything you sent came back.";
    case "ambiguous":
      return "Two tiers of a card that promised no overlap both cover the brief. Everything you sent came back, the maker's bond paid you a slice on top, and the card is frozen until its maker revises it.";
    case "unclear":
      if (mask === "?")
        return "The two readings of the brief, made with the tiers in two different orders, named different tiers, so no price was fixed and everything you sent came back. The same brief cannot be asked again on this card.";
      if (mask)
        return "The tiers read as covering the brief are not an unbroken run up to the broadest tier, which a ladder card promises, so no price was fixed and everything you sent came back. The same brief cannot be asked again on this card.";
      return "The validators could not settle which tiers cover the brief, so no price was fixed and everything you sent came back. The same brief cannot be asked again on this card.";
    default:
      return "";
  }
}

/** One word for an order's status. */
export function statusLabel(s: OrderStatus): string {
  switch (s) {
    case "booked":
      return "Booked, in escrow";
    case "accepted":
      return "Accepted, maker paid";
    case "declined":
      return "Declined, buyer refunded";
    case "cancelled":
      return "Cancelled, buyer refunded";
    case "refunded":
      return "Refunded in full";
    default:
      return "Unknown";
  }
}

/** A card's standing in a few words. */
export function standingLabel(c: Pick<Card, "open" | "frozen" | "flags" | "revisedTo">): string {
  if (!c.open) return c.revisedTo ? `Closed, replaced by ${c.revisedTo}` : "Closed";
  if (c.frozen) return "Frozen";
  return c.flags.length ? "Open, flagged before" : "Clean";
}

/** "tiers 1 and 2" from the flag "1:2". */
export function flagWords(flag: string): string {
  const [a, b] = flag.split(":");
  return a && b ? `tiers ${a} and ${b}` : flag;
}

export type Viewer = "buyer" | "maker" | "other" | "nobody";

export function viewerOf(o: Pick<Order, "buyer" | "maker">, address: string): Viewer {
  if (!address) return "nobody";
  const me = address.toLowerCase();
  if (me === o.buyer) return "buyer";
  if (me === o.maker) return "maker";
  return "other";
}

/** What happens next on an order and who does it, for whoever is looking. */
export function nextMove(o: Order, viewer: Viewer): string {
  switch (o.status) {
    case "booked":
      if (viewer === "buyer")
        return `Next: the maker accepts or declines. Until then ${gen(o.priceAtto)} waits in escrow, and you may cancel and take it back with one signature, in under a minute.`;
      if (viewer === "maker")
        return `Next: you. Accept and ${gen(o.priceAtto)} is paid to you; decline and it goes back to the buyer. Either takes one signature and under a minute.`;
      return `Next: the maker accepts or declines, or the buyer cancels. Until then ${gen(o.priceAtto)} waits in escrow.`;
    case "accepted":
      return `Finished. The maker accepted${o.settledAt ? " on " + when(o.settledAt) : ""} and was paid ${gen(o.priceAtto)} from escrow. Nobody has anything left to do here.`;
    case "declined":
      return `Finished. The maker declined${o.settledAt ? " on " + when(o.settledAt) : ""} and ${gen(o.priceAtto)} went back to the buyer. Nobody has anything left to do here.`;
    case "cancelled":
      return `Finished. The buyer cancelled${o.settledAt ? " on " + when(o.settledAt) : ""} and took ${gen(o.priceAtto)} back from escrow. Nobody has anything left to do here.`;
    case "refunded":
      return o.outcome === "ambiguous"
        ? "Finished for the buyer, who was refunded and paid from the bond in the same transaction. Next: the card's maker, who must publish a revised card before it prices anything again."
        : "Finished. Everything the buyer sent came back in the same transaction, and nobody has anything left to do here.";
    default:
      return "";
  }
}

/**
 * A contract sentence made readable: the error tag dropped, long atto figures turned into GEN,
 * a capital at the start and a full stop at the end.
 */
export function sentence(reason: string): string {
  let t = String(reason ?? "")
    .replace(/^\s*\[(EXPECTED|TRANSIENT)\]\s*/i, "")
    .trim();
  if (!t) return "";
  t = t.replace(/\b(\d{1,40}) atto\b/g, (_, n: string) => gen(n));
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

/** A stats key as words: "open_cards" becomes "Open cards". */
export function statWords(key: string): string {
  const t = key.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** True when a stats key names an amount of atto and not a count. */
export const statIsMoney = (key: string, value: string): boolean =>
  /escrow|bond|paid|refund|volume|held|atto/i.test(key) || value.length > 15;
