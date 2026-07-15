import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StrategyHeader } from "@/components/strategy-header";
import { StrategyDashboard } from "@/components/strategy-dashboard";
import { ADDR } from "@/lib/wagmi";

export const metadata: Metadata = {
  title: "LDAT Treasury, Price and Burn",
  description:
    "Live $LDAT price, treasury holdings, bag sales and burn total on Linea L2, read straight from the contract. Swap LDAT through its Uniswap v4 pool.",
};

export default async function StrategyPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  // The page renders ADDR.strategy's data unconditionally, so any other address in the
  // URL would render this DAT's treasury under a name that is not it. Reject rather
  // than serve a 200 for /dats/<anything>. Match ADDR (not a literal) so testnet
  // deployments keep working.
  if (address.toLowerCase() !== ADDR.strategy.toLowerCase()) notFound();
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-3.5rem)] py-4 sm:py-6">
        <div className="container">
          <StrategyHeader />
          <StrategyDashboard />
        </div>
      </main>
      <Footer />
    </>
  );
}
