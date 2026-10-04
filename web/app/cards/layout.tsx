import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rate cards",
  description: "Every published rate card: its tiers and prices, the bond behind it, and whether it is clean or frozen.",
};

export default function CardsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
