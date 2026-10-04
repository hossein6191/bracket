// The route's own browser title. The id comes from the URL, so the tab is titled from the route
// alone: no chain read, and a made-up id never reaches the title.
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = /^O?([1-9]\d{0,8})$/i.exec(id);
  return {
    title: m ? `Order O${m[1]}` : "Order",
    description: "One order: the brief, which tiers covered it, where the money went, and what the buyer or the maker can still do.",
  };
}

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
