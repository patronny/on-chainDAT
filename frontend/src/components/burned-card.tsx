"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatTokens } from "@/lib/utils";
import { Flame } from "lucide-react";

/**
 * Burned amount with realistic layered fire backdrop:
 *   1. coal bed at the bottom (deep red glow)
 *   2. main flame body (orange + red, ~2.4s flicker)
 *   3. inner mid flames (~1.7s, side-to-side wobble)
 *   4. yellow/white flame tips (~1.1s, vertical pulse)
 *   5. sparks layer — tiny embers rising upward (~3s loop)
 *   6. dark vignette around the edges so the fire looks contained
 */
export function BurnedCard() {
  const { data } = useStrategyStats();
  const burned = data?.burned ?? 0n;
  const totalSupply = data?.totalSupply ?? 0n;

  let pctStr = "0.00%";
  if (totalSupply > 0n) {
    const bps = Number((burned * 10000n) / totalSupply);
    pctStr = bps < 1 ? "<0.01%" : `${(bps / 100).toFixed(2)}%`;
  }

  return (
    <div className="relative overflow-hidden bg-[#0a0200] p-4 sm:p-5 min-h-[180px]">
      {/* coal bed */}
      <div className="fire-coal absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" aria-hidden />
      {/* main flame */}
      <div className="fire-bg absolute inset-0 pointer-events-none" aria-hidden />
      {/* mid wobble */}
      <div className="fire-bg-2 absolute inset-0 pointer-events-none" aria-hidden />
      {/* hot tips */}
      <div className="fire-bg-3 absolute inset-x-0 bottom-0 h-2/3 pointer-events-none" aria-hidden />
      {/* rising sparks */}
      <div className="fire-sparks absolute inset-0 pointer-events-none" aria-hidden />
      {/* edge vignette */}
      <div className="fire-vignette absolute inset-0 pointer-events-none" aria-hidden />

      <div className="relative z-10 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] space-y-1.5">
        <div className="flex items-center gap-2 text-base sm:text-lg uppercase tracking-wider font-semibold opacity-95">
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-300 animate-pulse" />
          $LINEADAT burned
        </div>
        <div className="flex items-baseline gap-2 font-display font-bold">
          <span className="text-3xl sm:text-4xl tabular">{pctStr}</span>
          <span className="text-base sm:text-lg opacity-90 font-sans font-normal">of supply</span>
        </div>
        <div className="text-base sm:text-lg font-mono tabular opacity-95">
          {formatTokens(burned)} tokens
        </div>
      </div>
    </div>
  );
}
