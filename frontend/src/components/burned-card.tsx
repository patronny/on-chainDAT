"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { formatTokens } from "@/lib/utils";
import { Flame } from "lucide-react";

/**
 * Burned amount with hardcore cyberpunk neon "fire" backdrop. Layers stacked
 * bottom-up: violet coal bed -> magenta body -> magenta+cyan mid -> electric
 * cyan tips -> rising magenta/cyan/yellow sparks -> perspective circuit grid
 * -> CRT scanlines -> single sweeping cyan scan beam -> dark vignette ->
 * neon-bordered frame -> RGB-split / glitch text.
 */
export function BurnedCard() {
  const { data } = useStrategyStats();
  const burned = data?.burned ?? 0n;
  const totalSupply = data?.totalSupply ?? 0n;

  let pctStr = "0.00%";
  if (burned > 0n && totalSupply > 0n) {
    const bps = Number((burned * 10000n) / totalSupply);
    pctStr = bps < 1 ? "<0.01%" : `${(bps / 100).toFixed(2)}%`;
  }

  return (
    <div
      className="relative overflow-hidden bg-[#06000d] p-4 sm:p-5 min-h-[180px] border border-fuchsia-500/40 rounded-md"
      style={{
        boxShadow:
          "inset 0 0 24px rgba(255, 45, 172, 0.18), 0 0 12px rgba(255, 45, 172, 0.18), 0 0 22px rgba(0, 240, 255, 0.08)",
      }}
    >
      {/* perspective circuit grid floor */}
      <div className="fire-grid absolute inset-x-0 bottom-0 h-2/3 pointer-events-none" aria-hidden />
      {/* coal bed */}
      <div className="fire-coal absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" aria-hidden />
      {/* main neon flame */}
      <div className="fire-bg absolute inset-0 pointer-events-none" aria-hidden />
      {/* mid wobble (magenta + cyan) */}
      <div className="fire-bg-2 absolute inset-0 pointer-events-none" aria-hidden />
      {/* electric cyan tips */}
      <div className="fire-bg-3 absolute inset-x-0 bottom-0 h-2/3 pointer-events-none" aria-hidden />
      {/* rising sparks */}
      <div className="fire-sparks absolute inset-0 pointer-events-none" aria-hidden />
      {/* sweeping cyan scan beam */}
      <div className="fire-scan-beam absolute inset-0 pointer-events-none" aria-hidden />
      {/* CRT scanlines */}
      <div className="fire-scanlines absolute inset-0 pointer-events-none" aria-hidden />
      {/* edge vignette */}
      <div className="fire-vignette absolute inset-0 pointer-events-none" aria-hidden />

      <div className="relative z-10 text-white space-y-1.5">
        <div
          className="flex items-center gap-2 text-base sm:text-lg uppercase tracking-[0.18em] font-semibold"
          style={{
            textShadow:
              "0 0 6px rgba(255, 45, 172, 0.85), 0 0 16px rgba(255, 45, 172, 0.5), 0 0 28px rgba(0, 240, 255, 0.3)",
          }}
        >
          <Flame
            className="w-4 h-4 sm:w-5 sm:h-5 text-fuchsia-400 animate-pulse"
            fill="currentColor"
            stroke="rgb(255, 200, 240)"
            strokeWidth={1.5}
            style={{
              filter:
                "drop-shadow(0 0 4px rgba(255, 45, 172, 0.95)) drop-shadow(0 0 10px rgba(255, 0, 170, 0.7))",
            }}
          />
          $LDAT burned
        </div>
        <div className="flex items-baseline gap-2 font-display font-bold">
          <span className="text-3xl sm:text-4xl tabular neon-glitch">{pctStr}</span>
          <span
            className="text-base sm:text-lg font-sans font-normal text-cyan-200/95"
            style={{ textShadow: "0 0 6px rgba(0, 240, 255, 0.6)" }}
          >
            of supply
          </span>
        </div>
        <div
          className="text-base sm:text-lg font-mono tabular text-fuchsia-100/95"
          style={{ textShadow: "0 0 6px rgba(255, 45, 172, 0.55)" }}
        >
          {formatTokens(burned)} tokens
        </div>
      </div>
    </div>
  );
}
