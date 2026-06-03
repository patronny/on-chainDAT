"use client";

import { useEffect, useState } from "react";
import { useSnapshot } from "@/hooks/useSnapshot";
import { PriceChart } from "./price-chart";
import { LaunchCountdown } from "./launch-countdown";

/**
 * Resolve launch state from hook.deploymentTime[strategy] vs current time.
 * Returns `null` while the on-chain read is pending/failed (launchTs === 0),
 * `false` before trading opens, `true` once it has.
 */
function useLaunched(): boolean | null {
  const { data: snap } = useSnapshot();
  const launchTs = snap ? Number(snap.deploymentTime) : 0;
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  if (!launchTs) return null;
  return now >= launchTs;
}

/**
 * Pre-launch: render LaunchCountdown.
 * Post-launch: render DexChart.
 */
export function ChartOrCountdown() {
  // Default to the launch view until the on-chain deploymentTime resolves AND proves
  // trading already opened. A pending/failed read (launched === null) or a future
  // timestamp both render the countdown (which shows its own "Loading launch schedule…"
  // state) - we never silently degrade to the chart embed on a transient RPC failure.
  if (!useLaunched()) return <LaunchCountdown />;
  return <PriceChart />;
}

/**
 * Title subtitle for the chart card. Mirrors ChartOrCountdown's launch decision so
 * the line stays accurate as a DAT moves from countdown to live trading.
 */
export function ChartSubtitle() {
  return useLaunched() ? (
    <span>Live price chart from the v4 pool.</span>
  ) : (
    <span>Countdown to trading open.</span>
  );
}
