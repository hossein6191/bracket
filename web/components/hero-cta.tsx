"use client";

import { useRouter } from "next/navigation";

import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";

/** The landing page's main action: straight to the cards, where a visitor asks for a price. */
export function HeroCta() {
  const router = useRouter();
  return <InteractiveHoverButton onClick={() => router.push("/cards")}>Get a binding price</InteractiveHoverButton>;
}
