"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { hookAbi } from "@/lib/abis/swapper";
import { useSwaps } from "@/hooks/useIndexer";
import { ADDR, txUrl, addressUrl } from "@/lib/wagmi";
import { formatEth, formatTokens, shortAddress, formatTradeDate, getEventsChunked } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { PaginationFooter, usePagedSlice } from "./pagination-footer";

type SwapRow = {
  side: "buy" | "sell";
  ethAmount: bigint;
  tokenAmount: bigint;
  tx: string;
  block: bigint;
  ts: number;
  origin: string | null;
};

export function PaginatedSwapsTable() {
  const client = usePublicClient();
  const indexer = useSwaps(500);
  const [rows, setRows] = useState<SwapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (indexer.usable && indexer.data) {
      // Source 1 — Ponder indexer. Trader, side, amounts already normalized.
      const swaps: SwapRow[] = indexer.data.map((s) => ({
        side: s.side,
        ethAmount: BigInt(s.ethAmount),
        tokenAmount: BigInt(s.tokenAmount),
        tx: s.txHash,
        block: BigInt(s.blockNumber),
        ts: s.timestamp,
        origin: s.trader,
      }));
      setRows(swaps);
      setIsLoading(false);
      return;
    }
    if (indexer.loading) return;

    // Source 2 — on-chain getLogs fallback (50k-block window).
    if (!client || ADDR.hook === "0x0000000000000000000000000000000000000000") {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchSwaps() {
      try {
        const events = await getEventsChunked(client!, {
          address: ADDR.hook,
          abi: hookAbi,
          eventName: "Trade",
          args: { strategy: ADDR.strategy },
        });
        const sorted = [...events].sort((a, b) => Number(b.blockNumber - a.blockNumber));
        const enriched: SwapRow[] = await Promise.all(
          sorted.map(async (e) => {
            const eth = BigInt(e.args.ethAmount as bigint | number);
            const tok = BigInt(e.args.tokenAmount as bigint | number);
            let origin: string | null = null;
            let ts = 0;
            try {
              const [tx, block] = await Promise.all([
                client!.getTransaction({ hash: e.transactionHash }),
                client!.getBlock({ blockHash: e.blockHash }),
              ]);
              origin = tx.from ?? null;
              ts = Number(block.timestamp);
            } catch {
              /* ignore */
            }
            return {
              // v4 BalanceDelta is from swapper's perspective:
              //   amount0 (ETH) negative → swapper paid ETH → BUY LINEASTR
              //   amount0 (ETH) positive → swapper received ETH → SELL LINEASTR
              side: eth < 0n ? ("buy" as const) : ("sell" as const),
              ethAmount: eth < 0n ? -eth : eth,
              tokenAmount: tok < 0n ? -tok : tok,
              tx: e.transactionHash,
              block: e.blockNumber,
              ts,
              origin,
            };
          })
        );
        if (!cancelled) setRows(enriched);
      } catch (err) {
        console.error("PaginatedSwaps fetch failed:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchSwaps();
    const id = setInterval(fetchSwaps, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, indexer.usable, indexer.loading, indexer.data]);

  const visible = usePagedSlice(rows, page, pageSize);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4 sm:p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center px-4">No swaps yet.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-medium">Date</th>
              <th className="text-left py-3 px-4 font-medium">Side</th>
              <th className="text-right py-3 px-4 font-medium">ETH</th>
              <th className="text-right py-3 px-4 font-medium">LINEADAT</th>
              <th className="text-left py-3 px-4 font-medium">Trader</th>
              <th className="text-right py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => (
              <tr key={r.tx}>
                <td className="py-3 px-4 font-mono text-xs">{formatTradeDate(r.ts)}</td>
                <td className="py-3 px-4">
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
                <td className="py-3 px-4 text-right font-mono tabular">{formatEth(r.ethAmount)}</td>
                <td className="py-3 px-4 text-right font-mono tabular">{formatTokens(r.tokenAmount)}</td>
                <td className="py-3 px-4">
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
                <td className="py-3 px-4 text-right">
                  <a
                    href={txUrl(r.tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2 p-4">
        {visible.map((r) => (
          <li key={r.tx} className="border border-border rounded-md p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{formatTradeDate(r.ts)}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                  r.side === "buy"
                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                }`}
              >
                {r.side}
              </span>
            </div>
            <div className="text-sm font-mono tabular">
              {formatEth(r.ethAmount)} ETH {r.side === "buy" ? "→" : "←"} {formatTokens(r.tokenAmount)} LINEADAT
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {r.origin ? shortAddress(r.origin) : "—"}
            </div>
          </li>
        ))}
      </ul>

      <PaginationFooter
        page={page}
        pageSize={pageSize}
        totalRows={rows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}
