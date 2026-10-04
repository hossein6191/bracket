import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">There is no page at this address</h1>
      <p className="text-muted-foreground">
        Nothing is wrong with the contract or with your wallet. The cards page lists every rate card, and the ledger the newest orders.
      </p>
      <div className="flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/" className="text-brand underline-offset-4 hover:underline">
          Start page
        </Link>
        <Link href="/cards" className="text-brand underline-offset-4 hover:underline">
          Cards
        </Link>
        <Link href="/ledger" className="text-brand underline-offset-4 hover:underline">
          Ledger
        </Link>
      </div>
    </div>
  );
}
