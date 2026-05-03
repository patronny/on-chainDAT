"use client";

import { useReadContracts } from "wagmi";
import { strategyAbi } from "@/lib/abis/strategy";
import { erc20Abi } from "@/lib/abis/erc20";
import { poolManagerAbi, POOL_MANAGER_ADDR, POOL_SLOT0 } from "@/lib/abis/poolmanager";
import { ADDR } from "@/lib/wagmi";

/**
 * Aggregates the most-frequently-displayed strategy state into a single hook.
 * Uses wagmi's `useReadContracts` (multicall) to batch all reads in a single RPC call.
 * Auto-refetches every 12 seconds (1 block on Base).
 */
export function useStrategyStats() {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      { address: ADDR.strategy, abi: strategyAbi, functionName: "name" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "symbol" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "totalSupply" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "bagSize" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "buyIncrement" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "priceMultiplier" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "currentFees" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "ethToTwap" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "twapIncrement" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "twapDelayInBlocks" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "lastBuyBlock" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "lastTwapBlock" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "lastBagId" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "availableFunds" },
      { address: ADDR.strategy, abi: strategyAbi, functionName: "getMaxPriceForBuy" },
      { address: ADDR.tLINEA, abi: erc20Abi, functionName: "balanceOf", args: [ADDR.strategy] },
      // Burn counter: LINEASTR balance held by 0x...dEaD (TWAP burns + future strategy buy-and-burn)
      { address: ADDR.strategy, abi: strategyAbi, functionName: "balanceOf", args: ["0x000000000000000000000000000000000000dEaD"] },
      // Pool slot0 — packs sqrtPriceX96 (low 160 bits) + tick + protocolFee + lpFee.
      { address: POOL_MANAGER_ADDR, abi: poolManagerAbi, functionName: "extsload", args: [POOL_SLOT0] },
    ],
    query: {
      refetchInterval: 12_000,
      enabled: ADDR.strategy !== "0x0000000000000000000000000000000000000000",
    },
  });

  // Partial-data resolution: a single failing multicall slot must NOT zero the whole
  // dashboard. Each field falls back to its zero/default; consumers render dashes
  // for genuinely-missing values and live numbers for everything else.
  if (!data) {
    return { data: undefined, isLoading, error, refetch };
  }

  const big = (i: number): bigint =>
    data[i]?.status === "success" ? (data[i].result as bigint) : 0n;
  const str = (i: number): string =>
    data[i]?.status === "success" ? (data[i].result as string) : "";
  const slot0Raw = data[17]?.status === "success" ? (data[17].result as `0x${string}`) : undefined;

  const stats = {
    name: str(0),
    symbol: str(1),
    totalSupply: big(2),
    bagSize: big(3),
    buyIncrement: big(4),
    priceMultiplier: big(5),
    currentFees: big(6),
    ethToTwap: big(7),
    twapIncrement: big(8),
    twapDelayInBlocks: big(9),
    lastBuyBlock: big(10),
    lastTwapBlock: big(11),
    lastBagId: big(12),
    availableFunds: big(13),
    maxPriceForBuy: big(14),
    treasuryUnderlying: big(15),
    burned: big(16),
    slot0: (slot0Raw ?? "0x0") as `0x${string}`,
    sqrtPriceX96: slot0Raw ? BigInt(slot0Raw) & ((1n << 160n) - 1n) : 0n,
  };

  return { data: stats, isLoading, error, refetch };
}
