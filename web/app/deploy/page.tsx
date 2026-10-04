"use client";

// Deploy your own copy of the contract from your wallet, or point this browser at one.
// The page fetches the source the site ships (public/contracts/bracket.py, a byte copy of the
// repository's contract kept identical by tools/sync-contract.mjs), shows its sha256 so anybody
// can compare it with the repository, and signs one deploy transaction. The address it produces
// is remembered in this browser and used by every page at once. A pasted address is stored only
// after it answers cards() like this contract, and the site's own default is never stored as an
// override: choosing it simply clears the override.

import { SectionHelp } from "@/components/section-help";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, ExternalLink, Loader2, Rocket, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TxRail } from "@/components/tx-rail";
import { cleanWalletError, succeeded } from "@/components/use-tx";
import { useLocal } from "@/components/use-local";
import { useMe } from "@/components/use-me";
import { useGuideProgress } from "@/components/guide-progress";
import { WalletGate } from "@/components/wallet-gate";
import {
  CONTRACT_FILE,
  CONTRACT_SOURCE_PATH,
  RATE_LIMITED,
  addressUrl,
  contractAddress,
  deploy,
  deployedAddress,
  invalidateReads,
  isMock,
  readCards,
  txUrl,
  type TxStatus,
} from "@/lib/chain";
import { REPO_URL } from "@/lib/config";
import { short } from "@/lib/format";
import { sha256Hex } from "@/lib/hash";
import { isAddress, lastDeployRaw, parseLastDeploy, registerOverride, rememberDeploy, setRegisterOverride, siteRegister } from "@/lib/register";

const card = "space-y-4 surface p-5 sm:p-6";

type Probe = "register" | "no-answer" | "rate-limited";

/**
 * Reads cards() from `address` before this browser is pointed at it, with the usual retries
 * (Studio can answer "not found" for about a minute after a deploy). Only this contract answers.
 */
async function probeRegister(address: string): Promise<Probe> {
  try {
    await readCards(address);
    return "register";
  } catch (e) {
    return e instanceof Error && e.message === RATE_LIMITED ? "rate-limited" : "no-answer";
  }
}

