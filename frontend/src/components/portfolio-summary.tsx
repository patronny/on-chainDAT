"use client";

import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "@/lib/abis/erc20";
import { ADDR } from "@/lib/wagmi";
import { ldatPriceInEth } from "@/lib/utils";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useEthPrice } from "@/hooks/useEthPrice";
import { usePriceChange24h } from "@/hooks/usePriceChange24h";
import { useAvgCostBasis } from "@/hooks/useAvgCostBasis";
import { SignedDelta } from "./signed-delta";

/**
 * Top of /portfolio - aggregate stats + allocation diagram.
 *
 *   [Portfolio Value $X.XX]            [24h % ($)]    [After buy % ($)]
 *   [============= LDAT 100.0% =============]
 *   [legend chip]
 *
 * Today the family has a single DAT (LDAT), so the bar is a single full
 * slice. When more DATs ship, push their `{ address, name, color }` into
 * KNOWN_DATS and the loops below produce one slice per DAT with weighted
 * per-position aggregation for the 24h / after-buy stats. Per-DAT cost basis
 * still needs to be tracked per token rather than user-wide.
 */

type DatDef = {
  address: `0x${string}`;
  name: string;
  color: string;
};

// Brand colors rotate as DATs are added. CSS vars resolve at render time so
// the bar tracks any future theme tweaks.
const KNOWN_DATS: DatDef[] = [
  {
    address: ADDR.strategy,
    name: "LDAT",
    color: "hsl(var(--primary))",
  },
];

export function PortfolioSummary() {
  const { address } = useAccount();

  // Phase 3 single-DAT shortcut - same hooks the holdings table uses; React
  // Query dedupes the RPC calls so this isn't a double round-trip.
  const { data: balanceWei } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: stats } = useStrategyStats();
  const ethUsd = useEthPrice();
  const change24hPct = usePriceChange24h(stats?.sqrtPriceX96);
  const { avgPriceEth } = useAvgCostBasis(address);

  const balance = Number(balanceWei ?? 0n) / 1e18;
  const priceEth = ldatPriceInEth(stats?.sqrtPriceX96);
  const priceUsd = priceEth * (ethUsd || 0);
  const totalValue = balance * priceUsd;

  // 24h portfolio delta. Price-only (assumes balance constant over the window),
  // which is the same approximation the per-row column uses.
  let delta24Pct: number | null = change24hPct;
  let delta24Usd: number | null = null;
  if (change24hPct !== null && totalValue > 0) {
    const denom = 1 + change24hPct / 100;
    if (denom > 0) delta24Usd = totalValue - totalValue / denom;
  }
  if (totalValue === 0) {
    delta24Pct = null;
  }

  // After-buy delta - relies on indexer-derived avg cost basis.
  let afterBuyPct: number | null = null;
  let afterBuyUsd: number | null = null;
  if (avgPriceEth !== null && avgPriceEth > 0 && priceEth > 0 && balance > 0) {
    afterBuyPct = ((priceEth - avgPriceEth) / avgPriceEth) * 100;
    afterBuyUsd = (priceEth - avgPriceEth) * balance * (ethUsd || 0);
  }

  // Allocation slices - one per DAT with a non-zero position.
  const slices = [
    {
      name: KNOWN_DATS[0].name,
      color: KNOWN_DATS[0].color,
      valueUsd: totalValue,
    },
  ].filter((s) => s.valueUsd > 0);
  const slicesTotal = slices.reduce((acc, s) => acc + s.valueUsd, 0);

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Stat row */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Portfolio Value
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold mt-1 tabular">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
          <StatBlock label="24h % ($)">
            <SignedDelta pct={delta24Pct} usd={delta24Usd} size="md" />
          </StatBlock>
          <StatBlock label="After buy % ($)">
            <SignedDelta pct={afterBuyPct} usd={afterBuyUsd} size="md" />
          </StatBlock>
        </div>
      </div>

      {/* Allocation bar + legend - shown only when at least one position is
          held; the empty-state message below the summary card covers the
          zero-holdings case. */}
      {slicesTotal > 0 ? (
        <div className="space-y-2">
          <div className="flex h-3 sm:h-3.5 rounded-full overflow-hidden bg-muted/40">
            {slices.map((s) => (
              <div
                key={s.name}
                style={{
                  width: `${(s.valueUsd / slicesTotal) * 100}%`,
                  background: s.color,
                }}
                aria-label={`${s.name} ${((s.valueUsd / slicesTotal) * 100).toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {slices.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-foreground font-medium">{s.name}</span>
                <span className="text-muted-foreground font-mono tabular">
                  {((s.valueUsd / slicesTotal) * 100).toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:items-end">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 whitespace-nowrap">{children}</span>
    </div>
  );
}
