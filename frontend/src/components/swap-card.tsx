"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  encodeV4Swap,
  universalRouterAbi,
  permit2Abi,
  v4QuoterAbi,
  applySlippage,
  swapDeadline,
  MAX_UINT256,
  MAX_UINT160,
  MAX_UINT48,
} from "@/lib/v4-swap";
import { ADDR, UNIVERSAL_ROUTER, PERMIT2, V4_QUOTER, POOL_KEY } from "@/lib/wagmi";
import { formatEth, formatTokens, sqrtPriceX96ToRatio } from "@/lib/utils";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { ArrowDown } from "lucide-react";
import { EthIcon, LdatIcon } from "./icons/token-icons";
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
  const Icon = symbol === "ETH" ? EthIcon : LdatIcon;
  return (
    <span className="flex-shrink-0 inline-flex items-center gap-1.5 font-semibold text-sm font-mono">
      <Icon className="w-5 h-5" />
      {symbol}
    </span>
  );
}

type ApprovalKind = "token" | "permit2";

/**
 * Standalone Swap card. Trades go through the standard Uniswap Universal Router (V4_SWAP), NOT a
 * custom swapper - matching wBTCSTR. $LDAT is non-transferable, but the swap works because the
 * hook grants a transient transfer allowance in afterSwap (no distributor whitelist needed).
 *
 * - Buy (ETH -> LDAT): single `execute{value}` call, no approval.
 * - Sell (LDAT -> ETH): Permit2 - one-time `token.approve(Permit2)` + `Permit2.approve(router)`
 *   (max amount / max expiry, so later sells are a single tx), then `execute`.
 *
 * Execution lives in a LlamaSwap-style progress modal (Approve -> Swap with auto-advance). The
 * card's button only opens the modal; all wallet popups are gated by modal state, eliminating the
 * double-click double-spend trap.
 */
