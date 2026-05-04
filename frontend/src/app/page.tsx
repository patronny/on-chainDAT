import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ADDR } from "@/lib/wagmi";

/**
 * Landing page — the marketing hero.
 *
 * Layout:
 *   - Hero with big CTA "Buy LINEASTR" → /strategies/[address]
 *   - 3-tile feature grid (slow-rug protection / deflation / open source)
 *   - Mechanics explainer
 *   - Theme switcher (in header on mobile, also persistent CTA at bottom)
 */
export default function HomePage() {
  return (
    <>
      <Header />

      <main className="min-h-[calc(100vh-3.5rem)]">
        {/* HERO */}
        <section className="container py-12 sm:py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1]">
              On-chain
              <br />
              <span className="text-primary">Perpetual</span>
              <br />
              <span className="whitespace-nowrap">
                DAT{" "}
                <span className="text-sm sm:text-base md:text-xl lg:text-2xl font-mono font-medium tracking-tight text-foreground/80 align-middle">
                  (digital asset treasuries)
                </span>
              </span>
            </h1>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="xl" asChild>
                <Link href={`/strategies/${ADDR.strategy}` as never}>
                  Buy LINEASTR
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/about">How it works</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="container py-8 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2">Enforced Fee</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every trade, buy or sell, pools ETH in the DAT contract through a fully-enforced 10% tax.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2">Dynamic Acquisitions</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Once enough ETH has been accumulated, DAT purchases the cheapest available BAG and lists it
                for resale with a 20% markup.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2">Burn Pressure</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upon selling the BAG, the DAT will immediately use all of the ETH from the sale to buy and
                burn its own supply.
              </p>
            </Card>
          </div>
        </section>

        {/* MECHANICS */}
        <section className="container py-8 sm:py-12">
          <Card className="p-6 sm:p-10">
            <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4">How LINEASTR works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <div>
                <h4 className="text-foreground font-semibold mb-2">1. Bot buys a bag</h4>
                <p>
                  Anyone can call <span className="font-mono text-foreground">buyTokens()</span> to deposit
                  150 000 LINEA into the strategy and receive <span className="font-mono text-foreground">availableFunds()</span> ETH.
                </p>
              </div>
              <div>
                <h4 className="text-foreground font-semibold mb-2">2. Bag listed at 1.2× markup</h4>
                <p>
                  The strategy lists the bag at <span className="font-mono text-foreground">paid × 1.2</span>.
                  Anyone can buy it back by sending exactly that much ETH.
                </p>
              </div>
              <div>
                <h4 className="text-foreground font-semibold mb-2">3. ETH accumulates → TWAP burn</h4>
                <p>
                  Sold-bag ETH lands in <span className="font-mono text-foreground">ethToTwap</span>. Once it's
                  enough, anyone can call <span className="font-mono text-foreground">processTokenTwap()</span> to
                  buy LINEASTR on Uniswap v4 and burn it. The caller earns 0.5% reward.
                </p>
              </div>
              <div>
                <h4 className="text-foreground font-semibold mb-2">4. Slow-rug ceiling</h4>
                <p>
                  <span className="font-mono text-foreground">getMaxPriceForBuy()</span> grows linearly per block.
                  No bot can drain more than the natural fee accumulation, so frontrunning is economically pointless.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <Footer />
    </>
  );
}
