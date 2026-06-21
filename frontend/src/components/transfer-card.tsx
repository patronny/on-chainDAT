"use client";

import { useEffect, useState } from "react";
import { parseEther, isAddress, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "./ui/button";
import { erc20Abi } from "@/lib/abis/erc20";
import { relayAbi } from "@/lib/abis/relay";
import { ADDR, txUrl } from "@/lib/wagmi";
import { formatTokens } from "@/lib/utils";
import { LdatIcon } from "./icons/token-icons";

/** Compact, human-friendly amount for the MAX-filled input (display only). */
function cleanAmount(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "";
  if (v >= 1000) return Math.floor(v).toString();
  if (v >= 1) return v.toFixed(4).replace(/\.?0+$/, "");
  const exp = Math.floor(Math.log10(v));
  const decimals = Math.min(18, -exp + 3);
  return v.toFixed(decimals).replace(/\.?0+$/, "");
}

function extractError(err: unknown): string {
  if (err instanceof Error) {
    const obj = err as Error & { shortMessage?: string };
    return obj.shortMessage || err.message;
  }
  return String(err);
}

/**
 * Wallet-to-wallet $LDAT transfer card. $LDAT is non-transferable; moves go through the
 * whitelisted relay (ADDR.relay), which two-hops user -> relay -> recipient and burns a
 * mandatory 1% fee to the dead address. Flow: approve(relay, amount) (exact amount), then
 * relay.send(to, amount). The recipient receives 99%; 1% is burned.
 */
export function TransferCard() {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [recipient, setRecipient] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [maxSelected, setMaxSelected] = useState(false);

  const approveWrite = useWriteContract();
  const sendWrite = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveWrite.data });
  const sendReceipt = useWaitForTransactionReceipt({ hash: sendWrite.data });

  const { data: balRaw, refetch: refetchBal } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: allowRaw, refetch: refetchAllow } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.relay] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  const bal = balRaw ?? 0n;
  const allowance = allowRaw ?? 0n;

  // Amount: MAX uses the exact balance bigint; otherwise parse the input.
  let amountWei = 0n;
  let amountValid = false;
  if (maxSelected) {
    amountWei = bal;
    amountValid = bal > 0n;
  } else if (amountStr.trim()) {
    try {
      amountWei = parseEther(amountStr);
      amountValid = amountWei > 0n;
    } catch {
      amountValid = false;
    }
  }

  const hasBalance = amountWei <= bal;
  const fee = amountWei / 100n; // 1%
  const recipientGets = amountWei - fee;

  const recipientTrim = recipient.trim();
  const recipientValid =
    isAddress(recipientTrim) &&
    recipientTrim.toLowerCase() !== zeroAddress &&
    recipientTrim.toLowerCase() !== ADDR.relay.toLowerCase();
  const recipientIsSelf =
    recipientValid && !!address && recipientTrim.toLowerCase() === address.toLowerCase();

  const needsApproval = allowance < amountWei;
  const txBusy =
    approveWrite.isPending ||
    approveReceipt.isLoading ||
    sendWrite.isPending ||
    sendReceipt.isLoading;

  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveReceipt.isSuccess]);

  useEffect(() => {
    if (sendReceipt.isSuccess) {
      refetchBal();
      refetchAllow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendReceipt.isSuccess]);

  const ready = !!address && recipientValid && amountValid && hasBalance && !txBusy;
  const errorMsg = approveWrite.error
    ? extractError(approveWrite.error)
    : sendWrite.error
      ? extractError(sendWrite.error)
      : undefined;

  function doApprove() {
    if (!ready) return;
    approveWrite.reset();
    approveWrite.writeContract({
      address: ADDR.strategy,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDR.relay, amountWei],
    });
  }

  function doSend() {
    if (!ready) return;
    sendWrite.reset();
    sendWrite.writeContract({
      address: ADDR.relay,
      abi: relayAbi,
      functionName: "send",
      args: [recipientTrim as `0x${string}`, amountWei],
    });
  }

  function resetForm() {
    setAmountStr("");
    setRecipient("");
    setMaxSelected(false);
    approveWrite.reset();
    sendWrite.reset();
  }

  // Success panel.
  if (sendReceipt.isSuccess) {
    return (
      <div className="p-5 sm:p-6 space-y-4 text-center">
        <div className="text-2xl font-display font-bold text-primary" style={{ textShadow: "0 0 14px hsl(var(--primary) / 0.45)" }}>
          Transfer complete
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed">
          Sent <span className="font-mono text-foreground">{formatTokens(recipientGets, 4)}</span> LDAT to the recipient.
          <br />
          <span className="font-mono text-foreground">{formatTokens(fee, 4)}</span> LDAT (1%) burned.
        </div>
        {sendWrite.data && (
          <a href={txUrl(sendWrite.data)} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-primary underline underline-offset-4">
            View transaction
          </a>
        )}
        <Button className="w-full" size="lg" onClick={resetForm}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-3">
      {/* Recipient */}
      <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
        <div className="text-xs text-muted-foreground">Recipient address</div>
        <input
          type="text"
          inputMode="text"
          placeholder="0x..."
          autoComplete="off"
          spellCheck={false}
          aria-label="Recipient address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="w-full bg-transparent text-sm sm:text-base font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm break-all"
        />
        {recipientTrim && !recipientValid && (
          <div className="text-xs text-destructive">Enter a valid address (not the relay or zero address).</div>
        )}
        {recipientIsSelf && (
          <div className="text-xs text-yellow-500">This is your own address - you would still pay the 1% fee.</div>
        )}
      </div>

      {/* Amount */}
      <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex-shrink-0">Amount</span>
          <span className="font-mono truncate text-right">Balance: {formatTokens(bal)}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            autoComplete="off"
            spellCheck={false}
            aria-label="Amount of LDAT to send"
            value={amountStr}
            onChange={(e) => {
              setAmountStr(e.target.value);
              setMaxSelected(false);
            }}
            className="flex-1 min-w-0 w-0 bg-transparent text-xl sm:text-2xl font-mono tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (bal > 0n) {
                setAmountStr(cleanAmount(Number(bal) / 1e18));
                setMaxSelected(true);
              }
            }}
            className="flex-shrink-0 px-2 py-1 text-xs font-bold uppercase tracking-wider rounded bg-secondary text-secondary-foreground hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Set max LDAT balance"
          >
            Max
          </button>
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 font-semibold text-sm font-mono">
            <LdatIcon className="w-5 h-5" />
            LDAT
          </span>
        </div>
      </div>

      {/* Breakdown */}
      {amountValid && hasBalance && (
        <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Recipient receives</span>
            <span className="font-mono tabular text-foreground">{formatTokens(recipientGets, 4)} LDAT</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Burned (1% fee)</span>
            <span className="font-mono tabular text-primary">{formatTokens(fee, 4)} LDAT</span>
          </div>
        </div>
      )}

      {/* Action button */}
      {!address ? (
        <Button className="w-full" size="lg" onClick={openConnectModal}>
          Connect your wallet
        </Button>
      ) : !recipientValid ? (
        <Button className="w-full" size="lg" disabled>
          Enter a valid recipient
        </Button>
      ) : !amountValid ? (
        <Button className="w-full" size="lg" disabled>
          Enter an amount
        </Button>
      ) : !hasBalance ? (
        <Button className="w-full" size="lg" disabled>
          Insufficient LDAT
        </Button>
      ) : needsApproval ? (
        <Button className="w-full" size="lg" onClick={doApprove} disabled={txBusy}>
          {approveWrite.isPending
            ? "Confirm in wallet…"
            : approveReceipt.isLoading
              ? "Approving…"
              : `Approve ${amountStr || formatTokens(amountWei, 4)} LDAT`}
        </Button>
      ) : (
        <Button className="w-full" size="lg" onClick={doSend} disabled={txBusy}>
          {sendWrite.isPending
            ? "Confirm in wallet…"
            : sendReceipt.isLoading
              ? "Sending…"
              : "Send"}
        </Button>
      )}

      {errorMsg && <div className="text-xs text-destructive break-words">{errorMsg}</div>}

      <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
        $LDAT is non-transferable except through this official relay. A mandatory 1% fee is burned on every
        transfer; the recipient receives 99%. You approve exactly the amount you send.
      </p>
    </div>
  );
}
