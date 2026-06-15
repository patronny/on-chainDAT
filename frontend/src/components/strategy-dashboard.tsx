"use client";

import { DraggableGrid, DraggableSection } from "./draggable-grid";
import { ChartOrCountdown, ChartSubtitle } from "./chart-or-countdown";
import { HoldingsTable, useHoldingsTotals } from "./holdings-table";
import { SalesTable, useSalesTotals } from "./sales-table";
import { PaginatedSwapsTable } from "./paginated-swaps-table";
import { SwapCard } from "./swap-card";
import { FundingsCard, FundingsTitle, BotIntentCard, BotIntentTitle, ProgressCard, ProgressTitle } from "./fundings-card";
import { PoolLiquidityCard } from "./pool-liquidity-card";
import { BurnedCard } from "./burned-card";
import { ActionsCard } from "./actions-card";
import { formatEth, formatTokens, bagArbStyle, ethToUsd, usdApprox, NEON_GREEN_STYLE } from "@/lib/utils";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useBagMarketPriceEth } from "@/hooks/useBagMarketPriceEth";
import { UNDERLYING_SYMBOL } from "@/lib/wagmi";

/**
 * Live summary line under the Holdings card title:
 *   "LineaDAT is holding 450,000 tLINEA bought for 0.0742 ETH, listed for 0.0890 ETH"
 * Mirrors the tokenstrategy.com header pattern. Falls back to the original
 * descriptive blurb while the totals are still loading.
 */
function HoldingsSubtitle() {
  const { count, totalTokens, totalPaid, totalListed } = useHoldingsTotals();
  const ethUsd = useEthPrice();
  const bagMarketEth = useBagMarketPriceEth(0n); // mainnet ignores the arg, reads the snapshot
  if (count === 0) {
    return <span>Bags currently listed for sale. Buy at the listed price.</span>;
  }
  // Arb colour vs the live market value of ALL held bags (same source as the
  // "Trying to buy" card): green when listed below market, pink when above.
  const marketTotalEth = bagMarketEth * BigInt(count);
  const listedUsd = ethUsd > 0 ? ethToUsd(totalListed, ethUsd) : 0;
  return (
    <span>
      LineaDAT is holding{" "}
      <span className="text-foreground font-semibold">{formatTokens(totalTokens)} {UNDERLYING_SYMBOL}</span>{" "}
      bought for{" "}
      <span className="text-foreground font-semibold">{formatEth(totalPaid)} ETH</span>, listed for{" "}
      <span className="font-semibold" style={NEON_GREEN_STYLE}>
        {formatEth(totalListed)} ETH
      </span>
      {listedUsd > 0 ? (
        <span className="font-semibold" style={bagArbStyle(totalListed, marketTotalEth)}>
          {" "}({usdApprox(listedUsd)})
        </span>
      ) : null}
    </span>
  );
}

/**
 * Live summary line under the Sales card title:
 *   "LineaDAT sold 450,000 tLINEA for 0.089 ETH, realizing +0.015 ETH profit"
 * Profit number rendered with a neon glow (green positive, red negative) to
 * mirror the tokenstrategy.com header. Falls back to the descriptive blurb
 * while no bags have been redeemed yet.
 */
function SalesSubtitle() {
  const { count, totalTokens, totalSold, totalPaid, profit } = useSalesTotals();
  if (count === 0) {
    return <span>Past bag sales. Profit = sold-for minus what the bot paid.</span>;
  }
  const positive = profit >= 0n;
  const profitAbs = profit < 0n ? -profit : profit;
  const profitColor = positive ? "rgb(74, 222, 128)" : "rgb(248, 113, 113)";
  const profitGlow = `0 0 6px ${positive ? "rgba(74,222,128,0.85)" : "rgba(248,113,113,0.85)"}, 0 0 14px ${
    positive ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)"
  }`;
  return (
    <span>
      LineaDAT sold{" "}
      <span className="text-foreground font-semibold">{formatTokens(totalTokens)} {UNDERLYING_SYMBOL}</span>{" "}
      for{" "}
      <span className="text-foreground font-semibold">{formatEth(totalSold)} ETH</span>
      {totalPaid > 0n ? (
        <>
          , realizing{" "}
          <span
            className="font-semibold"
            style={{ color: profitColor, textShadow: profitGlow }}
          >
            {positive ? "+" : "-"}
            {formatEth(profitAbs)} ETH
          </span>{" "}
          profit
        </>
      ) : null}
    </span>
  );
}

const leftSections: DraggableSection[] = [
  {
    id: "chart",
    title: "$LINEADAT Chart",
    subtitle: <ChartSubtitle />,
    render: () => <ChartOrCountdown />,
  },
  {
    id: "holdings",
    title: "Holdings",
    subtitle: <HoldingsSubtitle />,
    render: () => <HoldingsTable />,
  },
  {
    id: "sales",
    title: "Sales",
    subtitle: <SalesSubtitle />,
    render: () => <SalesTable />,
  },
  {
    id: "swaps",
    title: "Last swaps",
    subtitle: "Most recent ETH ↔ LINEADAT swaps from the live v4 pool.",
    render: () => <PaginatedSwapsTable />,
  },
];

const rightSections: DraggableSection[] = [
  { id: "swap", title: "Swap", render: () => <SwapCard /> },
  { id: "fundings", title: <FundingsTitle />, render: () => <FundingsCard /> },
  {
    id: "pool-liquidity",
    title: "Liquidity Pool",
    subtitle: "Live $LINEADAT / $ETH Uniswap v4 pool.",
    render: () => <PoolLiquidityCard />,
  },
  { id: "bot-intent", title: <BotIntentTitle />, render: () => <BotIntentCard /> },
  { id: "progress", title: <ProgressTitle />, render: () => <ProgressCard /> },
  { id: "burned", title: "Burned amount", render: () => <BurnedCard /> },
  { id: "actions", title: "Actions", render: () => <ActionsCard /> },
];

/**
 * Two-column dashboard. Each column is its own DraggableGrid (independent reorder + collapse).
 * State persisted to localStorage per column key. Mobile collapses to single column with the
 * Swap card surfaced first for thumb-reach.
 */
export function StrategyDashboard() {
  return (
    <>
      {/* Mobile: single grid, Swap forced to top via custom mobile order */}
      <div className="lg:hidden">
        <DraggableGrid
          storageKey="lineastr.dashboard.mobile.v3"
          sections={[...rightSections.slice(0, 1), ...leftSections, ...rightSections.slice(1)]}
        />
      </div>

      {/* Desktop: 2-col grid, each column independently sortable.
          Right + mobile storage keys bumped to v3 so existing users get the new
          default order with the Liquidity Pool card right under Fundings
          (the grid otherwise appends unknown ids at the end of a saved order). */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <DraggableGrid storageKey="lineastr.dashboard.left.v2" sections={leftSections} />
        </div>
        <div>
          <DraggableGrid storageKey="lineastr.dashboard.right.v3" sections={rightSections} />
        </div>
      </div>
    </>
  );
}
