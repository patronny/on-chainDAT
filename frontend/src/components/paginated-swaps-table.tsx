"use client";

import { useEffect, useState } from "react";
import { useSwaps } from "@/hooks/useIndexer";
import { txUrl, addressUrl } from "@/lib/wagmi";
import { formatEth, formatTokens, shortAddress, formatTradeDate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { PaginationFooter, usePagedSlice } from "./pagination-footer";
import { SortHeader, useTableSort } from "./ui/sort-header";

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
  const indexer = useSwaps(500);
  const [rows, setRows] = useState<SwapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  // Indexer-only (same-origin /api/indexer proxy); the on-chain getLogs
  // fallback is gone - see the note in lib/utils.ts. Last good rows stay on
  // screen while the probe retries.
  useEffect(() => {
    if (indexer.usable && indexer.data) {
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
    if (!indexer.loading) setIsLoading(false);
  }, [indexer.usable, indexer.loading, indexer.data]);

  const unavailable = !indexer.loading && !indexer.usable;

  const cmpBigint = (x: bigint, y: bigint) => (x < y ? -1 : x > y ? 1 : 0);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(rows, "date", {
    date: (a, b) => a.ts - b.ts,
    side: (a, b) => (a.side === b.side ? 0 : a.side === "buy" ? -1 : 1),
    eth: (a, b) => cmpBigint(a.ethAmount, b.ethAmount),
    token: (a, b) => cmpBigint(a.tokenAmount, b.tokenAmount),
    trader: (a, b) => (a.origin ?? "").localeCompare(b.origin ?? ""),
  });

  const visible = usePagedSlice(sorted, page, pageSize);

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
    return (
      <p className="text-sm text-muted-foreground py-8 text-center px-4">
        {unavailable
          ? "Live data is temporarily unavailable - retrying. The protocol keeps running on-chain."
          : "No swaps yet."}
      </p>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <SortHeader field="date" active={sortKey} dir={sortDir} onClick={toggle}>Date (UTC)</SortHeader>
              <SortHeader field="side" active={sortKey} dir={sortDir} onClick={toggle}>Side</SortHeader>
              <SortHeader field="eth" active={sortKey} dir={sortDir} onClick={toggle} align="right">ETH</SortHeader>
              <SortHeader field="token" active={sortKey} dir={sortDir} onClick={toggle} align="right">LINEADAT</SortHeader>
              <SortHeader field="trader" active={sortKey} dir={sortDir} onClick={toggle}>Trader</SortHeader>
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
                    <span className="text-muted-foreground">-</span>
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
              {r.origin ? shortAddress(r.origin) : "-"}
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
