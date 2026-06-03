"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Shared, every-visitor on-chain state, read from the CDN-cached `/api/snapshot`
 * Route Handler instead of from each browser's own Infura calls. React Query
 * dedupes all consumers in a tab into one fetch; the edge cache dedupes across
 * all tabs/users. See `src/app/api/snapshot/route.ts` for the why.
 */
export type Snapshot = {
  name: string;
  symbol: string;
  totalSupply: bigint;
  bagSize: bigint;
  buyIncrement: bigint;
  priceMultiplier: bigint;
  currentFees: bigint;
  ethToTwap: bigint;
  twapIncrement: bigint;
  twapDelayInBlocks: bigint;
  lastBuyBlock: bigint;
  lastTwapBlock: bigint;
  lastBagId: bigint;
  availableFunds: bigint;
  maxPriceForBuy: bigint;
  treasuryUnderlying: bigint;
  burned: bigint;
  slot0: `0x${string}`;
  sqrtPriceX96: bigint;
  deploymentTime: bigint;
  feeBuy: bigint;
  feeSell: bigint;
  blockNumber: bigint;
  bagMarketPriceWei: bigint;
};

async function fetchSnapshot(): Promise<Snapshot> {
  const res = await fetch("/api/snapshot");
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  const j = (await res.json()) as Record<string, string>;
  const b = (k: string): bigint => {
    try {
      return BigInt(j[k] ?? "0");
    } catch {
      return 0n;
    }
  };
  return {
    name: j.name ?? "",
    symbol: j.symbol ?? "",
    totalSupply: b("totalSupply"),
    bagSize: b("bagSize"),
    buyIncrement: b("buyIncrement"),
    priceMultiplier: b("priceMultiplier"),
    currentFees: b("currentFees"),
    ethToTwap: b("ethToTwap"),
    twapIncrement: b("twapIncrement"),
    twapDelayInBlocks: b("twapDelayInBlocks"),
    lastBuyBlock: b("lastBuyBlock"),
    lastTwapBlock: b("lastTwapBlock"),
    lastBagId: b("lastBagId"),
    availableFunds: b("availableFunds"),
    maxPriceForBuy: b("maxPriceForBuy"),
    treasuryUnderlying: b("treasuryUnderlying"),
    burned: b("burned"),
    slot0: (j.slot0 as `0x${string}`) ?? "0x0",
    sqrtPriceX96: b("sqrtPriceX96"),
    deploymentTime: b("deploymentTime"),
    feeBuy: b("feeBuy"),
    feeSell: b("feeSell"),
    blockNumber: b("blockNumber"),
    bagMarketPriceWei: b("bagMarketPriceWei"),
  };
}

export function useSnapshot() {
  return useQuery({
    queryKey: ["snapshot"],
    queryFn: fetchSnapshot,
    // The endpoint is CDN-cached (~15s), so polling it is cheap (no Infura per
    // poll). Refetch on a 15s cadence to match the edge cache window.
    refetchInterval: 15_000,
    staleTime: 12_000,
  });
}
