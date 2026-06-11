import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";
import { strategyAbi } from "@/lib/abis/strategy";
import { ADDR } from "@/lib/wagmi";

/**
 * Shared helper for the plain-text supply endpoints required by listing
 * aggregators (CoinMarketCap / CoinGecko ask for URLs that return ONLY a
 * numerical value, in whole-token denomination):
 *   /api/supply/total       - totalSupply minus verifiably burned (dead address)
 *   /api/supply/circulating - same number: 100% of supply was seeded into the
 *                             pool at launch (LP burned, no team allocation, no
 *                             locks), so circulating == total at all times.
 *
 * Same key strategy as /api/snapshot: server-side ops key, CDN-cached at the
 * edge so aggregator polling never scales Infura cost.
 */
export const runtime = "nodejs";

const RPC_URL =
  process.env.LINEA_RPC_URL_SERVER ||
  process.env.LINEA_RPC_URL ||
  "https://rpc.linea.build";

const client = createPublicClient({ chain: linea, transport: http(RPC_URL) });

const DEAD = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;

export async function supplyResponse(req: Request): Promise<Response> {
  // Same cache-busting guard as /api/snapshot: bounce query'd requests to the
  // canonical path so `?cb=` can't bypass the edge cache and hammer the RPC.
  const url = new URL(req.url);
  if (url.search) {
    url.search = "";
    return Response.redirect(url.toString(), 308);
  }
  try {
    const [totalSupply, burned] = (await client.multicall({
      contracts: [
        { address: ADDR.strategy, abi: strategyAbi, functionName: "totalSupply" },
        { address: ADDR.strategy, abi: strategyAbi, functionName: "balanceOf", args: [DEAD] },
      ],
      allowFailure: false,
    })) as [bigint, bigint];

    const wei = totalSupply - burned;
    const whole = wei / 10n ** 18n;
    const frac = wei % 10n ** 18n;
    const text =
      frac === 0n
        ? whole.toString()
        : `${whole}.${frac.toString().padStart(18, "0").replace(/0+$/, "")}`;

    return new Response(text, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response("error", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