export function SwapCard() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountStr, setAmountStr] = useState("");
  // True while amountStr came from the MAX button (and hasn't been hand-edited). When
  // set, the trade size is the exact balance bigint, not the re-parsed display string.
  const [maxSelected, setMaxSelected] = useState(false);
  const { address } = useAccount();

  // Two independent write hooks: approveWrite is reused for the (up to two) Permit2 approvals,
  // swapWrite for the Universal Router execute.
  const approveWrite = useWriteContract();
  const swapWrite = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveWrite.data });
  const swapReceipt = useWaitForTransactionReceipt({ hash: swapWrite.data });

  const [step, setStep] = useState<SwapStep>("idle");
  const [showApproveStep, setShowApproveStep] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  // Snapshot of the trade params at modal-open time so live input edits can't change mid-flight.
  const [tradeSnapshot, setTradeSnapshot] = useState<{
    side: "buy" | "sell";
    amountWei: bigint;
    amountStr: string;
    estimatedOut: string;
  } | null>(null);

  // Refs drive the effect-based sequencing so stale closures can't fire the wrong step.
  const approvalQueueRef = useRef<ApprovalKind[]>([]);
  const tradeRef = useRef<{ side: "buy" | "sell"; amountWei: bigint; minOut: bigint } | null>(null);

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: linBal, refetch: refetchLin } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  // ERC20 allowance of the token to Permit2 (first leg of the sell approval).
  const { data: tokenToPermit2, refetch: refetchTokenAllow } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, PERMIT2] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  // Permit2 allowance granted to the Universal Router (second leg). Returns (amount, expiration, nonce).
  const { data: permit2ToRouter, refetch: refetchPermit2Allow } = useReadContract({
    address: PERMIT2,
    abi: permit2Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.strategy, UNIVERSAL_ROUTER] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: stats } = useStrategyStats();
  // Current decaying protocol fee, from the shared snapshot. Fall back to launch defaults.
  const feeRaw = stats ? (side === "buy" ? stats.feeBuy : stats.feeSell) : 0n;
  const feeBps = feeRaw > 0n ? feeRaw : side === "buy" ? 9900n : 1000n;
  const feePercent = Number(feeBps) / 100;
  const poolRatio = stats?.sqrtPriceX96 ? sqrtPriceX96ToRatio(stats.sqrtPriceX96) : 0;

  const userEth = ethBalance?.value ?? 0n;
  const userLin = linBal ?? 0n;
  const tokenAllowance = tokenToPermit2 ?? 0n;
  const permit2Amount = permit2ToRouter ? (permit2ToRouter[0] as bigint) : 0n;
  const permit2Expiration = permit2ToRouter ? BigInt(permit2ToRouter[1] as number | bigint) : 0n;

  // When the user hit MAX we trade the EXACT balance bigint (minus a small gas buffer on
  // the buy side), never the re-parsed display string.
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

  // Estimate output amount from pool ratio + hook fee (display only; the on-chain slippage floor
  // amountOutMinimum comes from the v4 Quoter below, not from this approximation).
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

  // Accurate output quote from the v4 Quoter (reflects the live pool + hook fee). Drives the
  // on-chain slippage floor; before the launch gate opens the quote reverts (the swap card is
  // hidden until then), and any failure falls back to no floor (minOut = 0).
  const { data: quoteData } = useReadContract({
    address: V4_QUOTER,
    abi: v4QuoterAbi,
    functionName: "quoteExactInputSingle",
    args: valid
      ? [
          {
            poolKey: POOL_KEY,
            zeroForOne: side === "buy",
            exactAmount: amountWei,
            hookData: "0x" as const,
          },
        ]
      : undefined,
    query: { enabled: valid && amountWei > 0n, refetchInterval: 30_000 },
  });
  const quotedOut = quoteData ? (quoteData[0] as bigint) : 0n;
  const minOut = quotedOut > 0n ? applySlippage(quotedOut) : 0n;

  // --- execution helpers ---

  function fireSwap(swapSide: "buy" | "sell", amount: bigint, amountOutMinimum: bigint) {
    const { commands, inputs } = encodeV4Swap(swapSide === "buy", amount, amountOutMinimum);
    setStep("awaiting-swap");
    swapWrite.writeContract({
      address: UNIVERSAL_ROUTER,
      abi: universalRouterAbi,
      functionName: "execute",
      args: [commands, [...inputs], swapDeadline()],
      value: swapSide === "buy" ? amount : 0n,
    });
    setStep("swapping");
  }

  function fireApproval(kind: ApprovalKind) {
    approveWrite.reset();
    if (kind === "token") {
      // ERC20 approve the token to Permit2 (max - one-time).
      approveWrite.writeContract({
        address: ADDR.strategy,
        abi: erc20Abi,
        functionName: "approve",
        args: [PERMIT2, MAX_UINT256],
      });
    } else {
      // Permit2 allowance for the Universal Router (max amount, max expiry).
      approveWrite.writeContract({
        address: PERMIT2,
        abi: permit2Abi,
        functionName: "approve",
        args: [ADDR.strategy, UNIVERSAL_ROUTER, MAX_UINT160, MAX_UINT48],
      });
    }
    setStep("approving");
  }

  // Drive the sell sequence: run the next queued approval, or fire the swap when the queue drains.
  function runQueueOrSwap() {
    const q = approvalQueueRef.current;
    if (q.length > 0) {
      fireApproval(q.shift()!);
    } else if (tradeRef.current) {
      fireSwap(tradeRef.current.side, tradeRef.current.amountWei, tradeRef.current.minOut);
    }
  }

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

  // An approval confirmed -> advance the queue (next approval) or fire the swap.
  useEffect(() => {
    if (step !== "approving" || !approveReceipt.isSuccess) return;
    refetchTokenAllow();
    refetchPermit2Allow();
    runQueueOrSwap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveReceipt.isSuccess, step]);

  // Swap confirmed -> success state and refresh balances/allowances.
  useEffect(() => {
    if (step !== "swapping" || !swapReceipt.isSuccess) return;
    setStep("success");
    refetchEth();
    refetchLin();
    refetchTokenAllow();
    refetchPermit2Allow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapReceipt.isSuccess, step]);

  function openBuy() {
    if (!address || !valid || !enoughForBuy) return;
    setErrorMessage(undefined);
    approveWrite.reset();
    swapWrite.reset();
    setTradeSnapshot({ side: "buy", amountWei, amountStr, estimatedOut });
    tradeRef.current = { side: "buy", amountWei, minOut };
    approvalQueueRef.current = [];
    setShowApproveStep(false);
    fireSwap("buy", amountWei, minOut);
  }

  function openSell() {
    if (!address || !valid || !enoughForSell) return;
    setErrorMessage(undefined);
    approveWrite.reset();
    swapWrite.reset();
    setTradeSnapshot({ side: "sell", amountWei, amountStr, estimatedOut });
    tradeRef.current = { side: "sell", amountWei, minOut };

    const queue: ApprovalKind[] = [];
    if (tokenAllowance < amountWei) queue.push("token");
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (permit2Amount < amountWei || permit2Expiration <= nowSec) queue.push("permit2");
    approvalQueueRef.current = queue;

    if (queue.length === 0) {
      setShowApproveStep(false);
      fireSwap("sell", amountWei, minOut);
    } else {
      setShowApproveStep(true);
      setStep("awaiting-approve");
    }
  }

  // Modal "Approve" button -> kick off the approval queue.
  function fireApprove() {
    if (!tradeRef.current) return;
    setErrorMessage(undefined);
    runQueueOrSwap();
  }

  function closeModal() {
    setStep("idle");
    setTradeSnapshot(null);
    setErrorMessage(undefined);
    approvalQueueRef.current = [];
    tradeRef.current = null;
    approveWrite.reset();
    swapWrite.reset();
    if (step === "success") {
      // Reset input on a successful trade so the user doesn't re-fire the same amount.
      setAmountStr("");
      setMaxSelected(false);
    }
  }

  // Selling/Buying assignments based on side
  const sellingLabel = side === "buy" ? "ETH" : "LDAT";
  const buyingLabel = side === "buy" ? "LDAT" : "ETH";
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
  const modalFromSymbol = modalSide === "buy" ? "ETH" : "LDAT";
  const modalToSymbol = modalSide === "buy" ? "LDAT" : "ETH";

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
              {modalOpen ? "Swap in progress…" : `Buy LDAT with ${amountStr} ETH`}
            </Button>
          )
        ) : !enoughForSell ? (
          <Button className="w-full" disabled size="lg">Insufficient LDAT</Button>
        ) : (
          <Button className="w-full" onClick={openSell} disabled={modalOpen} size="lg">
            {modalOpen ? "Swap in progress…" : `Sell ${amountStr} LDAT`}
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
        showApprove={showApproveStep}
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
