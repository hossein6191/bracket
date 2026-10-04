import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ledger",
  description: "The newest orders on every card, with their outcomes, prices and the sentences the contract wrote. No wallet needed.",
};

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