const sameAddress = (a: string, b: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** The site's default is never stored as an override: choosing it makes this browser follow the site again. */
function chooseRegister(address: string) {
  setRegisterOverride(address && !sameAddress(address, siteRegister()) ? address : null);
  // Another copy has its own cards and orders: start again with nothing cached.
  invalidateReads();
}

export default function DeployPage() {
  const me = useMe();
  const [code, setCode] = React.useState("");
  const [digest, setDigest] = React.useState("");
  const [loadError, setLoadError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  // The deploy hash lives in local state; TxRail polls it like any other transaction.
  const [hash, setHash] = React.useState<string | null>(null);
  const [waitingAddress, setWaitingAddress] = React.useState(false);
  /** the deploy finished without a usable contract: the button may be pressed again */
  const [deployFailed, setDeployFailed] = React.useState(false);
  const [manual, setManual] = React.useState("");
  const [manualError, setManualError] = React.useState("");
  const [manualNote, setManualNote] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  // What this browser reads right now, and where that came from (re-rendered on every change).
  const inUse = useLocal(() => contractAddress(), siteRegister());
  const override = useLocal(registerOverride, "");
  const lastRaw = useLocal(lastDeployRaw, "");
  const last = React.useMemo(() => parseLastDeploy(lastRaw), [lastRaw]);
  const site = siteRegister();
  useGuideProgress("deploy", override ? 2 : busy || hash ? 1 : 0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(CONTRACT_SOURCE_PATH, { cache: "no-store" });
        if (!res.ok) throw new Error(`the site answered ${res.status}`);
        const text = await res.text();
        if (!alive) return;
        setCode(text);
        setDigest(await sha256Hex(text));
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "could not load the contract source");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // An override equal to the site's default is cleared on sight.
  React.useEffect(() => {
    if (sameAddress(override, site)) setRegisterOverride(null);
  }, [override, site]);

  const onDone = React.useCallback(
    async (s: TxStatus) => {
      if (!hash) return;
      // Studio writes the address on a deploy tx when it is sent, so a deploy that failed has one
      // too: only a deploy that went through may become the contract this browser reads.
      if (!succeeded(s)) {
        setError(
          s.undetermined || s.status === "CANCELED" || s.applied === false
            ? "The deploy was not applied, so nothing was deployed. Press Deploy to try again."
            : "The deploy finished but the contract did not load, so nothing usable was deployed and this browser keeps reading the contract it used before. Press Deploy to try again.",
        );
        setDeployFailed(true);
        return;
      }
      setWaitingAddress(true);
      try {
        // The address is on the transaction once the network accepted it.
        for (let i = 0; i < 20; i++) {
          try {
            const a = await deployedAddress(hash);
            if (a) {
              rememberDeploy({ address: a, hash, at: new Date().toISOString() });
              // This browser reads the new copy from now on.
              chooseRegister(a);
              return;
            }
          } catch {
            /* try again */
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
        setError("The deploy finished but its address could not be read yet. Reload this page in a minute; the transaction link above has it.");
      } finally {
        setWaitingAddress(false);
      }
    },
    [hash],
  );

  const start = async () => {
    setError("");
    setBusy(true);
    setDeployFailed(false);
    try {
      setHash(null);
      setHash(await deploy(code));
    } catch (e) {
      // The commonest outcome here is Reject in the wallet: say that, not the wallet's whole error.
      setError(cleanWalletError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the address is still on screen */
    }
  };

  const applyManual = async () => {
    const a = manual.trim();
    setManualNote("");
    if (!isAddress(a)) {
      setManualError("That is not a 0x address of 40 hexadecimal characters.");
      return;
    }
    setManualError("");
    if (sameAddress(a, site)) {
      chooseRegister(a);
      setManual("");
      setManualNote("That is the site's own contract, so this browser follows the site's default again.");
      return;
    }
    if (sameAddress(a, override)) {
      setManual("");
      setManualNote("This browser already reads that address.");
      return;
    }
    if (!isMock) {
      setChecking(true);
      const r = await probeRegister(a);
      setChecking(false);
      if (r === "rate-limited") {
        setManualError("Studio is rate-limiting this browser (30 reads a minute). Nothing was changed; try again in a minute.");
        return;
      }
      if (r === "no-answer") {
        setManualError(
          "No Bracket contract answered at that address, so nothing was changed. Check the address; a copy deployed in the last two minutes, or a slow moment on Studio, may need one more try.",
        );
        return;
      }
    }
    chooseRegister(a);
    setManual("");
    setManualNote(`This browser now reads ${short(a, 6, 4)}. Every page uses it from now on.`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Deploy your own copy</h1>
        <p className="text-muted-foreground">
          One deployed copy of the contract holds every card and every order asked on it. You can deploy your own from your
          wallet with one signature, and this browser will use it from then on. The code is the file below, byte for byte.
        </p>
      </div>

      {isMock ? (
        <p className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
          Demo mode: the button below runs through the same steps against the in-memory contract and deploys nothing.
        </p>
      ) : null}

      <section className={card}>
        <h2 className="text-lg font-semibold">The contract this browser uses <SectionHelp k="deploy-register" /></h2>
        {inUse ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-background px-2 py-1 font-mono text-xs break-all">{inUse}</code>
            <Button variant="outline" size="sm" onClick={() => void copy(inUse)}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={addressUrl(inUse)} target="_blank" rel="noreferrer">
                <ExternalLink /> Explorer
              </a>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            None yet: no contract is configured for this site. Deploy one below, or paste the address of one that exists.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {override ? "Your own choice, made on this page. Every page of the site reads it in this browser." : inUse ? "The site's default contract." : ""}
        </p>
        {override && site && !sameAddress(override, site) ? (
          <Button variant="outline" size="sm" onClick={() => chooseRegister("")}>
            <Undo2 /> Back to the site&apos;s contract ({short(site, 6, 4)})
          </Button>
        ) : null}
        <form
          className="flex flex-col gap-2 pt-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void applyManual();
          }}
        >
          <Input
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              setManualError("");
            }}
            placeholder="Paste a contract address (0x...)"
            className="font-mono text-xs"
            aria-label="Contract address"
            disabled={checking}
          />
          <Button type="submit" variant="outline" disabled={!manual.trim() || checking}>
            {checking ? <Loader2 className="animate-spin" /> : null} {checking ? "Checking" : "Use this address"}
          </Button>
        </form>
        {checking ? (
          <p className="text-xs text-muted-foreground">
            Reading cards() from that address before switching. Studio can take up to 40 seconds to answer for a new deployment.
          </p>
        ) : null}
        {manualError ? <p className="text-xs text-gold">{manualError}</p> : null}
        {manualNote ? <p className="text-xs text-keeps">{manualNote}</p> : null}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Contract source <SectionHelp k="deploy-source" /></h2>
          <a className="text-sm text-brand underline-offset-4 hover:underline" href={CONTRACT_SOURCE_PATH} target="_blank" rel="noreferrer">
            {CONTRACT_FILE}
          </a>
        </div>
        {loadError ? (
          <p className="text-sm text-gold">Could not load the source: {loadError}. Reload the page to try again.</p>
        ) : code ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Size</dt>
            <dd>{code.length.toLocaleString("en-GB")} characters</dd>
            <dt className="text-muted-foreground">sha256</dt>
            <dd className="font-mono text-xs break-all">{digest}</dd>
            {REPO_URL ? (
              <>
                <dt className="text-muted-foreground">Repository</dt>
                <dd>
                  <a className="text-brand underline-offset-4 hover:underline" href={REPO_URL} target="_blank" rel="noreferrer">
                    {REPO_URL.replace("https://", "")}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Loading the source. It takes a second.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Hash the file in the repository yourself (shasum -a 256 {CONTRACT_FILE}) and compare: the two must be the same.
        </p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Deploy from your wallet <SectionHelp k="deploy-wallet" /></h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Connect a wallet (top right). The site adds GenLayer Studio, chain 61999, and switches to it.</li>
          <li>Have some test GEN: the wallet menu has a button that gets 10 from the faucet.</li>
          <li>Press the button below and confirm in your wallet. The network takes about a minute.</li>
          <li>This browser then reads your copy. It starts empty: publish the first card on it, then ask it for a price from another wallet.</li>
          <li>For a minute or two after the deploy Studio may not find the new address yet; pages retry by themselves.</li>
        </ol>
        <WalletGate action="deploy">
          <Button variant="cool" size="lg" disabled={!code || busy || !me.address || (!!hash && !deployFailed)} onClick={() => void start()}>
            <Rocket /> {busy ? "Waiting for your wallet" : "Deploy from my wallet"}
          </Button>
        </WalletGate>
        {error ? <p className="text-sm text-gold">{error}</p> : null}
        {hash ? <TxRail hash={hash} label="Deploying the contract" onDone={onDone} /> : null}
        {waitingAddress ? <p className="text-sm text-muted-foreground">Reading the new address from the network. A few seconds.</p> : null}
        {last ? (
          <div className="space-y-3 rounded-xl border border-brand/40 bg-brand/5 p-4">
            <p className="text-sm font-medium">{last.hash === hash ? "Deployed." : "Your last deployment from this browser."} The contract lives at</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-background px-2 py-1 font-mono text-xs break-all">{last.address}</code>
              <Button variant="outline" size="sm" asChild>
                <a href={addressUrl(last.address)} target="_blank" rel="noreferrer">
                  <ExternalLink /> Explorer
                </a>
              </Button>
              {!sameAddress(inUse, last.address) ? (
                <Button variant="outline" size="sm" onClick={() => chooseRegister(last.address)}>
                  Use it in this browser
                </Button>
              ) : (
                <span className="text-xs text-keeps">In use in this browser</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Deployed {new Date(last.at).toLocaleString("en-GB")} · transaction{" "}
              <a className="font-mono text-brand underline-offset-4 hover:underline" href={txUrl(last.hash)} target="_blank" rel="noreferrer">
                {short(last.hash, 10, 6)}
              </a>
            </p>
            <Button variant="cool" size="sm" asChild>
              <Link href="/publish">
                Publish the first card on it <ArrowRight />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              To make this the default for every visitor, set <code className="font-mono">NEXT_PUBLIC_CONTRACT</code> (or{" "}
              <code className="font-mono">DEMO_CONTRACT</code> in <code className="font-mono">lib/config.ts</code>) to this address and rebuild
              the site.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
