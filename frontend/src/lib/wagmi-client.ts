"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, linea } from "wagmi/chains";
import { http } from "viem";

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

export const config = getDefaultConfig({
  appName: "LINEASTR",
  projectId: wcProjectId,
  chains: [baseSepolia, linea],
  transports: {
    [baseSepolia.id]: http(
      // publicnode has no getLogs range limit (drpc free tier caps at 10k blocks).
      // For production with high traffic, set NEXT_PUBLIC_RPC_URL to an Alchemy/Infura URL.
      process.env.NEXT_PUBLIC_RPC_URL || "https://base-sepolia-rpc.publicnode.com"
    ),
    [linea.id]: http("https://rpc.linea.build"),
  },
  ssr: true,
});
