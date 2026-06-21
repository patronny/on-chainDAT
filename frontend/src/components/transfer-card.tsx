"use client";

import { useEffect, useRef, useState } from "react";
import { parseEther, isAddress, zeroAddress } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "./ui/button";
import { erc20Abi } from "@/lib/abis/erc20";
import { relayAbi } from "@/lib/abis/relay";
import { ADDR, txUrl } from "@/lib/wagmi";
import { formatTokens } from "@/lib/utils";
import { LdatIcon } from "./icons/token-icons";

/**
 * Transferable DATs and their relays. Each token moves only through its own
 * whitelisted relay (the relay is bound to one token). Add a future DAT by
 * appending one entry here - the card and the selector are fully data-driven.
 */
type TransferToken = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  relay: `0x${string}`;
  Icon: typeof LdatIcon;
};

const TOKENS: TransferToken[] = [
  { symbol: "LDAT", name: "on-chainDAT", address: ADDR.strategy, relay: ADDR.relay, Icon: LdatIcon },
];

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
 * Wallet-to-wallet DAT transfer card. DAT tokens are non-transferable; moves go
 * through a whitelisted relay (per token), which two-hops user -> relay -> recipient
 * and burns a mandatory 1% fee to the dead address. Flow: pick a token, approve its
 * relay for the exact amount, then relay.send(to, amount). Recipient receives 99%.
 */
export function TransferCard() {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [token, setToken] = useState<TransferToken>(TOKENS[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  const [recipient, setRecipient] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [maxSelected, setMaxSelected] = useState(false);

  const approveWrite = useWriteContract();
  const sendWrite = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveWrite.data });
  const sendReceipt = useWaitForTransactionReceipt({ hash: sendWrite.data });

  const { data: balRaw, refetch: refetchBal } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: allowRaw, refetch: refetchAllow } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, token.relay] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });

  const bal = balRaw ?? 0n;
  const allowance = allowRaw ?? 0n;

  // Close the token picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

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
    recipientTrim.toLowerCase() !== token.relay.toLowerCase();
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

  function selectToken(t: TransferToken) {
    setToken(t);
    setPickerOpen(false);
    setSearch("");
    // Reset amount/allowance-derived state when switching tokens.
    setAmountStr("");
    setMaxSelected(false);
    approveWrite.reset();
    sendWrite.reset();
  }

  function doApprove() {
    if (!ready) return;
    approveWrite.reset();
    approveWrite.writeContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [token.relay, amountWei],
    });
  }

  function doSend() {
    if (!ready) return;
    sendWrite.reset();
    sendWrite.writeContract({
      address: token.relay,
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

  const q = search.trim().toLowerCase();
  const filteredTokens = q
    ? TOKENS.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q),
      )
    : TOKENS;

  // Success panel.
  if (sendReceipt.isSuccess) {
    return (
      <div className="p-5 sm:p-6 space-y-4 text-center">
        <div className="text-2xl font-display font-bold text-primary" style={{ textShadow: "0 0 14px hsl(var(--primary) / 0.45)" }}>
          Transfer complete
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed">
          Sent <span className="font-mono text-foreground">{formatTokens(recipientGets, 4)}</span> {token.symbol} to the recipient.
          <br />
          <span className="font-mono text-foreground">{formatTokens(fee, 4)}</span> {token.symbol} (1%) burned.
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
      {/* Token selector */}
      <div className="relative" ref={pickerRef}>
        <div className="text-xs text-muted-foreground mb-1">Token</div>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 p-3 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex items-center gap-2 min-w-0">
            <token.Icon className="w-6 h-6 flex-shrink-0" />
            <span className="font-semibold font-mono">{token.symbol}</span>
            <span className="text-muted-foreground text-sm truncate">{token.name}</span>
          </span>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
        </button>

        {pickerOpen && (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-card shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 rounded bg-secondary/40 px-2">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search name or paste address"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search tokens"
                  className="w-full bg-transparent py-2 text-sm font-mono focus:outline-none"
                />
              </div>
            </div>
            <ul role="listbox" className="max-h-60 overflow-auto">
              {filteredTokens.map((t) => (
                <li key={t.address}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={t.address === token.address}
                    onClick={() => selectToken(t)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/50 ${
                      t.address === token.address ? "bg-secondary/30" : ""
                    }`}
                  >
                    <t.Icon className="w-6 h-6 flex-shrink-0" />
                    <span className="font-semibold font-mono">{t.symbol}</span>
                    <span className="text-muted-foreground text-sm truncate">{t.name}</span>
                  </button>
                </li>
              ))}
              {filteredTokens.length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground text-center">No tokens found</li>
              )}
            </ul>
          </div>
        )}
      </div>

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
            aria-label={`Amount of ${token.symbol} to send`}
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
            aria-label={`Set max ${token.symbol} balance`}
          >
            Max
          </button>
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 font-semibold text-sm font-mono">
            <token.Icon className="w-5 h-5" />
            {token.symbol}
          </span>
        </div>
      </div>

      {/* Breakdown */}
      {amountValid && hasBalance && (
        <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Recipient receives</span>
            <span className="font-mono tabular text-foreground">{formatTokens(recipientGets, 4)} {token.symbol}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Burned (1% fee)</span>
            <span className="font-mono tabular text-primary">{formatTokens(fee, 4)} {token.symbol}</span>
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
          Insufficient {token.symbol}
        </Button>
      ) : needsApproval ? (
        <Button className="w-full" size="lg" onClick={doApprove} disabled={txBusy}>
          {approveWrite.isPending
            ? "Confirm in wallet…"
            : approveReceipt.isLoading
              ? "Approving…"
              : `Approve ${amountStr || formatTokens(amountWei, 4)} ${token.symbol}`}
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
        DAT tokens are non-transferable except through this official relay. A mandatory 1% fee is burned on
        every transfer; the recipient receives 99%. You approve exactly the amount you send.
      </p>
    </div>
  );
}
