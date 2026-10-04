"use client";

// A slim bar: the mark and name at the left, the sections as a numbered monospace strip with a
// thin line under the current one, and the wallet at the right. Under 1024 px the strip takes
// its own row and scrolls sideways inside itself, never the page.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { MockPersona } from "@/components/mock-bar";
import { WalletButton, WrongChainBanner } from "@/components/wallet";
import { WelcomeButton } from "@/components/welcome";
import { CHAIN_ID, isMock } from "@/lib/chain";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/cards", label: "Cards" },
  { href: "/publish", label: "Publish" },
  { href: "/orders", label: "Orders" },
  { href: "/ledger", label: "Ledger" },
  { href: "/deploy", label: "Deploy" },
] as const;

/** The network tag. With `compact`, the text goes under 420 px and only the dot stays. */
export function NetworkBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[4px] border border-white/12 bg-black/30 px-2 font-mono text-[10.5px] whitespace-nowrap text-muted-foreground",
        className,
      )}
      title={isMock ? "Demo mode: an in-memory copy of the contract" : `GenLayer Studio test network (chain ${CHAIN_ID})`}
      aria-label={isMock ? "Demo mode" : `GenLayer Studio, chain ${CHAIN_ID}`}
    >
      <span className="relative flex size-1.5" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-secondary/60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-1.5 rounded-full bg-brand-secondary" />
      </span>
      <span className={cn(compact && "hidden min-[420px]:inline")}>{isMock ? "Demo mode" : `Studio · ${CHAIN_ID}`}</span>
    </span>
  );
}

function isActive(pathname: string, href: string): boolean {
  // A single card belongs to the cards, a single order to the orders.
  if (href === "/cards") return pathname === "/cards" || pathname.startsWith("/card/");
  if (href === "/orders") return pathname === "/orders" || pathname.startsWith("/order/");
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-[#111112]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#111112]/70">
      {/* Inside the sticky header, so the header never slides over it once the page scrolls. */}
      <WrongChainBanner />
      <div className="container-site flex flex-wrap items-center gap-x-6">
        <Link
          href="/"
          className="order-1 flex h-12 shrink-0 items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>

        {/* One strip for every width: its own full-width row under 1024 px, inline above. */}
        <nav
          aria-label="Main"
          className="scrollbar-none order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto border-t px-4 lg:order-2 lg:mx-0 lg:w-auto lg:min-w-0 lg:flex-1 lg:border-t-0 lg:px-0"
        >
          <ol className="flex h-10 w-max items-stretch lg:h-12">
            {NAV.map((n, i) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href} className="flex">
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-1.5 px-2.5 font-mono text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className={cn("text-[10px] tabular-nums", active ? "text-brand" : "text-white/35 group-hover:text-white/60")}>
                      {String(i + 1)}
                    </span>
                    {n.label}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-2.5 bottom-0 h-px transition-opacity",
                        active ? "bg-brand opacity-100 shadow-[0_0_8px_#4a9eff]" : "bg-white/30 opacity-0 group-hover:opacity-100",
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="order-2 ml-auto flex h-12 min-w-0 items-center gap-2 lg:order-3 lg:ml-0">
          <WelcomeButton />
          <NetworkBadge compact />
          {isMock ? null : <WalletButton inHeader />}
        </div>
      </div>
      {isMock ? <MockPersona /> : null}
    </header>
  );
}
