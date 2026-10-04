// The route's own browser title. The id comes from the URL, so the tab is titled from the route
// alone: no chain read, and a made-up id never reaches the title.
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = /^C?([1-9]\d{0,8})$/i.exec(id);
  return {
    title: m ? `Card C${m[1]}` : "Card",
    description: "One rate card: its tiers and prices, and the box where a visitor types a brief and gets a binding price.",
  };
}

export default function CardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
