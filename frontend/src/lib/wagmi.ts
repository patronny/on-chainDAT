/**
 * Server-safe wagmi constants — pure data + helpers, no client-side functions.
 * The wagmi `config` object lives in `wagmi-client.ts` (client-only) so that server pages
 * importing ADDR / txUrl / etc don't accidentally pull `getDefaultConfig` into the server bundle.
 */

/**
 * Default chain for Phase 3 — Base Sepolia (84532). Phase 4 will switch to Linea (59144).
 */
export const DEFAULT_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || "84532",
  10
);

/**
 * Strategy deploy block — lower bound for full-history event reads (used by
 * the future Ponder indexer wiring; rolling-window queries don't read this).
 * Defaults to the live Phase 3 strategy deploy block on Base Sepolia. Override
 * via NEXT_PUBLIC_DEPLOY_BLOCK after each redeploy. NEVER 0n in production —
 * a 0n value triggers a 41M-block scan and 4500+ parallel RPC chunk requests.
 */
export const DEPLOY_BLOCK: bigint = process.env.NEXT_PUBLIC_DEPLOY_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK)
  : 41022811n;

function addressOr0(envVar: string | undefined): `0x${string}` {
  if (!envVar || !envVar.startsWith("0x") || envVar.length !== 42) {
    return "0x0000000000000000000000000000000000000000" as `0x${string}`;
  }
  return envVar as `0x${string}`;
}

export const ADDR = {
  tLINEA: addressOr0(process.env.NEXT_PUBLIC_TLINEA_ADDRESS),
  factory: addressOr0(process.env.NEXT_PUBLIC_FACTORY_ADDRESS),
  strategy: addressOr0(process.env.NEXT_PUBLIC_STRATEGY_ADDRESS),
  bot: addressOr0(process.env.NEXT_PUBLIC_BOT_ADDRESS),
  // Phase 3.5 — real Uniswap v4 hook + ETH/LineaDAT pool. Hardcoded fallbacks below
  // point at the legacy LINEASTR deployment on Base Sepolia (still live until Step 7
  // redeploys under the LineaDAT brand). Override via env after redeploy.
  hook: (process.env.NEXT_PUBLIC_HOOK_ADDRESS || "0x61116044DC8eB623A618021cEDB14836D6512444") as `0x${string}`,
  swapper: (process.env.NEXT_PUBLIC_SWAPPER_ADDRESS || "0x1a1434d72B23B1A968824191195efcf95B07116c") as `0x${string}`,
} as const;

/// LineaDAT Uniswap v4 pool key (currency0=ETH, currency1=LineaDAT strategy token, dynamic fee).
/// Used by the test swapper for Buy/Sell on Base Sepolia (Phase 3.5).
export const POOL_KEY = {
  currency0: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  currency1: ADDR.strategy,
  fee: 0x800000, // DYNAMIC_FEE_FLAG
  tickSpacing: 60,
  hooks: ADDR.hook,
} as const;

export const BLOCK_EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://sepolia.basescan.org";

export function txUrl(hash: string): string {
  return `${BLOCK_EXPLORER_URL}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
}
