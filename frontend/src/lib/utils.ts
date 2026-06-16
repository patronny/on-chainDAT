import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// NOTE: the on-chain getLogs fallback (getEventsChunked) was REMOVED for good
// after launch day 2026-06-09: it burned 82% of the daily Infura quota in ~1h
// (eth_getLogs is the priciest method and it scaled per visitor tab). Tables are
// indexer-only now - the browser reaches the Ponder indexer through the
// same-origin /api/indexer proxy (reachable wherever the site itself is), and
// when the indexer is down they say "temporarily unavailable" honestly instead
// of hammering the RPC. See obsidian/INCIDENTS.md (INC-1, INC-2).

/**
 * Tailwind class merger - combines clsx for conditional logic with tailwind-merge for conflict resolution.
 * Standard shadcn/ui utility used by every component.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an Ethereum address to a short form: 0x1234...abcd
 */
export function shortAddress(addr: string | undefined, chars = 4): string {
  if (!addr) return "0x...";
  if (addr.length < chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

/**
 * Format a wei value as ETH with N decimal places.
 *
 * For very small non-zero values where N decimals would round to 0, fall back
 * to up to 7 fraction digits so a real number doesn't render as "0". Without
 * this a +0.0000191 ETH bot profit (real on-chain) shows as "+0 ETH" because
 * the default precision of 4 truncates the leading zeros.
 */
export function formatEth(wei: bigint | undefined, decimals = 4): string {
  if (wei === undefined) return "-";
  const eth = Number(wei) / 1e18;
  if (eth === 0) return "0";
  const minRepresentable = 10 ** -decimals;
  const useExtra = Math.abs(eth) > 0 && Math.abs(eth) < minRepresentable;
  return eth.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: useExtra ? 7 : decimals,
  });
}

/**
 * Format a tLINEA / LINEA value (also 18 decimals) - alias of formatEth with default 0 decimals.
 */
export function formatTokens(wei: bigint | undefined, decimals = 0): string {
  if (wei === undefined) return "-";
  const tokens = Number(wei) / 1e18;
  return tokens.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** USD value of a wei ETH amount at the given ETH/USD price. */
export function ethToUsd(wei: bigint, ethUsd: number): number {
  return (Number(wei) / 1e18) * ethUsd;
}

/** Compact "~$402" / "~$12.34" label (0 decimals at >= $100, else 2). */
export function usdApprox(usd: number): string {
  return `~$${usd.toLocaleString("en-US", { maximumFractionDigits: usd >= 100 ? 0 : 2 })}`;
}

/** Shared neon styles for the Holdings relist price (see bagArbStyle). */
export const NEON_GREEN_STYLE = {
  color: "rgb(74, 222, 128)",
  textShadow: "0 0 6px rgba(74,222,128,0.85), 0 0 14px rgba(74,222,128,0.5)",
};
export const NEON_PINK_STYLE = {
  color: "hsl(320 100% 60%)",
  textShadow: "0 0 6px hsla(320,100%,60%,0.85), 0 0 14px hsla(320,100%,60%,0.5)",
};

/**
 * Neon arbitrage signal for a bag relisted at 1.2x. GREEN when the bag's list
 * price is BELOW its live market value (the LINEA inside is worth more than the
 * ask - buying it from the DAT is an arbitrage); PINK when listed at/above
 * market (overpriced). Returns undefined until market data loads, so callers
 * render the price plainly instead of flashing a misleading colour.
 */
export function bagArbStyle(listedWei: bigint, marketWei: bigint) {
  if (listedWei <= 0n || marketWei <= 0n) return undefined;
  return marketWei > listedWei ? NEON_GREEN_STYLE : NEON_PINK_STYLE;
}

/**
 * Convert a block number to an estimated time delta.
 * Base Sepolia ~2s/block; Linea ~3s/block.
 */
export function blocksToTime(blocks: number, secsPerBlock = 2): string {
  const secs = blocks * secsPerBlock;
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  return `${Math.round(secs / 86400)}d`;
}

/**
 * Detect mobile viewport (used in client components for layout decisions).
 */
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

/**
 * Convert sqrtPriceX96 to LINEASTR-per-ETH ratio (Q64.96 → float).
 */
export function sqrtPriceX96ToRatio(sqrt: bigint): number {
  if (sqrt === 0n) return 0;
  const Q96 = 2 ** 96;
  const sqrtFloat = Number(sqrt) / Q96;
  return sqrtFloat * sqrtFloat;
}

/** ETH per 1 LINEASTR (inverse of pool price). */
export function ldatPriceInEth(sqrt: bigint | undefined): number {
  if (!sqrt || sqrt === 0n) return 0;
  const r = sqrtPriceX96ToRatio(sqrt);
  return r > 0 ? 1 / r : 0;
}

/** Date formatter matching the reference layout: M/D/YYYY - HH:MM AM/PM */
export function formatTradeDate(unixSec: number): string {
  if (!unixSec) return "-";
  // UTC, not viewer-local: table headers are labeled "Date (UTC)" and the
  // Telegram trades feed uses UTC - one timezone everywhere, no ambiguity.
  const d = new Date(unixSec * 1000);
  const date = d.toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
  return `${date} - ${time}`;
}
