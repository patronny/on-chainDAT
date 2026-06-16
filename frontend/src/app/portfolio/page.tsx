import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { SwapCard } from "@/components/swap-card";
import { PortfolioHoldings } from "@/components/portfolio-holdings";
import { PortfolioSummary } from "@/components/portfolio-summary";

export const metadata: Metadata = {
  title: "Portfolio - LDAT",
  description:
    "Your DAT holdings across on-chainDAT: balances, position value, 24h change, and since-first-buy P&L.",
};

export default function PortfolioPage() {
  return (
    <>
      <Header />
      <main className="container py-6 sm:py-10 min-h-[calc(100vh-3.5rem)]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left column - summary on top, holdings (or empty state) below. */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card className="overflow-hidden">
              <PortfolioSummary />
            </Card>

            <Card className="overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-border">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider">
                  Holdings
                </h3>
              </div>
              <PortfolioHoldings />
            </Card>
          </div>

          {/* Swap - right column. */}
          <div className="lg:col-span-1">
            <Card className="overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-border">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider">
                  Swap
                </h3>
              </div>
              <SwapCard />
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
