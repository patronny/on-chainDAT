"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { hookAbi } from "@/lib/abis/swapper";
import { ADDR, txUrl, addressUrl } from "@/lib/wagmi";
import { formatEth, formatTokens, shortAddress } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

type SwapRow = {
  side: "buy" | "sell";
  ethAmount: bigint;
  tokenAmount: bigint;
  tx: string;
  block: bigint;
  origin: string | null;
};

/**
 * Last 10 LINEASTR/ETH swaps from the hook's Trade event stream.
 * Sign convention: ethAmount > 0 means ETH flowed INTO pool (= user bought LINEASTR).
 */
export function SwapHistoryTable() {
  const client = usePublicClient();
  const [rows, setRows] = useState<SwapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (
      !client ||
      ADDR.strategy === "0x0000000000000000000000000000000000000000" ||
      ADDR.hook === "0x0000000000000000000000000000000000000000"
    ) {
      setIsLoading(false);
      return;
    }

    async function fetchSwaps() {
      try {
        const latest = await client!.getBlockNumber();
        // drpc.org free tier limits getLogs to 10k blocks. 5k = ~3h on Base Sepolia
        // (2s block time), enough to cover the rolling testnet activity window.
        const fromBlock = latest > 5_000n ? latest - 5_000n : 0n;

        const events = await client!.getContractEvents({
          address: ADDR.hook,
          abi: hookAbi,
          eventName: "Trade",
          args: { strategy: ADDR.strategy },
          fromBlock,
          toBlock: latest,
        });

        const sorted = [...events].sort((a, b) => Number(b.blockNumber - a.blockNumber)).slice(0, 10);

        const enriched: SwapRow[] = await Promise.all(
          sorted.map(async (e) => {
            const ethAmount = BigInt(e.args.ethAmount as bigint | number);
            const tokenAmount = BigInt(e.args.tokenAmount as bigint | number);
            // Try to get tx origin (the user) — falls back to null
            let origin: string | null = null;
            try {
              const tx = await client!.getTransaction({ hash: e.transactionHash });
              origin = tx.from ?? null;
            } catch {
              origin = null;
            }
            return {
              side: ethAmount > 0n ? "buy" : "sell",
              ethAmount: ethAmount < 0n ? -ethAmount : ethAmount,
              tokenAmount: tokenAmount < 0n ? -tokenAmount : tokenAmount,
              tx: e.transactionHash,
              block: e.blockNumber,
              origin,
            };
          })
        );
        setRows(enriched);
      } catch (err) {
        console.error("SwapHistory fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSwaps();
    const interval = setInterval(fetchSwaps, 30_000);
    return () => clearInterval(interval);
  }, [client]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No swaps yet.</p>;
  }

  return (
    <>
      {/* Desktop / tablet: full table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <tr>
              <th className="text-left py-2 pr-3 font-medium">Side</th>
              <th className="text-right py-2 px-3 font-medium">ETH</th>
              <th className="text-right py-2 px-3 font-medium">LINEASTR</th>
              <th className="text-left py-2 px-3 font-medium">Trader</th>
              <th className="text-left py-2 pl-3 font-medium">Block</th>
              <th className="text-right py-2 pl-3 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.tx}>
                <td className="py-3 pr-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      r.side === "buy"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : "bg-red-500/15 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {r.side}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-mono tabular">{formatEth(r.ethAmount)}</td>
                <td className="py-3 px-3 text-right font-mono tabular">{formatTokens(r.tokenAmount)}</td>
                <td className="py-3 px-3">
                  {r.origin ? (
                    <a
                      href={addressUrl(r.origin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs hover:text-foreground text-muted-foreground"
                    >
                      {shortAddress(r.origin)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 pl-3 font-mono text-xs text-muted-foreground">#{String(r.block)}</td>
                <td className="py-3 pl-3 text-right">
                  <a
                    href={txUrl(r.tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="text-xs">view</span>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="sm:hidden space-y-2">
        {rows.map((r) => (
          <li key={r.tx} className="border border-border rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  r.side === "buy"
                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                }`}
              >
                {r.side}
              </span>
              <a
                href={txUrl(r.tx)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <ExternalLink className="w-3 h-3" />
                tx
              </a>
            </div>
            <div className="text-sm font-mono tabular">
              {formatEth(r.ethAmount)} ETH {r.side === "buy" ? "→" : "←"} {formatTokens(r.tokenAmount)} LINEASTR
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {r.origin ? shortAddress(r.origin) : "—"} • block #{String(r.block)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
