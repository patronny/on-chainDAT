"use client";

import { ADDR } from "@/lib/wagmi";

export function DexChart() {
  const chainSlug = "basesepolia";
  const tokenOrPair = ADDR.strategy;
  const src = `https://dexscreener.com/${chainSlug}/${tokenOrPair}?embed=1&theme=dark&info=0&trades=0`;

  return (
    <>
      <div className="relative w-full" style={{ paddingBottom: "60%" }}>
        <iframe
          src={src}
          title="LineaDAT price chart by Dexscreener"
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
        />
      </div>
      <div className="px-4 sm:px-5 py-2 border-t border-border text-[10px] text-muted-foreground text-center">
        Powered by Dexscreener · indexes mainnet pools only · Phase 3 testnet pool may not appear yet
      </div>
    </>
  );
}
