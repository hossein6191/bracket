import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { PageGuide } from "@/components/page-guide";
import { Welcome } from "@/components/welcome";
import { SiteFooter } from "@/components/site-footer";
import KineticGrid from "@/components/ui/kinetic-grid";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/config";

// Geist for text; JetBrains Mono for numbers, prices, ids and tier marks.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME}: ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "A maker publishes a rate card once. A stranger types a brief and pays the dearest tier; in one transaction the contract says which tier covers the brief, keeps that tier's price in escrow and sends the rest straight back.",
  applicationName: SITE_NAME,
};

export const viewport: Viewport = {
  themeColor: "#161618",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark h-full antialiased ${geist.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        {/* The site background: one fixed layer behind everything. It wraps nothing, so sticky elements keep working. */}
        <KineticGrid className="fixed inset-0 -z-10 min-h-0" />
        <Providers>
          <SiteHeader />
          <Welcome />
          <main className="flex-1">
            <PageGuide />
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
