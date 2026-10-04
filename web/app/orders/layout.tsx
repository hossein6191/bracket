import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your orders",
  description: "The briefs the connected wallet asked as a buyer, and the orders on the cards it published.",
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
