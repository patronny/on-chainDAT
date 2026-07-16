import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BinaryRain } from "@/components/binary-rain";
import { ADDR } from "@/lib/wagmi";

/**
 * Landing page - a plain description of what the LDAT contracts do.
 *
 * Copy rule for this file: present-tense mechanism only. Describe the contract's
 * behaviour, never a favorable outcome for the reader. (Unfavorable outcomes are
 * exactly what the risk copy must state, so the rule is one-directional.) See
 * /terms section 7 - the Services are documented as experimental prototypes with
 * no represented economic return, so nothing here may promise one. No price
 * direction, no "earn X%", no second-person economics.
 *
 * One constraint that is easy to undo by accident: the material risks
 * (upgradeable, owner-settable params, unaudited, total loss) stay next to the
 * CTA, not buried in /terms.
 *
 * Some numbers here are CURRENT on-chain parameters rather than constants:
 * bagSize (LineaDATStrategy.updateBagSize) and the twap drip
 * (BaseStrategy.setTwapIncrement / setTwapDelayInBlocks) are onlyOwner. The
 * 1.2x multiplier is NOT: BaseStrategy.setPriceMultiplier is onlyFactory and
 * LineaDATFactory exposes no path to it, so it moves only via an upgrade. The
 * risk panel draws that line exactly - do not blur it back.
 *
 * Layout:
 *   - Hero: what the contract is, the risk state, then the CTAs
 *   - 3-tile mechanism grid (tax / acquisition / burn)
 *   - Step-by-step mechanics + contract identity
 *   - Risk panel
 */
