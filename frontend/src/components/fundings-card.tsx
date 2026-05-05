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
 * "$LINEADAT is currently holding X ETH" + boxed "+ N $tLINEA" pill below.
 * Pill mirrors the WBTCSTR reference: bordered, rounded, slightly tinted bg.
 */
export function FundingsCard() {
  const { currentFees, treasuryUnderlying } = useFundingsData();
  return (
    <div className="p-4 sm:p-5">
      <div className="text-xs text-muted-foreground">$LINEADAT is currently holding</div>
      <div className="text-3xl font-display font-bold mt-1 tabular">{formatEth(currentFees)} ETH</div>
      <div className="mt-3">
        <span className="inline-block px-3 py-1.5 text-xs font-mono text-foreground border border-secondary/60 rounded-md bg-secondary/15">
          + {formatTokens(treasuryUnderlying)} $tLINEA
        </span>
      </div>
    </div>
  );
}

/**
 * Title for the Bot intent card — "LINEASTR is trying to buy 150,000 tLINEA — 0.01% of supply".
 * Replaces what used to be the static "Bot intent" header label and the in-body
 * intent text (per design pass 2026-05-04).
 */
export function BotIntentTitle() {
  const { bagSize } = useFundingsData();
  // Compact bag-size label: 150000e18 wei → "150k tLINEA". Falls back to a
  // full integer-with-thousands separators only for sub-1k values, which
  // shouldn't happen at the locked bagSize but keeps the helper honest.
  const tokens = Number(bagSize) / 1e18;
  let compact: string;
  if (tokens >= 1_000_000) compact = `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  else if (tokens >= 1_000) compact = `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}k`;
  else compact = formatTokens(bagSize);
  return (
    <span>
      Trying to buy <span className="font-mono">{compact} tLINEA</span>
    </span>
  );
}

/**
 * Card body — only the headline bag size + current bid. Intent text lives in
 * the card title now (BotIntentTitle).
 */
export function BotIntentCard() {
  const { currentFees, bagSize } = useFundingsData();
  return (
    <div className="p-4 sm:p-5 space-y-3">
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
  return <span>{progressPct.toFixed(1)}% to next bag</span>;
}

/**
 * 100 vertical neon bars. Each bar = 1% slice. Filled bottom-up with neon
 * green; unfilled remainder stays neon magenta on top. The N+1-th bar is
 * partially filled to render fractional progress (e.g. 55.5% → 55 full
 * green bars, the 56th half magenta on top + half green on bottom).
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
              {magentaPct > 0 ? (
                <div
                  className="absolute inset-x-0 top-0 transition-[height] duration-300"
                  style={{
                    height: `${magentaPct}%`,
                    background: NEON_MAGENTA,
                    boxShadow: isEmpty
                      ? `0 0 4px ${NEON_MAGENTA}, 0 0 8px ${NEON_MAGENTA}`
                      : `0 0 3px ${NEON_MAGENTA}`,
                  }}
                />
              ) : null}
              {greenPct > 0 ? (
                <div
                  className="absolute inset-x-0 bottom-0 transition-[height] duration-300"
                  style={{
                    height: `${greenPct}%`,
                    background: NEON_GREEN,
                    boxShadow: isFull
                      ? `0 0 4px ${NEON_GREEN}, 0 0 8px ${NEON_GREEN}`
                      : `0 0 3px ${NEON_GREEN}`,
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
