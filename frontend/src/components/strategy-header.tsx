"use client";

import { useMemo, useState } from "react";
import { useSwaps } from "@/hooks/useIndexer";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Card } from "./ui/card";
import { LdatIcon, LineaIcon } from "./icons/token-icons";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useEthPrice } from "@/hooks/useEthPrice";
import { usePriceChange24h } from "@/hooks/usePriceChange24h";
import { ADDR, addressUrl } from "@/lib/wagmi";
import { ldatPriceInEth } from "@/lib/utils";
import { TypeBadge, ScopeBadge } from "./dat-badges";

/**
 * Big strategy header card matching tokenstrategy.com reference.
 * Logo + name + chain badge + inline mini-stats (price / MC / MC incl burns / 24h Vol / 24h Change).
 */
export function StrategyHeader() {
  const { data } = useStrategyStats();
  const ethUsd = useEthPrice();
  const swaps = useSwaps(500);
  const [copied, setCopied] = useState(false);

  async function copyContractAddress() {
    try {
      await navigator.clipboard.writeText(ADDR.strategy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - silently no-op */
    }
  }

  // 24h ETH-side volume from the indexer's swap rows (one Trade event per user
  // swap - the hook's internal fee-sell round-trips are NOT counted, which is
  // why GeckoTerminal's gross pool number reads higher). Indexer-only; the
  // on-chain getLogs fallback is gone (see lib/utils.ts). null = indexer
  // unreachable (renders "-"); 0n = genuinely no trades in 24h (renders "$0").
  const indexerVol24h = useMemo<bigint | null>(() => {
    if (!swaps.usable || !swaps.data) return null;
    const since = Math.floor(Date.now() / 1000) - 86_400;
    return swaps.data.reduce(
      (acc, s) => (s.timestamp >= since ? acc + BigInt(s.ethAmount) : acc),
      0n
    );
  }, [swaps.usable, swaps.data]);

  const vol24h = indexerVol24h ?? 0n;

  const pricePerLdatEth = data ? ldatPriceInEth(data.sqrtPriceX96) : 0;
  const pricePerLdatUsd = pricePerLdatEth * ethUsd;
  const totalSupplyFloat = data ? Number(data.totalSupply) / 1e18 : 0;
  const burnedFloat = data ? Number(data.burned) / 1e18 : 0;
  const circulatingFloat = totalSupplyFloat - burnedFloat;
  const change24hPct = usePriceChange24h(data?.sqrtPriceX96);

  const marketCapUsd = pricePerLdatUsd * circulatingFloat;
  const fdvUsd = pricePerLdatUsd * totalSupplyFloat;
  const vol24hUsd = (Number(vol24h) / 1e18) * ethUsd;

  const fmtPriceUsd = (n: number) => {
    if (n === 0) return "-";
    if (n < 1) {
      // Render small fractional prices in plain decimal - never scientific - and keep
      // exactly 3 significant digits (e.g. 0.0000371741... -> 0.0000372). Trailing zeros
      // trimmed but at least 2 fractional digits preserved.
      const expanded = n.toFixed(20);
      const dot = expanded.indexOf(".");
      const frac = expanded.slice(dot + 1);
      let firstNonZero = 0;
      while (firstNonZero < frac.length && frac[firstNonZero] === "0") firstNonZero++;
      const decimals = Math.max(2, firstNonZero + 3);
      let trimmed = n.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
      if (!trimmed.includes(".")) trimmed += ".00";
      return `$${trimmed}`;
    }
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };
  const fmtUsdLarge = (n: number) => {
    if (n === 0) return "-";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <Card className="mb-4 sm:mb-6">
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
        {/* Logo + name */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <LdatIcon className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight">
              LDAT
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
              <span className="text-muted-foreground font-mono">$LDAT</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border font-mono uppercase tracking-wider">
                ERC-20 on
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <LineaIcon className="w-3.5 h-3.5" />
                Linea
              </span>
              <TypeBadge type="classic" />
              <ScopeBadge scope="main" />
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

        {/* Inline stats - desktop horizontal, mobile 2-col grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:justify-end gap-3 sm:gap-6 text-xs lg:text-sm">
          <Stat label="$LDAT" value={fmtPriceUsd(pricePerLdatUsd)} />
          <Stat label="Market Cap" value={fmtUsdLarge(marketCapUsd)} />
          <Stat label="FDV" value={fmtUsdLarge(fdvUsd)} />
          <Stat
            label="24h Volume"
            value={
              indexerVol24h === null
                ? "-"
                : indexerVol24h === 0n
                  ? "$0"
                  : fmtUsdLarge(vol24hUsd)
            }
            title="Trade volume (excludes protocol fee swaps), so trackers counting raw pool swaps may show a higher number. Shows $0 when there were no trades in the last 24h; a dash means the indexer is unreachable."
          />
          <Stat
            label="24h Change"
            value={
              change24hPct === null
                ? "-"
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
  title,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "positive" | "negative";
  title?: string;
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
    <div className={`lg:text-right ${title ? "cursor-help" : ""}`} title={title}>
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono tabular text-sm sm:text-base font-semibold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
