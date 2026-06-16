"use client";

import { ADDR, DEFAULT_CHAIN_ID } from "@/lib/wagmi";

export function DexChart() {
  // DexScreener network slug, stage-aware: Linea mainnet vs the legacy Base Sepolia testnet.
  const chainSlug = DEFAULT_CHAIN_ID === 59144 ? "linea" : "basesepolia";
  const tokenOrPair = ADDR.strategy;
  const src = `https://dexscreener.com/${chainSlug}/${tokenOrPair}?embed=1&theme=dark&info=0&trades=0`;

  return (
    <>
      <div className="relative w-full" style={{ paddingBottom: "60%" }}>
        <iframe
          src={src}
          title="LDAT price chart by Dexscreener"
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
        />
      </div>
      <div className="px-4 sm:px-5 py-2 border-t border-border text-[10px] text-muted-foreground text-center">
        Powered by Dexscreener · note: Dexscreener does not index Uniswap v4 pools on Linea yet (native chart coming)
      </div>
    </>
  );
}
