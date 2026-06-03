"use client";

import { DEFAULT_CHAIN_ID } from "@/lib/wagmi";
import { useSnapshot } from "./useSnapshot";

/**
 * ETH cost of one full bag of the underlying at the most liquid LINEA/ETH market -
 * the denominator for the "X% to next bag" progress bar.
 *
 * Mainnet (Linea, 59144): the Etherex CL QuoterV2 read (WETH needed to acquire
 * one `bagSize` of LINEA) now comes from the CDN-cached `/api/snapshot` instead of
 * a per-browser eth_call, so it no longer scales with visitor count. The bagSize
 * is read on the server from the live contract, so the `bagSize` arg is accepted
 * for call-site compatibility but unused here.
 *
 * Base Sepolia testnet: tLINEA is a faucet mock with no real market, so fall back
 * to the keeper's 0.02 ETH buy threshold.
 */
const PHASE3_BAG_MARKET_PRICE_WEI = 20_000_000_000_000_000n; // 0.02 ETH

export function useBagMarketPriceEth(_bagSize: bigint): bigint {
  const isMainnet = DEFAULT_CHAIN_ID === 59144;
  const { data } = useSnapshot();
  if (!isMainnet) return PHASE3_BAG_MARKET_PRICE_WEI;
  return data?.bagMarketPriceWei ?? 0n;
}
