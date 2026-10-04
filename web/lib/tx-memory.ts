// The transaction that made each order, remembered in this browser. A contract does not know the
// hash of the transaction that runs it, so the order row on chain cannot carry it; the browser
// that sent the quote can, and the order page then links straight to it on the explorer.

import { readItem, writeItem } from "@/lib/browser-store";
import { contractAddress } from "@/lib/chain";

const keyOf = (order: string) => `bracket:quote-tx:${contractAddress().toLowerCase()}:${order}`;

export function rememberQuoteTx(order: string, hash: string): void {
  if (order && /^0x[0-9a-fA-F]{64}$/.test(hash)) writeItem(keyOf(order), hash);
}

export function quoteTxOf(order: string): string {
  const h = readItem(keyOf(order));
  return /^0x[0-9a-fA-F]{64}$/.test(h) ? h : "";
}
