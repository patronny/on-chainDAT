import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";
import { strategyAbi } from "@/lib/abis/strategy";
import { erc20Abi } from "@/lib/abis/erc20";
import {
  poolManagerAbi,
  POOL_MANAGER_ADDR,
  POOL_SLOT0,
} from "@/lib/abis/poolmanager";
import { ADDR } from "@/lib/wagmi";

/**
 * Server-side snapshot of the shared, every-visitor on-chain state.
 *
 * Why this exists: previously every open browser ran the `useStrategyStats`
 * multicall (+ countdown reads) directly against the origin-locked frontend
 * Infura key every 12-30s, so RPC cost scaled LINEARLY with visitor count and
 * a launch spike would 429-storm the throughput cap. This route reads the same
 * data ONCE on the server (non-origin-locked ops key) and is CDN-cached, so all
 * users are served from the edge and Infura is hit ~once per `s-maxage` window
 * GLOBALLY, regardless of traffic. Per-wallet reads (balances/allowance) stay
 * client-side - they only fire for connected wallets and don't scale with
 * anonymous visitors.
 *
 * The frontend key 403s server-side (no Origin), so this MUST use a key without
 * an Origin allowlist. `LINEA_RPC_URL_SERVER` = the idle ops Infura key; falls
 * back to Linea's public RPC so the route degrades instead of breaking if unset.
 */
export const runtime = "nodejs";

const hookAbi = [
  {
    type: "function",
    name: "deploymentTime",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const RPC_URL =
  process.env.LINEA_RPC_URL_SERVER ||
  process.env.LINEA_RPC_URL ||
  "https://rpc.linea.build";

const client = createPublicClient({ chain: linea, transport: http(RPC_URL) });

const DEAD = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
const STRATEGY = ADDR.strategy;

export async function GET() {
  try {
    const r = await client.multicall({
      contracts: [
        { address: STRATEGY, abi: strategyAbi, functionName: "name" },
        { address: STRATEGY, abi: strategyAbi, functionName: "symbol" },
        { address: STRATEGY, abi: strategyAbi, functionName: "totalSupply" },
        { address: STRATEGY, abi: strategyAbi, functionName: "bagSize" },
        { address: STRATEGY, abi: strategyAbi, functionName: "buyIncrement" },
        { address: STRATEGY, abi: strategyAbi, functionName: "priceMultiplier" },
        { address: STRATEGY, abi: strategyAbi, functionName: "currentFees" },
        { address: STRATEGY, abi: strategyAbi, functionName: "ethToTwap" },
        { address: STRATEGY, abi: strategyAbi, functionName: "twapIncrement" },
        { address: STRATEGY, abi: strategyAbi, functionName: "twapDelayInBlocks" },
        { address: STRATEGY, abi: strategyAbi, functionName: "lastBuyBlock" },
        { address: STRATEGY, abi: strategyAbi, functionName: "lastTwapBlock" },
        { address: STRATEGY, abi: strategyAbi, functionName: "lastBagId" },
        { address: STRATEGY, abi: strategyAbi, functionName: "availableFunds" },
        { address: STRATEGY, abi: strategyAbi, functionName: "getMaxPriceForBuy" },
        { address: ADDR.tLINEA, abi: erc20Abi, functionName: "balanceOf", args: [STRATEGY] },
        { address: STRATEGY, abi: strategyAbi, functionName: "balanceOf", args: [DEAD] },
        { address: POOL_MANAGER_ADDR, abi: poolManagerAbi, functionName: "extsload", args: [POOL_SLOT0] },
        { address: ADDR.hook, abi: hookAbi, functionName: "deploymentTime", args: [STRATEGY] },
      ],
    });

    const big = (i: number): string =>
      r[i]?.status === "success" ? (r[i].result as bigint).toString() : "0";
    const str = (i: number): string =>
      r[i]?.status === "success" ? (r[i].result as string) : "";
    const slot0 =
      r[17]?.status === "success" ? (r[17].result as `0x${string}`) : "0x0";
    const sqrtPriceX96 =
      slot0 !== "0x0" ? (BigInt(slot0) & ((1n << 160n) - 1n)).toString() : "0";

    const body = {
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
      slot0,
      sqrtPriceX96,
      deploymentTime: big(18),
    };

    return new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json",
        // CDN-cache at the edge: all users served from cache; the origin (this
        // function -> Infura) runs at most ~once per 15s globally. SWR lets the
        // edge serve a slightly-stale copy instantly while it revalidates.
        "cache-control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "snapshot_failed" }), {
      status: 502,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}
