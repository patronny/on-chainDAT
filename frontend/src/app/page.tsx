import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BinaryRain } from "@/components/binary-rain";
import { ADDR } from "@/lib/wagmi";

/**
 * Landing page - the marketing hero.
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
        <section className="relative overflow-hidden">
          <BinaryRain />
          {/* Subtle dark gradient over the rain so the headline stays readable on
              the left half without dimming the whole effect. */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.75) 35%, hsl(var(--background) / 0.35) 70%, hsl(var(--background) / 0.15) 100%)",
            }}
          />
          <div className="relative z-10 container py-12 sm:py-16 md:py-24">
            <div className="max-w-3xl">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.1]">
                On-chain
                <br />
                <span className="text-primary">Perpetual</span>
                <br />
                <span className="whitespace-normal sm:whitespace-nowrap">
                  DAT{" "}
                  <span className="text-sm sm:text-base md:text-xl lg:text-2xl font-mono font-medium tracking-tight text-foreground/80 align-middle">
                    (digital asset treasuries)
                  </span>
                </span>
              </h1>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button size="xl" asChild>
                  <Link href={`/dats/${ADDR.strategy}` as never}>
                    Buy LDAT
                  </Link>
                </Button>
                <Button size="xl" variant="outline" asChild>
                  <Link href="/about">How it works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="container py-8 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2 text-secondary">Enforced Fee</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every trade, buy or sell, pools ETH in the DAT contract through a fully-enforced 10% tax.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2 text-secondary">Dynamic Acquisitions</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Once enough ETH has been accumulated, DAT purchases the cheapest available BAG and lists it
                for resale with a 20% markup.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <div className="text-3xl mb-3"></div>
              <h3 className="text-lg font-display font-semibold mb-2 text-secondary">Burn Pressure</h3>
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
            <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4 heading-accent">How LDAT works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <div>
                <h4 className="text-secondary font-semibold mb-2">1. Trading tax</h4>
                <p>
                  Every buy or sell of LDAT pays <span className="font-mono text-foreground">10%</span> straight
                  to the treasury. The tax lives inside the pool&apos;s own hook, so there are no exemptions and no
                  whitelist.
                </p>
              </div>
              <div>
                <h4 className="text-secondary font-semibold mb-2">2. Treasury buys a LINEA bag</h4>
                <p>
                  Once enough ETH has stacked up, anyone can hand the DAT{" "}
                  <span className="font-mono text-foreground">150,000 LINEA</span> and take that ETH home in exchange.
                  The DAT now holds a bag of LINEA it just bought from you.
                </p>
              </div>
              <div>
                <h4 className="text-secondary font-semibold mb-2">3. Bag goes back on sale at 1.2×</h4>
                <p>
                  The DAT relists that bag for <span className="font-mono text-foreground">20%</span> more ETH than it
                  paid. Whoever sends that exact amount takes the LINEA.
                </p>
              </div>
              <div>
                <h4 className="text-secondary font-semibold mb-2">4. Markup ETH burns LDAT</h4>
                <p>
                  The ETH from the sold bag funds a buyback that purchases LDAT on Uniswap and burns it. Anyone
                  can trigger this and earn a <span className="font-mono text-foreground">0.5%</span> reward.
                </p>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <Button size="lg" variant="outline" asChild>
                <Link href="/about">Read the full breakdown</Link>
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <Footer />
    </>
  );
}