export const metadata: Metadata = {
  title: { absolute: "LDAT - on-chain DAT treasury on Linea L2" },
  description:
    "LDAT is a treasury contract on Linea L2. Every LDAT trade pays a 10% tax, the treasury buys 150,000-LINEA bags and relists them at 1.2x, and when a bag sells the ETH funds a buyback that burns LDAT. Upgradeable contracts, owner-settable parameters, 2-of-3 multisig ownership, no third-party audit.",
};

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
                <span className="text-primary">Autonomous</span>
                <br />
                <span className="whitespace-normal sm:whitespace-nowrap">
                  DAT{" "}
                  <span className="text-sm sm:text-base md:text-xl lg:text-2xl font-mono font-medium tracking-tight text-foreground/80 align-middle">
                    (digital asset treasuries)
                  </span>
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                A treasury contract on Linea L2. It taxes every LDAT trade, spends what it collects on
                $LINEA bags, relists them at 1.2×, and burns LDAT with the ETH a sale returns. This page
                describes what the code does. It does not predict what the market does.
              </p>

              {/* Material risks belong next to the CTA. Do not move this below the fold. */}
              <div className="mt-6 max-w-2xl rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Experimental and unaudited.</span>{" "}
                Upgradeable contracts, owner-settable numbers, 2-of-3 multisig, no external audit.
                Nothing here is investment advice, and you can lose the full value of any LDAT you
                hold.{" "}
                <Link href="#risks" className="text-secondary underline underline-offset-4 hover:opacity-80">
                  What can go wrong
                </Link>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button size="xl" asChild>
                  <Link href="/about">How it works</Link>
                </Button>
                <Button size="xl" variant="outline" asChild>
                  <Link href={`/dats/${ADDR.strategy}` as never}>
                    Buy $LDAT
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* MECHANISM GRID */}
        <section className="container py-8 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-6 sm:p-8">
              <h3 className="text-lg font-display font-semibold mb-2 text-secondary">Enforced Fee</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every LDAT trade, buy or sell, pays a 10% tax: 8% goes to the treasury, 2% funds the
                project. The Uniswap v4 pool hook collects it at swap time, so no address trades the
                pool free and no swap is exempt.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <h3 className="text-lg font-display font-semibold mb-2 text-secondary">Dynamic Acquisitions</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Once enough ETH has built up, the treasury buys a bag of 150,000 $LINEA from whoever
                offers one, then relists that bag at 1.2× the ETH it paid. The contract sets that asking
                price; whether anyone pays it is the market&apos;s call.
              </p>
            </Card>
            <Card className="p-6 sm:p-8">
              <h3 className="text-lg font-display font-semibold mb-2 text-secondary">Burn on bag sale</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When a bag sells, its ETH is queued for a buyback of LDAT, and the contract burns what it
                buys. No bag sale, no burn. The queue drains in capped steps, one call per delay window,
                rather than in a single market order.
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
                  Every buy or sell of LDAT pays a <span className="font-mono text-foreground">10%</span> tax:{" "}
                  <span className="font-mono text-foreground">8%</span> to the treasury and{" "}
                  <span className="font-mono text-foreground">2%</span> to the project. The tax lives inside the
                  pool&apos;s own hook and arrives as ETH, so no swap through the pool escapes it.
                </p>
              </div>
              <div>
                <h4 className="text-secondary font-semibold mb-2">2. Treasury buys a LINEA bag</h4>
                <p>
                  That ETH sits in the contract until someone hands it{" "}
                  <span className="font-mono text-foreground">150,000 LINEA</span>. Any address can: the contract
                  takes the bag and pays out the ETH released so far, which ramps up block by block rather than
                  emptying the balance at once. That is how the treasury accumulates $LINEA.
                </p>
              </div>
              <div>
                <h4 className="text-secondary font-semibold mb-2">3. Bag goes back on sale at 1.2×</h4>
                <p>
                  The contract relists the bag for <span className="font-mono text-foreground">20%</span> more ETH than
                  it paid. Any address that sends that exact amount receives the LINEA. Nothing obliges anyone to send
                  it, and a bag can sit unsold indefinitely.
                </p>
              </div>
              <div>
                <h4 className="text-secondary font-semibold mb-2">4. Bag sale funds the burn</h4>
                <p>
                  A sold bag adds its ETH to the burn queue. Each call spends at most a fixed increment and only once
                  per delay window, which keeps the buyback from landing as one sandwichable order. Calling it is
                  permissionless and pays the caller{" "}
                  <span className="font-mono text-foreground">0.5%</span> of the burn.
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <h4 className="text-secondary font-semibold mb-2">Where the code lives</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                LDAT launched on Linea (chain{" "}
                <span className="font-mono text-foreground">59144</span>) on 9 June 2026 at{" "}
                <span className="font-mono text-foreground break-all">{ADDR.strategy}</span>. The contracts are open
                source and verified on Lineascan, and the treasury is readable on-chain. Read the code before you
                touch it, and read the{" "}
                <Link href="/terms" className="text-secondary underline underline-offset-4 hover:opacity-80">
                  terms
                </Link>{" "}
                first.
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <Button size="lg" variant="outline" asChild>
                <Link href="/docs/ldat">Read the full breakdown</Link>
              </Button>
            </div>
          </Card>
        </section>

        {/* RISKS */}
        <section id="risks" className="container py-8 sm:py-12 scroll-mt-20">
          <Card className="p-6 sm:p-10 border-destructive/40">
            <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4 neon-red">
              What can go wrong
            </h2>
            <ul className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <li className="border-l-2 border-destructive/50 pl-4">
                <span className="font-semibold text-foreground">The contracts are upgradeable.</span> Ownership
                sits behind a 2-of-3 Safe multisig that can replace the logic described above. The project has
                said it intends to revoke upgradeability after post-launch testing, but has committed to no
                date and is under no obligation to do it. Until it happens, treat the code as changeable.
              </li>
              <li className="border-l-2 border-destructive/50 pl-4">
                <span className="font-semibold text-foreground">Some numbers here are settings, not constants.</span>{" "}
                The bag size and the burn increment and delay are owner-adjustable in a single transaction,
                without an upgrade. The 10% trade tax, the 0.5% caller share and the 1.2× relist multiplier are
                not: the multiplier&apos;s setter is gated to the factory, which exposes no path to it, so it
                moves only if the contracts are upgraded.
              </li>
              <li className="border-l-2 border-destructive/50 pl-4">
                <span className="font-semibold text-foreground">There is no third-party audit.</span> The code is
                public and verified on-chain, but nothing here has been reviewed by an external auditor.
              </li>
              <li className="border-l-2 border-destructive/50 pl-4">
                <span className="font-semibold text-foreground">This is an experimental prototype.</span> Smart
                contract bugs, exploits, and regulatory uncertainty are real and unresolved. The cycle only turns
                while people trade, offer bags, and trigger burns. Nobody guarantees the protocol keeps operating,
                or operates in any particular manner.
              </li>
              <li className="border-l-2 border-destructive/50 pl-4">
                <span className="font-semibold text-foreground">Total loss is possible.</span> Trade only what you
                can afford to lose.
              </li>
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" variant="outline" asChild>
                <Link href="/docs/faq">Read the FAQ</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/terms">Terms of Service</Link>
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <Footer />
    </>
  );
}
