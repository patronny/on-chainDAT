"use client";

import { DraggableGrid, DraggableSection } from "./draggable-grid";
import { DexChart } from "./dex-chart";
import { HoldingsTable } from "./holdings-table";
import { SalesTable } from "./sales-table";
import { PaginatedSwapsTable } from "./paginated-swaps-table";
import { SwapCard } from "./swap-card";
import { FundingsCard, BotIntentCard, BotIntentTitle, ProgressCard, ProgressTitle } from "./fundings-card";
import { BurnedCard } from "./burned-card";
import { ActionsCard } from "./actions-card";

const leftSections: DraggableSection[] = [
  {
    id: "chart",
    title: "$LINEADAT Chart",
    subtitle: "Powered by Dexscreener (testnet pool may not appear)",
    render: () => <DexChart />,
  },
  {
    id: "holdings",
    title: "Holdings",
    subtitle: "Bags currently listed for sale. Buy at the listed price.",
    render: () => <HoldingsTable />,
  },
  {
    id: "sales",
    title: "Sales",
    subtitle: "Past bag sales. Profit = sold-for minus what the bot paid.",
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
  { id: "fundings", title: "Fundings", render: () => <FundingsCard /> },
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
          storageKey="lineastr.dashboard.mobile.v2"
          sections={[...rightSections.slice(0, 1), ...leftSections, ...rightSections.slice(1)]}
        />
      </div>

      {/* Desktop: 2-col grid, each column independently sortable.
          Storage keys bumped to v2 so existing users get the new default order
          (actions last, burned second-from-last, plus the split fundings cards). */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2">
          <DraggableGrid storageKey="lineastr.dashboard.left.v2" sections={leftSections} />
        </div>
        <div>
          <DraggableGrid storageKey="lineastr.dashboard.right.v2" sections={rightSections} />
        </div>
      </div>
    </>
  );
}
