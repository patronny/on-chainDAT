"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useBalance, useReadContract, useWriteContract } from "wagmi";
import { Button } from "./ui/button";
import { erc20Abi } from "@/lib/abis/erc20";
import { swapperAbi, hookAbi } from "@/lib/abis/swapper";
import { ADDR, POOL_KEY } from "@/lib/wagmi";
import { formatEth, formatTokens, sqrtPriceX96ToRatio } from "@/lib/utils";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { ArrowDown } from "lucide-react";
import { EthIcon, LineastrIcon } from "./icons/token-icons";

function TokenBadge({ symbol }: { symbol: string }) {
  const Icon = symbol === "ETH" ? EthIcon : LineastrIcon;
  return (
    <span className="flex-shrink-0 inline-flex items-center gap-1.5 font-semibold text-sm font-mono">
      <Icon className="w-5 h-5" />
      {symbol}
    </span>
  );
}

/**
 * Standalone Swap card matching tokenstrategy.com layout: Selling input on top, swap arrow,
 * Buying input below, Enter amount button, Protocol fee footer.
 */
export function SwapCard() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountStr, setAmountStr] = useState("");
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: linBal } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: linAllowance } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.swapper] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: feeBpsRaw } = useReadContract({
    address: ADDR.hook,
    abi: hookAbi,
    functionName: "calculateFee",
    args: [ADDR.strategy, side === "buy"],
    query: { refetchInterval: 30_000 },
  });
  const feeBps = feeBpsRaw ?? (side === "buy" ? 9900n : 1000n);
  const feePercent = Number(feeBps) / 100;

  const { data: stats } = useStrategyStats();
  // Pool ratio = LINEASTR-per-ETH (token1 / token0). Used to estimate output.
  const poolRatio = stats?.sqrtPriceX96 ? sqrtPriceX96ToRatio(stats.sqrtPriceX96) : 0;

  let amountWei = 0n;
  let valid = false;
  try {
    if (amountStr.trim()) {
      amountWei = parseEther(amountStr);
      valid = amountWei > 0n;
    }
  } catch {
    valid = false;
  }

  // Estimate output amount from pool ratio + hook fee.
  // buy:  ETH in  → LINEASTR out = amountIn * poolRatio * (1 - feeBps/10000)
  // sell: LIN in  → ETH out      = amountIn / poolRatio * (1 - feeBps/10000)
  let estimatedOut = "";
  if (valid && poolRatio > 0) {
    const amountInFloat = Number(amountWei) / 1e18;
    const feeMul = Math.max(0, 1 - Number(feeBps) / 10000);
    const out = side === "buy"
      ? amountInFloat * poolRatio * feeMul
      : (amountInFloat / poolRatio) * feeMul;
    if (out > 0 && Number.isFinite(out)) {
      if (side === "buy") {
        estimatedOut = out >= 1
          ? out.toLocaleString("en-US", { maximumFractionDigits: 2 })
          : out.toFixed(6);
      } else {
        estimatedOut = out >= 0.0001 ? out.toFixed(6) : out.toExponential(2);
      }
    }
  }

  const userEth = ethBalance?.value ?? 0n;
  const userLin = linBal ?? 0n;
  const userAllowance = linAllowance ?? 0n;
  const enoughForBuy = side === "buy" ? userEth >= amountWei + parseEther("0.0001") : true;
  const enoughForSell = side === "sell" ? userLin >= amountWei : true;
  const enoughAllowance = side === "buy" ? true : userAllowance >= amountWei;

  function approve() {
    writeContract({ address: ADDR.strategy, abi: erc20Abi, functionName: "approve", args: [ADDR.swapper, amountWei] });
  }
  function executeBuy() {
    if (!address) return;
    writeContract({ address: ADDR.swapper, abi: swapperAbi, functionName: "buyExactInput", args: [POOL_KEY, address], value: amountWei });
  }
  function executeSell() {
    if (!address) return;
    writeContract({ address: ADDR.swapper, abi: swapperAbi, functionName: "sellExactInput", args: [POOL_KEY, amountWei, address] });
  }

  // Selling/Buying assignments based on side
  const sellingLabel = side === "buy" ? "ETH" : "LINEADAT";
  const buyingLabel = side === "buy" ? "LINEADAT" : "ETH";
  const sellingBalance = side === "buy" ? userEth : userLin;
  const buyingBalance = side === "buy" ? userLin : userEth;

  function flip() {
    setSide(side === "buy" ? "sell" : "buy");
    setAmountStr("");
  }

  return (
    <>
      <div className="p-4 sm:p-5 space-y-3">
        {/* Selling */}
        <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex-shrink-0">Selling</span>
            <span className="font-mono truncate text-right">
              Balance: {side === "buy" ? `${formatEth(sellingBalance)} ETH` : formatTokens(sellingBalance)}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Amount to sell in ${sellingLabel}`}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="flex-1 min-w-0 w-0 bg-transparent text-xl sm:text-2xl font-mono tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (side === "buy" && userEth > parseEther("0.0001")) {
                  setAmountStr(((Number(userEth - parseEther("0.0001")) / 1e18)).toFixed(6));
                } else if (side === "sell" && userLin > 0n) {
                  setAmountStr((Number(userLin) / 1e18).toString());
                }
              }}
              className="flex-shrink-0 px-2 py-1 text-xs font-bold uppercase tracking-wider rounded bg-secondary text-secondary-foreground hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Set max ${sellingLabel} balance`}
            >
              Max
            </button>
            <TokenBadge symbol={sellingLabel} />
          </div>
        </div>

        {/* Flip arrow */}
        <div className="flex justify-center">
          <button
            onClick={flip}
            className="rounded-full p-2 bg-secondary text-secondary-foreground hover:opacity-80 border border-border focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Flip swap direction"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        {/* Buying */}
        <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex-shrink-0">Buying</span>
            <span className="font-mono truncate text-right">
              Balance: {side === "buy" ? formatTokens(buyingBalance) : `${formatEth(buyingBalance)} ETH`}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="flex-1 min-w-0 w-0 text-xl sm:text-2xl font-mono tabular text-muted-foreground truncate">
              {valid ? (estimatedOut ? `≈ ${estimatedOut}` : "…") : "0.0"}
            </span>
            <TokenBadge symbol={buyingLabel} />
          </div>
        </div>

        {/* Action button */}
        {!valid ? (
          <Button className="w-full" disabled size="lg">Enter an amount</Button>
        ) : side === "buy" ? (
          !enoughForBuy ? (
            <Button className="w-full" disabled size="lg">Insufficient ETH</Button>
          ) : (
            <Button className="w-full" onClick={executeBuy} disabled={isPending} size="lg">
              {isPending ? "Buying…" : `Buy LINEADAT with ${amountStr} ETH`}
            </Button>
          )
        ) : !enoughForSell ? (
          <Button className="w-full" disabled size="lg">Insufficient LINEADAT</Button>
        ) : !enoughAllowance ? (
          <Button className="w-full" onClick={approve} disabled={isPending} size="lg">
            {isPending ? "Approving…" : "Approve LINEADAT"}
          </Button>
        ) : (
          <Button className="w-full" onClick={executeSell} disabled={isPending} size="lg">
            {isPending ? "Selling…" : `Sell ${amountStr} LINEADAT`}
          </Button>
        )}
      </div>

      <div className="px-4 sm:px-5 py-3 border-t border-border flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground flex-shrink-0">Protocol fee</span>
        <span className="font-mono tabular font-semibold truncate text-right">
          {feePercent.toFixed(feePercent < 100 && feePercent !== Math.floor(feePercent) ? 2 : 0)}% on this swap
        </span>
      </div>
    </>
  );
}
