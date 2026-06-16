"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "@/lib/abis/erc20";
import { ADDR } from "@/lib/wagmi";
import { ldatPriceInEth, formatTokens } from "@/lib/utils";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useEthPrice } from "@/hooks/useEthPrice";
import { usePriceChange24h } from "@/hooks/usePriceChange24h";
import { useAvgCostBasis } from "@/hooks/useAvgCostBasis";
import { LdatIcon } from "./icons/token-icons";
import { SignedDelta } from "./signed-delta";
import { SortHeader, useTableSort } from "./ui/sort-header";

/**
 * Holdings table for the /portfolio page.
 *
 * Columns: DAT | Balance | Value | 24h % ($) | After buy % ($) - all sortable
 * with the standard table-sort UX from the strategy dashboards.
 *
 * Phase 3 renders one row (LDAT). When the factory pattern unlocks
 * additional DATs, swap the single useReadContract for a useReadContracts
 * multicall driven by KNOWN_DATS, and per-DAT strategy stats + avg-cost will
 * need their own per-row hooks (today useStrategyStats is hardcoded to the
 * anchor strategy).
 *
 * Empty states (handled here, not inside the row component):
 *   - wallet disconnected -> "Connect a wallet..."
 *   - wallet connected, all balances = 0 -> "You don't have any DAT assets..."
 * In both cases the table headers are hidden, so the page reads cleanly when
 * the user just landed and has nothing yet.
 */

type DatDef = {
  address: `0x${string}`;
  name: string;
  symbol: string;
};

const KNOWN_DATS: DatDef[] = [
  {
    address: ADDR.strategy,
    name: "LDAT",
    symbol: "LDAT",
  },
];

type Row = {
  dat: DatDef;
  tokenBalance: bigint;
  balanceFloat: number;
  valueUsd: number;
  change24hPct: number | null;
  delta24Usd: number | null;
  afterBuyPct: number | null;
  afterBuyUsd: number | null;
};

export function PortfolioHoldings() {
  const { address, isConnected } = useAccount();

  // All position-derived fields for the single anchor DAT. Single-DAT scoped
  // until the factory pattern lands - see file header.
  const { data: anchorBalance } = useReadContract({
    address: ADDR.strategy,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const { data: stats } = useStrategyStats();
  const ethUsd = useEthPrice();
  const change24hPct = usePriceChange24h(stats?.sqrtPriceX96);
  const { avgPriceEth } = useAvgCostBasis(address);

  const tokenBalance = anchorBalance ?? 0n;
  const balanceFloat = Number(tokenBalance) / 1e18;
  const priceEth = ldatPriceInEth(stats?.sqrtPriceX96);
  const priceUsd = priceEth * (ethUsd || 0);
  const valueUsd = balanceFloat * priceUsd;

  let delta24Usd: number | null = null;
  if (change24hPct !== null && balanceFloat > 0 && priceUsd > 0) {
    const denom = 1 + change24hPct / 100;
    if (denom > 0) delta24Usd = valueUsd - valueUsd / denom;
  }

  let afterBuyPct: number | null = null;
  let afterBuyUsd: number | null = null;
  if (
    avgPriceEth !== null &&
    avgPriceEth > 0 &&
    priceEth > 0 &&
    balanceFloat > 0
  ) {
    afterBuyPct = ((priceEth - avgPriceEth) / avgPriceEth) * 100;
    afterBuyUsd = (priceEth - avgPriceEth) * balanceFloat * (ethUsd || 0);
  }

  // One row per DAT. Filter out zero positions so sorting and empty-state
  // detection only consider real holdings.
  const allRows: Row[] = [
    {
      dat: KNOWN_DATS[0],
      tokenBalance,
      balanceFloat,
      valueUsd,
      change24hPct: balanceFloat > 0 ? change24hPct : null,
      delta24Usd,
      afterBuyPct,
      afterBuyUsd,
    },
  ];
  const rows = allRows.filter((r) => r.balanceFloat > 0);

  // Sort comparators - nulls sort to the bottom (-Infinity baseline) so a row
  // with missing data doesn't outrank a row with real numbers.
  const N_INF = Number.NEGATIVE_INFINITY;
  const comparators = {
    dat: (a: Row, b: Row) => a.dat.name.localeCompare(b.dat.name),
    balance: (a: Row, b: Row) => a.balanceFloat - b.balanceFloat,
    value: (a: Row, b: Row) => a.valueUsd - b.valueUsd,
    change24h: (a: Row, b: Row) =>
      (a.change24hPct ?? N_INF) - (b.change24hPct ?? N_INF),
    afterBuy: (a: Row, b: Row) =>
      (a.afterBuyPct ?? N_INF) - (b.afterBuyPct ?? N_INF),
  };
  const { sorted, sortKey, sortDir, toggle } = useTableSort(
    rows,
    "value",
    comparators,
    "desc",
  );

  if (!isConnected) {
    return (
      <div className="px-4 sm:px-5 py-10 text-center text-sm text-muted-foreground">
        Connect a wallet to see your DAT holdings.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="px-4 sm:px-5 py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have any DAT assets in your wallet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs border-b border-border">
            <SortHeader field="dat" active={sortKey} dir={sortDir} onClick={toggle}>
              DAT
            </SortHeader>
            <SortHeader field="balance" active={sortKey} dir={sortDir} onClick={toggle} align="right">
              Balance
            </SortHeader>
            <SortHeader field="value" active={sortKey} dir={sortDir} onClick={toggle} align="right">
              Value
            </SortHeader>
            <SortHeader field="change24h" active={sortKey} dir={sortDir} onClick={toggle} align="right">
              24h % ($)
            </SortHeader>
            <SortHeader field="afterBuy" active={sortKey} dir={sortDir} onClick={toggle} align="right">
              After buy % ($)
            </SortHeader>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <HoldingRow key={r.dat.address} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoldingRow({ row }: { row: Row }) {
  return (
    <tr className="border-b border-border/50 last:border-b-0">
      <td className="py-3 px-4">
        <Link
          href={`/dats/${row.dat.address}` as never}
          className="inline-flex items-center gap-2 group"
        >
          <LdatIcon className="w-6 h-6 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {row.dat.name}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {row.dat.symbol}
            </span>
          </span>
        </Link>
      </td>
      <td className="py-3 px-4 text-right font-mono tabular">
        {formatTokens(row.tokenBalance)}
      </td>
      <td className="py-3 px-4 text-right font-mono tabular">
        {row.valueUsd > 0
          ? `$${row.valueUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
          : "-"}
      </td>
      <td className="py-3 px-4 text-right font-mono tabular whitespace-nowrap">
        <SignedDelta pct={row.change24hPct} usd={row.delta24Usd} />
      </td>
      <td className="py-3 px-4 text-right font-mono tabular whitespace-nowrap">
        <SignedDelta pct={row.afterBuyPct} usd={row.afterBuyUsd} />
      </td>
    </tr>
  );
}
