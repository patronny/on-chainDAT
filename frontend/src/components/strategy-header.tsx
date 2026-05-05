"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Card } from "./ui/card";
import { LineastrIcon, LineaIcon } from "./icons/token-icons";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useEthPrice } from "@/hooks/useEthPrice";
import { usePriceChange24h } from "@/hooks/usePriceChange24h";
import { hookAbi } from "@/lib/abis/swapper";
import { ADDR, addressUrl } from "@/lib/wagmi";
import { lineastrPriceInEth, getEventsChunked } from "@/lib/utils";

/**
 * Big strategy header card matching tokenstrategy.com reference.
 * Logo + name + chain badge + inline mini-stats (price / MC / MC incl burns / 24h Vol / 24h Change).
 */
export function StrategyHeader() {
  const { data } = useStrategyStats();
  const ethUsd = useEthPrice();
  const client = usePublicClient();
  const [vol24h, setVol24h] = useState<bigint>(0n);
  const [copied, setCopied] = useState(false);

  async function copyContractAddress() {
    try {
      await navigator.clipboard.writeText(ADDR.strategy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently no-op */
    }
  }

  // Aggregate ETH-side volume from hook Trade events (last ~24h via chunked queries).
  useEffect(() => {
    if (!client || ADDR.hook === "0x0000000000000000000000000000000000000000") return;
    let cancelled = false;
    async function fetch() {
      try {
        const events = await getEventsChunked(client!, {
          address: ADDR.hook,
          abi: hookAbi,
          eventName: "Trade",
          args: { strategy: ADDR.strategy },
        });
        let total = 0n;
        for (const e of events) {
          const eth = BigInt((e as { args: { ethAmount: bigint | number } }).args.ethAmount);
          total += eth < 0n ? -eth : eth;
        }
        if (!cancelled) setVol24h(total);
      } catch {
        // silent — leave volume at 0
      }
    }
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  const pricePerLineastrEth = data ? lineastrPriceInEth(data.sqrtPriceX96) : 0;
  const pricePerLineastrUsd = pricePerLineastrEth * ethUsd;
  const totalSupplyFloat = data ? Number(data.totalSupply) / 1e18 : 0;
  const burnedFloat = data ? Number(data.burned) / 1e18 : 0;
  const circulatingFloat = totalSupplyFloat - burnedFloat;
  const change24hPct = usePriceChange24h(data?.sqrtPriceX96);

  const marketCapUsd = pricePerLineastrUsd * circulatingFloat;
  const fdvUsd = pricePerLineastrUsd * totalSupplyFloat;
  const vol24hUsd = (Number(vol24h) / 1e18) * ethUsd;

  const fmtPriceUsd = (n: number) => {
    if (n === 0) return "—";
    if (n < 0.0001) return `$${n.toExponential(2)}`;
    if (n < 1) return `$${n.toFixed(6)}`;
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };
  const fmtUsdLarge = (n: number) => {
    if (n === 0) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <Card className="mb-4 sm:mb-6">
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
        {/* Logo + name */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <LineastrIcon className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight">
              LineaDAT
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
              <span className="text-muted-foreground font-mono">$LINEADAT</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border font-mono uppercase tracking-wider">
                ERC-20 on
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <LineaIcon className="w-3.5 h-3.5" />
                Linea
              </span>
              <a
                href={addressUrl(ADDR.strategy)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-secondary/15 text-muted-foreground hover:text-foreground hover:border-secondary/60 focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Open contract on block explorer"
                title="Open on explorer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={copyContractAddress}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-secondary/15 text-muted-foreground hover:text-foreground hover:border-secondary/60 focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Copy contract address"
                title={copied ? "Copied" : "Copy contract"}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Inline stats — desktop horizontal, mobile 2-col grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:justify-end gap-3 sm:gap-6 text-xs lg:text-sm">
          <Stat label="$LINEADAT" value={fmtPriceUsd(pricePerLineastrUsd)} />
          <Stat label="Market Cap" value={fmtUsdLarge(marketCapUsd)} />
          <Stat label="FDV" value={fmtUsdLarge(fdvUsd)} />
          <Stat label="24h Volume" value={fmtUsdLarge(vol24hUsd)} />
          <Stat
            label="24h Change"
            value={
              change24hPct === null
                ? "—"
                : `${change24hPct >= 0 ? "+" : ""}${change24hPct.toFixed(2)}%`
            }
            muted={change24hPct === null}
            tone={
              change24hPct === null
                ? undefined
                : change24hPct >= 0
                  ? "positive"
                  : "negative"
            }
          />
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-green-500 dark:text-green-400"
      : tone === "negative"
        ? "text-red-500 dark:text-red-400"
        : muted
          ? "text-muted-foreground"
          : "";
  return (
    <div className="lg:text-right">
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono tabular text-sm sm:text-base font-semibold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
