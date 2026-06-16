"use client";

import { useState } from "react";
import { POOL_ID } from "@/lib/abis/poolmanager";
import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";

/**
 * GeckoTerminal embed for the live Uniswap v4 pool.
 *
 * GeckoTerminal indexes Uniswap v4 on Linea (verified live on the rehearsal
 * pool) and addresses each pool by its bytes32 poolId - which is exactly
 * POOL_ID (computed at runtime from POOL_KEY). So a contract redeploy
 * auto-retargets the chart with no manual sync.
 *
 * Cold start: the pool only appears on GeckoTerminal after the gate opens and
 * the first swap is indexed (a brief gap right at open). Until then the embed
 * shows GeckoTerminal's own empty state; the live price is always in the swap
 * panel and the caption links straight to the pool.
 */
export function GeckoChart() {
  // The GeckoTerminal embed takes 10s+ to fully load on a cold cache; show a
  // skeleton behind the iframe until its load event so the card never reads
  // as a hung blank rectangle.
  const [chartReady, setChartReady] = useState(false);
  // GeckoTerminal only covers Linea mainnet here; the legacy Base Sepolia
  // testnet has no GeckoTerminal coverage, so there is no embed to show.
  const network = DEFAULT_CHAIN_ID === 59144 ? "linea" : null;
  const poolUrl = network
    ? `https://www.geckoterminal.com/${network}/pools/${POOL_ID}`
    : null;

  if (!poolUrl) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        Live chart is available on Linea mainnet.
      </div>
    );
  }

  const src = `${poolUrl}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=15m`;

  return (
    <>
      <div className="relative w-full" style={{ height: "min(68vh, 560px)" }}>
        {!chartReady ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-secondary border-t-primary" />
            <span className="text-sm text-muted-foreground animate-pulse">Loading chart...</span>
          </div>
        ) : null}
        <iframe
          src={src}
          title="LDAT price chart by GeckoTerminal"
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${
            chartReady ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          allow="clipboard-write"
          onLoad={() => setChartReady(true)}
        />
      </div>
      <div className="border-t border-border px-4 py-2 text-center text-[10px] text-muted-foreground sm:px-5">
        Powered by GeckoTerminal ·{" "}
        <a
          href={poolUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          open pool
        </a>
      </div>
    </>
  );
}
