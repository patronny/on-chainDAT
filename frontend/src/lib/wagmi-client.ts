"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, linea } from "wagmi/chains";
import { http } from "viem";
import { DEFAULT_CHAIN_ID } from "./wagmi";
import { lineaClientTransport } from "./rpc";

/**
 * Client-only wagmi + RainbowKit configuration.
 * Imported only by `Providers` (which is itself a client component).
 * Server pages should import from `./wagmi` (server-safe constants only).
 */

// Placeholder projectId - used when env var is unset (e.g. local dev, preview deploy).
// Replace via NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for production. WalletConnect mobile
// won't work without a real ID, but injected wallets (MetaMask, Rabby) will.
const wcProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "00000000000000000000000000000000";

// Stage-aware: expose EXACTLY ONE active chain, chosen by NEXT_PUBLIC_CHAIN_ID.
// Linea mainnet (59144) for the production / mainnet deployment; Base Sepolia (84532)
// for the legacy Phase 3.5 testnet. A single-chain config means unconnected reads
// (useReadContract with no explicit chainId) resolve to the right network instead of
// silently defaulting to chains[0] - which is what made the launch countdown read the
// wrong chain when Base Sepolia was listed first.
const activeChains =
  DEFAULT_CHAIN_ID === linea.id ? ([linea] as const) : ([baseSepolia] as const);

// Linea mainnet RPC = Infura-first fallback transport (paid frontend key, then
// public RPCs) so a single-provider outage can't take browser reads down - see
// lib/rpc.ts. Base Sepolia keeps its public fallback.
const baseSepoliaRpc = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";

export const config = getDefaultConfig({
  appName: "LDAT",
  projectId: wcProjectId,
  chains: activeChains,
  transports: {
    [linea.id]: lineaClientTransport(),
    [baseSepolia.id]: http(baseSepoliaRpc),
  },
  ssr: true,
});
