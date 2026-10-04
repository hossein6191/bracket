import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Publish a card",
  description: "Publish your own rate card with two to four tiers and an ambiguity bond, and revise or close the cards you published.",
};

export default function PublishLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
