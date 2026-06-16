/**
 * Server-safe wagmi constants - pure data + helpers, no client-side functions.
 * The wagmi `config` object lives in `wagmi-client.ts` (client-only) so that server pages
 * importing ADDR / txUrl / etc don't accidentally pull `getDefaultConfig` into the server bundle.
 */

/**
 * Default chain for Phase 3 - Base Sepolia (84532). Phase 4 will switch to Linea (59144).
 */
export const DEFAULT_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || "84532",
  10
);

/**
 * Underlying-asset ticker shown in the UI. Linea mainnet = canonical $LINEA;
 * Base Sepolia testnet = mock tLINEA. Drives every user-facing token label so the
 * whole app reads "LINEA" on mainnet without per-component hardcodes.
 */
export const UNDERLYING_SYMBOL = DEFAULT_CHAIN_ID === 59144 ? "LINEA" : "tLINEA";

/**
 * Strategy deploy block - lower bound for full-history event reads (used by
 * the future Ponder indexer wiring; rolling-window queries don't read this).
 * Defaults to the LDAT Phase 3.5 launch block on Base Sepolia (with launch
 * gate; previous values from the legacy LINEASTR deploy and the gate-less
 * LDAT deploy are now zombies).
 * Override via NEXT_PUBLIC_DEPLOY_BLOCK after each redeploy. NEVER 0n in
 * production - a 0n value triggers a 41M-block scan and 4500+ parallel RPC
 * chunk requests.
 */
export const DEPLOY_BLOCK: bigint = process.env.NEXT_PUBLIC_DEPLOY_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK)
  : 41112701n;

function addressOr0(envVar: string | undefined): `0x${string}` {
  if (!envVar || !envVar.startsWith("0x") || envVar.length !== 42) {
    return "0x0000000000000000000000000000000000000000" as `0x${string}`;
  }
  return envVar as `0x${string}`;
}

/**
 * Hardcoded fallbacks below point at the LDAT Phase 3.5 deployment on Base Sepolia
 * (with scheduled launch gate). Override via NEXT_PUBLIC_*_ADDRESS env vars on Vercel.
 * tLINEA stays the same across redeploys (never re-deployed by design).
 */
const FALLBACK_TLINEA   = "0x88a8D5ED5D1be44098F226EDf11C3160Fd76421F";
const FALLBACK_FACTORY  = "0x8498c8542ea2d9BC0CeD3d21EF22d43Dea750A1B";
const FALLBACK_STRATEGY = "0x615937AE1eB71248DA407F39AcFea9288CF1784F";
const FALLBACK_BOT      = "0x8FC3c32fd69D714413C1ecD66FA4067b08eE3532";
const FALLBACK_HOOK     = "0x512dd6871eb3a28aD07885A9B75a2e26eDa2a444";
const FALLBACK_FAUCET   = "0x50910c9cA9262051f3697Ab09450773287516c6E";

function addressOrFallback(envVar: string | undefined, fallback: string): `0x${string}` {
  if (!envVar || !envVar.startsWith("0x") || envVar.length !== 42) {
    return fallback as `0x${string}`;
  }
  return envVar as `0x${string}`;
}

export const ADDR = {
  tLINEA:   addressOrFallback(process.env.NEXT_PUBLIC_TLINEA_ADDRESS,   FALLBACK_TLINEA),
  factory:  addressOrFallback(process.env.NEXT_PUBLIC_FACTORY_ADDRESS,  FALLBACK_FACTORY),
  strategy: addressOrFallback(process.env.NEXT_PUBLIC_STRATEGY_ADDRESS, FALLBACK_STRATEGY),
  bot:      addressOrFallback(process.env.NEXT_PUBLIC_BOT_ADDRESS,      FALLBACK_BOT),
  hook:     addressOrFallback(process.env.NEXT_PUBLIC_HOOK_ADDRESS,     FALLBACK_HOOK),
  faucet:   addressOrFallback(process.env.NEXT_PUBLIC_FAUCET_ADDRESS,   FALLBACK_FAUCET),
} as const;

/// Uniswap Universal Router (v4-capable) + canonical Permit2. Swaps go through the standard
/// Universal Router (V4_SWAP), not a custom swapper - the non-transferable token is delivered via
/// the hook's transient allowance, no distributor whitelist needed. UR fallback = Linea V2_1_1.
export const UNIVERSAL_ROUTER = addressOrFallback(
  process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER,
  "0x8B844f885672f333Bc0042cB669255f93a4C1E6b"
);
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`;

/// Uniswap v4 Quoter on Linea - simulates a swap against our pool (hook included) to get the exact
/// output, used to set the swap's slippage floor (amountOutMinimum). Fallback = canonical Linea v4 Quoter.
export const V4_QUOTER = addressOrFallback(
  process.env.NEXT_PUBLIC_V4_QUOTER,
  "0x2c125569c0bee20a66e33e5491c552b37ebd9934"
);

/// LDAT Uniswap v4 pool key (currency0=ETH, currency1=LDAT strategy token, dynamic fee).
/// Passed to V4_SWAP actions in the Universal Router.
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
