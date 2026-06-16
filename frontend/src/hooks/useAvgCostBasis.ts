"use client";

import { useEffect, useState } from "react";
import { fetchSwapsByTrader, INDEXER_ENABLED } from "@/lib/indexer";

/**
 * Average buy price in ETH-per-token across all of a trader's BUY swaps on the
 * LDAT v4 pool. Returns null when:
 *   - indexer disabled / errored
 *   - the user has no buy swaps on record (then "After buy %" should render "-")
 *
 * Simple weighted average (totalEthSpent / totalTokensBought). FIFO/LIFO would
 * matter if we tracked realized PnL on sells, but for a "since first buy" %
 * change displayed against the current spot price, average cost is the right
 * baseline.
 */
export function useAvgCostBasis(trader: string | undefined): {
  avgPriceEth: number | null;
  loading: boolean;
} {
  const [avgPriceEth, setAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!INDEXER_ENABLED || !trader) {
      setAvg(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    let cancelled = false;
    setLoading(true);
    fetchSwapsByTrader(trader, ctrl.signal)
      .then((rows) => {
        if (cancelled) return;
        let totalEth = 0n;
        let totalTok = 0n;
        for (const r of rows) {
          if (r.side !== "buy") continue;
          totalEth += BigInt(r.ethAmount);
          totalTok += BigInt(r.tokenAmount);
        }
        if (totalTok === 0n) {
          setAvg(null);
        } else {
          // Both values are wei (18 decimals each), so the ratio is unitless
          // ETH-per-token in their float forms.
          setAvg(Number(totalEth) / Number(totalTok));
        }
      })
      .catch(() => {
        if (!cancelled) setAvg(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [trader]);

  return { avgPriceEth, loading };
}
