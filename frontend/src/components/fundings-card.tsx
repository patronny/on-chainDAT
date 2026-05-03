"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatEth, formatTokens } from "@/lib/utils";

/**
 * Fundings card — mirrors tokenstrategy.com:
 *   "$LINEASTR is currently holding"  → currentFees + tLINEA bag size headline
 *   "trying to buy"                   → progress toward enough fees for next bag at 1.2× last paid
 *   "Current bid"                     → maxPriceForBuy ramp
 */
export function FundingsCard() {
  const { data } = useStrategyStats();

  const currentFees = data?.currentFees ?? 0n;
  const treasuryUnderlying = data?.treasuryUnderlying ?? 0n;
  const bagSize = data?.bagSize ?? 0n;
  const totalSupply = data?.totalSupply ?? 1n;

  // Progress: how close currentFees is to the bot's 0.02 ETH buy threshold (= a fresh bag).
  // Once fees reach that mark the keeper buys 150k tLINEA from the open market.
  const buyThreshold = 20000000000000000n; // 0.02 ETH = bot.buyThreshold
  const progressPct =
    currentFees >= buyThreshold
      ? 100
      : Math.floor(Number((currentFees * 10000n) / buyThreshold)) / 100;

  // % of total supply bot is "trying to buy" — bagSize / totalSupply
  const supplyPct =
    totalSupply > 0n ? (Number((bagSize * 10000n) / totalSupply) / 100).toFixed(2) : "0.00";

  return (
    <>
      <div className="p-4 sm:p-5 space-y-4">
        <div>
          <div className="text-xs text-muted-foreground">$LINEASTR is currently holding</div>
          <div className="text-3xl font-display font-bold mt-1 tabular">{formatEth(currentFees)} ETH</div>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            ↳ {formatTokens(treasuryUnderlying)} tLINEA in treasury
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2 items-center">
            <div className="text-xs text-muted-foreground leading-snug">
              Bot is trying to buy
              <br />
              <span className="font-mono">{formatTokens(bagSize)} tLINEA</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{supplyPct}%</div>
              <div className="text-xs text-muted-foreground">of supply</div>
            </div>
          </div>
        </div>

        <div className="text-3xl font-display font-bold tabular">{formatTokens(bagSize)} tLINEA</div>

        <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current bid</span>
          <span className="font-mono tabular">{formatEth(currentFees)} ETH</span>
        </div>
      </div>

      {/* Progress bar — fees accumulated vs market price needed to buy a bag */}
      <div className="px-4 sm:px-5 pt-3 pb-4 border-t border-border">
        <div className="flex items-baseline justify-between gap-3 text-xs mb-2 flex-wrap">
          <span className="font-semibold whitespace-nowrap">{progressPct.toFixed(1)}% Progress</span>
          <span className="text-muted-foreground text-right">toward market price for next bag</span>
        </div>
        <div className="h-3 bg-secondary rounded overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      </div>
    </>
  );
}
