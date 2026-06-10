"use client";

import { useEffect, useState } from "react";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useBags } from "@/hooks/useIndexer";
import { txUrl, UNDERLYING_SYMBOL } from "@/lib/wagmi";
import { formatEth, formatTokens, formatTradeDate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { PaginationFooter, usePagedSlice } from "./pagination-footer";
import { SortHeader, useTableSort } from "./ui/sort-header";

export type SaleRow = {
  bagId: bigint;
  soldFor: bigint;        // SoldByProtocol price
  paidByBot: bigint;      // BoughtByProtocol purchasePrice for the same bagId
  block: bigint;
  ts: number;
  tx: string;
};

/**
 * Hook: live past-sale rows shared between SalesTable and the dashboard
 * summary line in the card title. Indexer-only (same-origin /api/indexer proxy);
 * the on-chain getLogs fallback is gone - see the note in lib/utils.ts.
 */
export function useSalesRows(): { rows: SaleRow[]; isLoading: boolean; unavailable: boolean } {
  const indexer = useBags();
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (indexer.usable && indexer.data) {
      const sold = indexer.data
        .filter((b) => b.soldAt !== null && b.soldFor !== null && b.soldTxHash !== null)
        .map((b) => ({
          bagId: BigInt(b.bagId),
          soldFor: BigInt(b.soldFor as string),
          paidByBot: BigInt(b.paid),
          block: BigInt(b.blockNumber),
          ts: b.soldAt as number,
          tx: b.soldTxHash as `0x${string}`,
        }));
      setRows(sold);
      setIsLoading(false);
      return;
    }
    if (!indexer.loading) setIsLoading(false);
  }, [indexer.usable, indexer.loading, indexer.data]);

  return { rows, isLoading, unavailable: !indexer.loading && !indexer.usable };
}

/**
 * Aggregate past-sale totals: count, total underlying tokens sold (count*bagSize),
 * total sold-for (ETH), total bot-paid (ETH), and net profit (sold - paid).
 */
export function useSalesTotals(): {
  count: number;
  totalTokens: bigint;
  totalSold: bigint;
  totalPaid: bigint;
  profit: bigint;
} {
  const { data: stats } = useStrategyStats();
  const { rows } = useSalesRows();
  const bagSize = stats?.bagSize ?? 0n;
  const totalSold = rows.reduce((acc, r) => acc + r.soldFor, 0n);
  const totalPaid = rows.reduce((acc, r) => acc + r.paidByBot, 0n);
  return {
    count: rows.length,
    totalTokens: bagSize * BigInt(rows.length),
    totalSold,
    totalPaid,
    profit: totalSold - totalPaid,
  };
}

/**
 * Sales table - past bag sales (SoldByProtocol joined with BoughtByProtocol for the same bagId
 * to compute profit). Columns: Date | tLINEA | Paid | Sold For | Profit.
 */
export function SalesTable() {
  const { data: stats } = useStrategyStats();
  const { rows, isLoading, unavailable } = useSalesRows();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const bagSize = stats?.bagSize ?? 0n;

  const cmpBigint = (x: bigint, y: bigint) => (x < y ? -1 : x > y ? 1 : 0);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(rows, "date", {
    date: (a, b) => a.ts - b.ts,
    paid: (a, b) => cmpBigint(a.paidByBot, b.paidByBot),
    sold: (a, b) => cmpBigint(a.soldFor, b.soldFor),
    profit: (a, b) => cmpBigint(a.soldFor - a.paidByBot, b.soldFor - b.paidByBot),
  });

  const visible = usePagedSlice(sorted, page, pageSize);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4 sm:p-6">
        {[...Array(3)].map((_, i) => (
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
          : "No bags sold yet. Bags appear here once buyers redeem listed bags."}
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <SortHeader field="date" active={sortKey} dir={sortDir} onClick={toggle}>Date (UTC)</SortHeader>
              <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">{UNDERLYING_SYMBOL}</th>
              <SortHeader field="paid" active={sortKey} dir={sortDir} onClick={toggle}>Paid</SortHeader>
              <SortHeader field="sold" active={sortKey} dir={sortDir} onClick={toggle}>Sold For</SortHeader>
              <SortHeader field="profit" active={sortKey} dir={sortDir} onClick={toggle}>Profit</SortHeader>
              <th className="text-right py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => {
              const profit = r.soldFor - r.paidByBot;
              const profitPositive = profit >= 0n;
              return (
                <tr key={`${String(r.bagId)}-${r.tx}`}>
                  <td className="py-3 px-4 font-mono text-xs">{formatTradeDate(r.ts)}</td>
                  <td className="py-3 px-4 font-mono tabular">{formatTokens(bagSize)}</td>
                  <td className="py-3 px-4 font-mono tabular">{formatEth(r.paidByBot)} ETH</td>
                  <td className="py-3 px-4 font-mono tabular">{formatEth(r.soldFor)} ETH</td>
                  <td
                    className={`py-3 px-4 font-mono tabular font-semibold ${
                      profitPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {profitPositive ? "+" : ""}
                    {formatEth(profit < 0n ? -profit : profit)} ETH
                  </td>
                  <td className="py-3 px-4 text-right">
                    <a
                      href={txUrl(r.tx)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2 p-4">
        {visible.map((r) => {
          const profit = r.soldFor - r.paidByBot;
          const profitPositive = profit >= 0n;
          return (
            <li key={`${String(r.bagId)}-${r.tx}`} className="border border-border rounded-md p-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span>{formatTradeDate(r.ts)}</span>
                <span>Bag #{String(r.bagId)}</span>
              </div>
              <div className="text-sm font-mono tabular">
                Paid {formatEth(r.paidByBot)} → sold {formatEth(r.soldFor)} ETH
              </div>
              <div
                className={`text-sm font-mono tabular font-semibold ${
                  profitPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {profitPositive ? "+" : ""}
                {formatEth(profit < 0n ? -profit : profit)} ETH profit
              </div>
            </li>
          );
        })}
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
