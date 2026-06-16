"use client";

import { useEffect, useState } from "react";
import { fetchBaselineSwapFor24h, INDEXER_ENABLED } from "@/lib/indexer";
import { ldatPriceInEth } from "@/lib/utils";

/**
 * 24h LINEASTR price change in percent vs the price 24 hours ago.
 *
 * Baseline = sqrtPriceX96 of the earliest swap with timestamp >= now-24h.
 * During quiet testnet windows, falls back to the latest swap before the
 * 24h boundary so the widget doesn't disappear just because no one traded.
 *
 * Returns null when:
 *   - indexer disabled / down
 *   - no swap exists in the indexer at all
 *   - current sqrtPriceX96 is unavailable
 */
export function usePriceChange24h(currentSqrtPriceX96: bigint | undefined): number | null {
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    if (!INDEXER_ENABLED || !currentSqrtPriceX96 || currentSqrtPriceX96 === 0n) {
      setPct(null);
      return;
    }
    const ctrl = new AbortController();
    let cancelled = false;
    async function run() {
      try {
        const since = Math.floor(Date.now() / 1000) - 86400;
        const baseline = await fetchBaselineSwapFor24h(since, ctrl.signal);
        if (cancelled) return;
        if (!baseline) {
          setPct(null);
          return;
        }
        const baselinePrice = ldatPriceInEth(BigInt(baseline.sqrtPriceX96));
        const currentPrice = ldatPriceInEth(currentSqrtPriceX96);
        if (baselinePrice <= 0 || currentPrice <= 0) {
          setPct(null);
          return;
        }
        setPct(((currentPrice - baselinePrice) / baselinePrice) * 100);
      } catch {
        if (!cancelled) setPct(null);
      }
    }
    run();
    const id = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      ctrl.abort();
    };
  }, [currentSqrtPriceX96]);

  return pct;
}
