/**
 * Pure helpers that keep the price chart's y-axis sane when the swap feed
 * contains corrupt or degenerate ticks.
 *
 * Why this exists: indexed `swap` rows occasionally carry an anomalous
 * sqrtPriceX96 (a pool read at/near initialization, a low-liquidity launch
 * spike, or a stale value). Converted to ETH-per-token that surfaces as a point
 * many orders of magnitude off the real price. lightweight-charts' default
 * autoscale then spans [real ~2.5e-8 .. junk ~0.06] and, after the bottom
 * scaleMargin, the axis runs *negative* while the real series collapses to a
 * flat line at zero - the launch-day chart breakage we must not ship.
 *
 * Two independent guards:
 *   1. priceSanityBand / inPriceBand - drop only multi-order-of-magnitude junk,
 *      anchored on the live pool price (ground truth) or the median.
 *   2. robustPriceRange - frame the axis on a robust percentile band with a
 *      non-negative floor, so even a tick that slips through can't invert it.
 */

// Reject prices that differ from the anchor by more than this factor. 1e4 only
// removes true corruption (the observed spike was ~2.4e6x the real price);
// organic launch moves stay well inside it and are never clipped.
export const OUTLIER_BAND = 1e4;

export function median(values: number[]): number {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export type PriceBand = { lo: number; hi: number };

/**
 * Sanity band [lo, hi] for ETH prices. Anchored on the live pool price when
 * known (ground truth for "now"); otherwise the median of the set. Returns null
 * when there is nothing positive to anchor on (caller keeps everything).
 */
export function priceSanityBand(prices: number[], anchor?: number): PriceBand | null {
  const pos = prices.filter((p) => Number.isFinite(p) && p > 0);
  const center =
    anchor !== undefined && Number.isFinite(anchor) && anchor > 0 ? anchor : median(pos);
  if (!(center > 0)) return null;
  return { lo: center / OUTLIER_BAND, hi: center * OUTLIER_BAND };
}

// INV:chart-corrupt-tick-defense junk-tick band plus robust axis range; see docs/INVARIANTS.md
/** True if price is positive and inside the band (a null band = no anchor = keep). */
export function inPriceBand(price: number, band: PriceBand | null): boolean {
  if (!(Number.isFinite(price) && price > 0)) return false;
  if (!band) return true;
  return price >= band.lo && price <= band.hi;
}

export type PriceRange = { minValue: number; maxValue: number };

/**
 * Robust y-axis range from the values currently plotted: clip to the 2nd..98th
 * percentile so one stray tick can't blow out (or invert) the scale; clamp the
 * floor to >= 0 (a price is never negative); pad near-constant or single-value
 * data symmetrically so it doesn't render as a bare line with no headroom.
 * Returns null when there is no positive data (caller lets the default autoscale
 * take over - e.g. empty series).
 */
export function robustPriceRange(values: number[]): PriceRange | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return null;
  const q = (p: number) => v[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
  const lo = n >= 8 ? q(0.02) : v[0];
  const hi = n >= 8 ? q(0.98) : v[n - 1];
  if (!(hi > lo)) {
    const c = hi > 0 ? hi : 1e-12;
    return { minValue: Math.max(0, c * 0.9), maxValue: c * 1.1 };
  }
  const pad = (hi - lo) * 0.08;
  return { minValue: Math.max(0, lo - pad), maxValue: hi + pad };
}
