"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, linea } from "wagmi/chains";
import { http, fallback } from "viem";

/**
 * Client-only wagmi + RainbowKit configuration.
 * Imported only by `Providers` (which is itself a client component).
 * Server pages should import from `./wagmi` (server-safe constants only).
 */

// Placeholder projectId — used when env var is unset (e.g. local dev, preview deploy).
// Replace via NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for production. WalletConnect mobile
// won't work without a real ID, but injected wallets (MetaMask, Rabby) will.
const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "00000000000000000000000000000000";

// Base Sepolia RPC fallback chain. NEXT_PUBLIC_RPC_URL (if set) is tried first
// but never replaces the chain — drpc.org and blastapi.io free tiers don't
// return Access-Control-Allow-Origin and lock browser eth_calls at preflight,
// so we always keep CORS-friendly endpoints behind any custom RPC.
const customRpc = process.env.NEXT_PUBLIC_RPC_URL;
const KNOWN_NO_CORS = /(?:drpc\.org|blastapi\.io)/i;
const corsFriendlyFallbacks = [
  http("https://sepolia.base.org"),
  http("https://base-sepolia-rpc.publicnode.com"),
  http("https://base-sepolia.gateway.tenderly.co"),
];
const baseSepoliaRpcs = customRpc && !KNOWN_NO_CORS.test(customRpc)
  ? [http(customRpc), ...corsFriendlyFallbacks]
  : corsFriendlyFallbacks;

export const config = getDefaultConfig({
  appName: "LineaDAT",
  projectId: wcProjectId,
  chains: [baseSepolia, linea],
  transports: {
    [baseSepolia.id]: fallback(baseSepoliaRpcs, { rank: false, retryCount: 2 }),
    [linea.id]: http("https://rpc.linea.build"),
  },
  ssr: true,
});
