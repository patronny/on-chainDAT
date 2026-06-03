"use client";

import { useEffect, useState } from "react";
import { useSnapshot } from "@/hooks/useSnapshot";

function formatPair(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Countdown to scheduled trading open.
 *
 * Reads `deploymentTime[strategy]` from the LineaDAT hook. That timestamp is the moment
 * the buy-fee decay clock starts AND the moment swaps stop reverting with NotYetLaunched.
 *
 * Renders a 4-cell DD : HH : MM : SS grid in cyberpunk neon. Once the launch passes,
 * shows a single LIVE badge until the parent decides to swap this card for the actual
 * Dexscreener chart (or a manual user toggle).
 */
export function LaunchCountdown() {
  const { data: snap } = useSnapshot();
  const launchTs = snap ? Number(snap.deploymentTime) : 0;

  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (!launchTs) {
    return (
      <div className="px-4 sm:px-5 py-10 text-center text-sm text-muted-foreground">
        Loading launch schedule…
      </div>
    );
  }

  const remaining = Math.max(0, launchTs - now);
  const isLive = remaining === 0;

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;

  const launchDate = new Date(launchTs * 1000);
  const launchUtc = launchDate.toUTCString();

  if (isLive) {
    return (
      <div className="px-4 sm:px-5 py-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/15 border border-success/40 text-success uppercase tracking-wider text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Trading LIVE
        </div>
        <div className="mt-3 text-xs text-muted-foreground font-mono">
          Buy fee is now decaying 99% → 10% over 89 minutes
        </div>
      </div>
    );
  }

  const Cell = ({ label, value }: { label: string; value: number }) => (
    <div className="flex flex-col items-center">
      <div className="text-3xl sm:text-4xl font-display font-bold tabular text-primary leading-none">
        {formatPair(value)}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
        {label}
      </div>
    </div>
  );

  return (
    <div className="px-4 sm:px-5 py-6 sm:py-8">
      <div className="text-center mb-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          Trading opens in
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-md mx-auto">
        <Cell label="Days" value={days} />
        <Cell label="Hours" value={hours} />
        <Cell label="Minutes" value={mins} />
        <Cell label="Seconds" value={secs} />
      </div>
      <div className="mt-5 pt-4 border-t border-border text-center text-[10px] sm:text-xs font-mono text-muted-foreground space-y-0.5">
        <div>Target launch (approximate): <span className="text-foreground">{launchUtc}</span></div>
        <div>Date is not final and may shift; this countdown always shows the latest time</div>
        <div>Buy fee will decay 99% → 10% over 89 minutes from launch</div>
      </div>
    </div>
  );
}
