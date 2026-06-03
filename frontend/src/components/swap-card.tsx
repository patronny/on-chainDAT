"use client";

import { useEffect, useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "./ui/button";
import { erc20Abi } from "@/lib/abis/erc20";
import { swapperAbi } from "@/lib/abis/swapper";
import { ADDR, POOL_KEY } from "@/lib/wagmi";
import { formatEth, formatTokens, sqrtPriceX96ToRatio } from "@/lib/utils";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { ArrowDown } from "lucide-react";
import { EthIcon, LineaDatSquareIcon } from "./icons/token-icons";
import { SwapProgressModal, SwapStep } from "./swap-progress-modal";

/**
 * Compact, human-friendly amount for the MAX-filled input - avoids raw scientific
 * notation (e.g. "5.1848202224e-8") and absurd precision. Display-only: the actual
 * swap uses the exact balance bigint (see maxSelected), so rounding here is harmless.
 *   >=1000 -> integer; 1..1000 -> up to 4 decimals; <1 -> 4 significant figures, expanded.
 */
function cleanAmount(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "";
  if (v >= 1000) return Math.floor(v).toString();
  if (v >= 1) return v.toFixed(4).replace(/\.?0+$/, "");
  const exp = Math.floor(Math.log10(v));
  const decimals = Math.min(18, -exp + 3);
  return v.toFixed(decimals).replace(/\.?0+$/, "");
}

function TokenBadge({ symbol }: { symbol: string }) {
  const Icon = symbol === "ETH" ? EthIcon : LineaDatSquareIcon;
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
 *
 * Trade execution lives in a LlamaSwap-style progress modal (Approve -> Swap with auto-advance).
 * The card's button only opens the modal; all wallet popups are gated by modal state, which
 * eliminates the double-click double-spend trap (even with `useWaitForTransactionReceipt`,
 * a stray click between popups was still possible against the bare button).
 */
export function SwapCard() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountStr, setAmountStr] = useState("");
  // True while amountStr came from the MAX button (and hasn't been hand-edited). When
  // set, the trade size is the exact balance bigint, not the re-parsed display string.
  const [maxSelected, setMaxSelected] = useState(false);
  const { address } = useAccount();

  // Two independent write hooks so we can hold a tx hash for the approve step
  // and another for the swap step concurrently within one modal flow.
  const approveWrite = useWriteContract();
  const swapWrite = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveWrite.data });
  const swapReceipt = useWaitForTransactionReceipt({ hash: swapWrite.data });

  const [step, setStep] = useState<SwapStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  // Snapshot of the trade params at modal-open time so live input edits can't
  // change what's mid-flight.
  const [tradeSnapshot, setTradeSnapshot] = useState<{
    side: "buy" | "sell";
    amountWei: bigint;
    amountStr: string;
    estimatedOut: string;
  } | null>(null);

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: linBal, refetch: refetchLin } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: linAllowance, refetch: refetchAllowance } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.swapper] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });
  const { data: stats } = useStrategyStats();
  // Current decaying protocol fee, from the shared snapshot (was a per-browser
  // calculateFee read). Fall back to the launch defaults until it resolves.
  const feeRaw = stats ? (side === "buy" ? stats.feeBuy : stats.feeSell) : 0n;
  const feeBps = feeRaw > 0n ? feeRaw : side === "buy" ? 9900n : 1000n;
  const feePercent = Number(feeBps) / 100;
  const poolRatio = stats?.sqrtPriceX96 ? sqrtPriceX96ToRatio(stats.sqrtPriceX96) : 0;

  const userEth = ethBalance?.value ?? 0n;
  const userLin = linBal ?? 0n;
  const userAllowance = linAllowance ?? 0n;

  // When the user hit MAX we trade the EXACT balance bigint (minus a small gas buffer on
  // the buy side), never the re-parsed display string. Parsing a rounded/scientific string
  // (e.g. "5.18e-8") produced an amount a hair over balance, so the swap failed with
  // "insufficient funds" until a digit was trimmed. amountStr stays a clean compact number
  // for display only; this bigint is the real trade size.
  const GAS_BUFFER = parseEther("0.0001");
  let amountWei = 0n;
  let valid = false;
  if (maxSelected) {
    amountWei = side === "buy" ? (userEth > GAS_BUFFER ? userEth - GAS_BUFFER : 0n) : userLin;
    valid = amountWei > 0n;
  } else {
    try {
      if (amountStr.trim()) {
        amountWei = parseEther(amountStr);
        valid = amountWei > 0n;
      }
    } catch {
      valid = false;
    }
  }

  // Estimate output amount from pool ratio + hook fee.
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
        if (out >= 0.0001) {
          estimatedOut = out.toFixed(6);
        } else {
          const expanded = out.toFixed(20);
          const frac = expanded.slice(expanded.indexOf(".") + 1);
          let firstNonZero = 0;
          while (firstNonZero < frac.length && frac[firstNonZero] === "0") firstNonZero++;
          const decimals = Math.max(2, firstNonZero + 3);
          estimatedOut = out.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
        }
      }
    }
  }

  const enoughForBuy = side === "buy" ? userEth >= amountWei + GAS_BUFFER : true;
  const enoughForSell = side === "sell" ? userLin >= amountWei : true;

  // Capture write errors and surface them in the modal.
  useEffect(() => {
    if (approveWrite.error) {
      setErrorMessage(extractErrorMessage(approveWrite.error));
      setStep("error");
    }
  }, [approveWrite.error]);
  useEffect(() => {
    if (swapWrite.error) {
      setErrorMessage(extractErrorMessage(swapWrite.error));
      setStep("error");
    }
  }, [swapWrite.error]);

  // Approve confirmed -> auto-fire the swap leg.
  useEffect(() => {
    if (step !== "approving") return;
    if (!approveReceipt.isSuccess) return;
    if (!tradeSnapshot || !address) return;
    refetchAllowance();
    setStep("awaiting-swap");
    swapWrite.writeContract({
      address: ADDR.swapper,
      abi: swapperAbi,
      functionName: "sellExactInput",
      args: [POOL_KEY, tradeSnapshot.amountWei, address],
    });
    setStep("swapping");
  }, [approveReceipt.isSuccess, step, tradeSnapshot, address, swapWrite, refetchAllowance]);

  // Swap confirmed -> success state and refresh balances.
  useEffect(() => {
    if (step !== "swapping") return;
    if (!swapReceipt.isSuccess) return;
    setStep("success");
    refetchEth();
    refetchLin();
    refetchAllowance();
  }, [swapReceipt.isSuccess, step, refetchEth, refetchLin, refetchAllowance]);

  function openBuy() {
    if (!address || !valid || !enoughForBuy) return;
    setErrorMessage(undefined);
    approveWrite.reset();
    swapWrite.reset();
    setTradeSnapshot({ side: "buy", amountWei, amountStr, estimatedOut });
    setStep("awaiting-swap");
    swapWrite.writeContract({
      address: ADDR.swapper,
      abi: swapperAbi,
      functionName: "buyExactInput",
      args: [POOL_KEY, address],
      value: amountWei,
    });
    setStep("swapping");
  }

  function openSell() {
    if (!address || !valid || !enoughForSell) return;
    setErrorMessage(undefined);
    approveWrite.reset();
    swapWrite.reset();
    setTradeSnapshot({ side: "sell", amountWei, amountStr, estimatedOut });
    if (userAllowance >= amountWei) {
      // Allowance sufficient, skip approve and go straight to swap popup.
      setStep("awaiting-swap");
      swapWrite.writeContract({
        address: ADDR.swapper,
        abi: swapperAbi,
        functionName: "sellExactInput",
        args: [POOL_KEY, amountWei, address],
      });
      setStep("swapping");
    } else {
      // Modal opens with an Approve button; user must click to fire popup.
      setStep("awaiting-approve");
    }
  }

  function fireApprove() {
    if (!tradeSnapshot) return;
    setErrorMessage(undefined);
    approveWrite.writeContract({
      address: ADDR.strategy,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDR.swapper, tradeSnapshot.amountWei],
    });
    setStep("approving");
  }

  function closeModal() {
    setStep("idle");
    setTradeSnapshot(null);
    setErrorMessage(undefined);
    approveWrite.reset();
    swapWrite.reset();
    if (step === "success") {
      // Reset input on a successful trade so the user doesn't accidentally
      // re-fire the same amount.
      setAmountStr("");
      setMaxSelected(false);
    }
  }

  // Selling/Buying assignments based on side
  const sellingLabel = side === "buy" ? "ETH" : "LINEADAT";
  const buyingLabel = side === "buy" ? "LINEADAT" : "ETH";
  const sellingBalance = side === "buy" ? userEth : userLin;
  const buyingBalance = side === "buy" ? userLin : userEth;

  function flip() {
    setSide(side === "buy" ? "sell" : "buy");
    setAmountStr("");
    setMaxSelected(false);
  }

  const modalOpen = step !== "idle";
  const modalSide = tradeSnapshot?.side ?? side;
  const modalFromAmount = tradeSnapshot?.amountStr ?? amountStr;
  const modalToAmount = tradeSnapshot?.estimatedOut ?? estimatedOut;
  const modalFromSymbol = modalSide === "buy" ? "ETH" : "LINEADAT";
  const modalToSymbol = modalSide === "buy" ? "LINEADAT" : "ETH";

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
              onChange={(e) => { setAmountStr(e.target.value); setMaxSelected(false); }}
              className="flex-1 min-w-0 w-0 bg-transparent text-xl sm:text-2xl font-mono tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (side === "buy" && userEth > GAS_BUFFER) {
                  setAmountStr(cleanAmount(Number(userEth - GAS_BUFFER) / 1e18));
                  setMaxSelected(true);
                } else if (side === "sell" && userLin > 0n) {
                  setAmountStr(cleanAmount(Number(userLin) / 1e18));
                  setMaxSelected(true);
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

        {/* Action button. While modal is open the trigger stays disabled. */}
        {!valid ? (
          <Button className="w-full" disabled size="lg">Enter an amount</Button>
        ) : side === "buy" ? (
          !enoughForBuy ? (
            <Button className="w-full" disabled size="lg">Insufficient ETH</Button>
          ) : (
            <Button className="w-full" onClick={openBuy} disabled={modalOpen} size="lg">
              {modalOpen ? "Swap in progress…" : `Buy LINEADAT with ${amountStr} ETH`}
            </Button>
          )
        ) : !enoughForSell ? (
          <Button className="w-full" disabled size="lg">Insufficient LINEADAT</Button>
        ) : (
          <Button className="w-full" onClick={openSell} disabled={modalOpen} size="lg">
            {modalOpen ? "Swap in progress…" : `Sell ${amountStr} LINEADAT`}
          </Button>
        )}
      </div>

      <div className="px-4 sm:px-5 py-3 border-t border-border flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground flex-shrink-0">Protocol fee</span>
        <span className="font-mono tabular font-semibold truncate text-right">
          {feePercent.toFixed(feePercent < 100 && feePercent !== Math.floor(feePercent) ? 2 : 0)}% on this swap
        </span>
      </div>

      <SwapProgressModal
        open={modalOpen}
        mode={modalSide}
        step={step}
        fromAmount={modalFromAmount}
        fromSymbol={modalFromSymbol}
        toAmount={modalToAmount}
        toSymbol={modalToSymbol}
        swapTxHash={swapWrite.data}
        errorMessage={errorMessage}
        onApproveClick={fireApprove}
        onClose={closeModal}
      />
    </>
  );
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // wagmi/viem errors usually have a `.shortMessage` we want to surface.
    const obj = err as Error & { shortMessage?: string };
    if (obj.shortMessage) return obj.shortMessage;
    return err.message;
  }
  return String(err);
}
