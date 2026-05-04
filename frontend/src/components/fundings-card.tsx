"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useBagMarketPriceEth } from "@/hooks/useBagMarketPriceEth";
import { formatEth, formatTokens } from "@/lib/utils";

function useFundingsData() {
  const { data } = useStrategyStats();
  const currentFees = data?.currentFees ?? 0n;
  const treasuryUnderlying = data?.treasuryUnderlying ?? 0n;
  const bagSize = data?.bagSize ?? 0n;
  const totalSupply = data?.totalSupply ?? 1n;
  const bagMarketPriceEth = useBagMarketPriceEth();

  // Progress = treasury fees / market cost of one fresh bag (capped at 100%).
  // The bar freezes at 100% — never resets — until the keeper buys a bag,
  // which drains currentFees and the cycle starts again.
  const progressPct =
    bagMarketPriceEth > 0n
      ? Math.min(100, Number((currentFees * 10000n) / bagMarketPriceEth) / 100)
      : 0;

  const supplyPct =
    totalSupply > 0n ? (Number((bagSize * 10000n) / totalSupply) / 100).toFixed(2) : "0.00";

  return { currentFees, treasuryUnderlying, bagSize, progressPct, supplyPct, bagMarketPriceEth };
}

/**
 * "$LINEASTR is currently holding X ETH ↳ Y tLINEA in treasury"
 */
export function FundingsCard() {
  const { currentFees, treasuryUnderlying } = useFundingsData();
  return (
    <div className="p-4 sm:p-5">
      <div className="text-xs text-muted-foreground">$LINEASTR is currently holding</div>
      <div className="text-3xl font-display font-bold mt-1 tabular">{formatEth(currentFees)} ETH</div>
      <div className="text-xs text-muted-foreground font-mono mt-1">
        ↳ {formatTokens(treasuryUnderlying)} tLINEA in treasury
      </div>
    </div>
  );
}

/**
 * "Bot is trying to buy 150,000 tLINEA — N% of supply, current bid X ETH"
 */
export function BotIntentCard() {
  const { currentFees, bagSize, supplyPct } = useFundingsData();
  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-muted-foreground leading-snug">
          Bot is trying to buy
          <br />
          <span className="font-mono">{formatTokens(bagSize)} tLINEA</span>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{supplyPct}%</div>
          <div>of supply</div>
        </div>
      </div>
      <div className="text-3xl font-display font-bold tabular">{formatTokens(bagSize)} tLINEA</div>
      <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Current bid</span>
        <span className="font-mono tabular">{formatEth(currentFees)} ETH</span>
      </div>
    </div>
  );
}

/**
 * Dynamic title for the Progress card — "55.5% Progress to the next bag".
 * Shown inside CardShell's <h3>; updates whenever stats refetch.
 */
export function ProgressTitle() {
  const { progressPct } = useFundingsData();
  return <span>{progressPct.toFixed(1)}% Progress to the next bag</span>;
}

/**
 * 100 vertical neon bars. Each bar = 1% slice. Filled top-down with neon
 * green; unfilled remainder is neon magenta. The N+1-th bar is partially
 * filled to render fractional progress (e.g. 55.5% → 55 full green bars,
 * the 56th half green on top + half magenta on bottom).
 *
 * Bar freezes at 100% and only resets when the keeper executes a buy
 * (which drains currentFees on-chain → next refetch shows 0%).
 */
export function ProgressCard() {
  const { progressPct } = useFundingsData();

  const NEON_GREEN = "hsl(142 100% 55%)";
  const NEON_MAGENTA = "hsl(320 100% 60%)";

  return (
    <div className="p-4 sm:p-5">
      <div className="flex gap-px h-20 sm:h-24 items-stretch">
        {Array.from({ length: 100 }).map((_, i) => {
          const idx = i + 1;
          let fillFrac = 0;
          if (progressPct >= idx) fillFrac = 1;
          else if (progressPct > idx - 1) fillFrac = progressPct - (idx - 1);

          const greenPct = Math.round(fillFrac * 100);
          const magentaPct = 100 - greenPct;
          const isFull = fillFrac >= 1;
          const isEmpty = fillFrac <= 0;

          return (
            <div key={i} className="flex-1 relative">
              {greenPct > 0 ? (
                <div
                  className="absolute inset-x-0 top-0 transition-[height] duration-300"
                  style={{
                    height: `${greenPct}%`,
                    background: NEON_GREEN,
                    boxShadow: isFull
                      ? `0 0 4px ${NEON_GREEN}, 0 0 8px ${NEON_GREEN}`
                      : `0 0 3px ${NEON_GREEN}`,
                  }}
                />
              ) : null}
              {magentaPct > 0 ? (
                <div
                  className="absolute inset-x-0 bottom-0 transition-[height] duration-300"
                  style={{
                    height: `${magentaPct}%`,
                    background: NEON_MAGENTA,
                    boxShadow: isEmpty
                      ? `0 0 4px ${NEON_MAGENTA}, 0 0 8px ${NEON_MAGENTA}`
                      : `0 0 3px ${NEON_MAGENTA}`,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
