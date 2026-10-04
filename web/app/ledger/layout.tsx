import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ledger",
  description: "Every order on every card, with its outcome, its price and the sentence the contract wrote. No wallet needed.",
};

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
