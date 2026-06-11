"use client";

import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useEthPrice } from "@/hooks/useEthPrice";
import { formatTokens } from "@/lib/utils";
import { LineaDatSquareIcon, EthIcon } from "./icons/token-icons";

/**
 * Live composition of the $LINEADAT / ETH Uniswap v4 pool.
 *
 * LINEADAT side = exact on-chain balanceOf(PoolManager) from the snapshot.
 * ETH side cannot be read the same way (the v4 PoolManager singleton holds
 * native ETH for ALL pools on the chain), so it is derived from the pool's
 * single permanently-locked seeder position (Deploy.s.sol): range
 * [TICK_LOWER=-887220, TICK_UPPER=175020], initialized AT the upper tick with
 * L = TOTAL_SUPPLY * 2^96 / (sqrtPb - sqrtPa). Standard CL math then gives
 * amount0(ETH) = L * (sqrtPb - sqrtP) * 2^96 / (sqrtP * sqrtPb).
 * Float precision is fine for display. Assumes no third-party LP positions
 * (LINEADAT is non-transferable, so nobody else can supply the token side).
 */
const Q96 = 2 ** 96;
const SQRT_PA = Math.sqrt(Math.pow(1.0001, -887220)) * Q96;
const SQRT_PB = Math.sqrt(Math.pow(1.0001, 175020)) * Q96;
const TOTAL_SUPPLY_WEI = 1e27;
const L = (TOTAL_SUPPLY_WEI * Q96) / (SQRT_PB - SQRT_PA);

function fmtUsd(v: number, digits = 0): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits })}`;
}

export function PoolLiquidityCard() {
  const { data } = useStrategyStats();
  const ethUsd = useEthPrice();

  const poolTokens = data?.poolLineadat ?? 0n;
  const sqrtP = Number(data?.sqrtPriceX96 ?? 0n);

  const ethInPool =
    sqrtP > 0 && sqrtP < SQRT_PB
      ? (L * (SQRT_PB - sqrtP) * Q96) / (sqrtP * SQRT_PB) / 1e18
      : 0;
  // Real money in the pool = the ETH side only. The token side is the supply
  // itself - its market-price USD value is realizable only against this ETH,
  // so counting it (the GeckoTerminal/CoinGecko "liquidity" convention) would
  // overstate what actually sits in the pool. Owner decision 2026-06-11.
  const realUsd = ethInPool * ethUsd;

  const loading = sqrtP === 0 || poolTokens === 0n;

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <LineaDatSquareIcon className="w-5 h-5 flex-shrink-0" /> $LINEADAT
        </span>
        <span className="font-mono tabular">{loading ? "-" : formatTokens(poolTokens)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <EthIcon className="w-5 h-5 flex-shrink-0" /> $ETH
        </span>
        <span className="font-mono tabular">
          {loading ? "-" : ethInPool.toLocaleString("en-US", { maximumFractionDigits: 4 })}
        </span>
      </div>
      <div className="border-t border-border pt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">ETH price</span>
          <span className="font-mono tabular">{ethUsd > 0 ? fmtUsd(ethUsd, 2) : "-"}</span>
        </div>
        <div
          className="flex items-center justify-between cursor-help"
          title="Actual ETH sitting in the pool, in USD. The token side is the supply itself - its value is realizable only against this ETH."
        >
          <span className="text-muted-foreground">Real liquidity</span>
          <span
            className="font-mono tabular font-semibold"
            style={{
              color: "rgb(74, 222, 128)",
              textShadow: "0 0 6px rgba(74,222,128,0.85), 0 0 14px rgba(74,222,128,0.5)",
            }}
          >
            {!loading && realUsd > 0 ? fmtUsd(realUsd) : "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
