import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)] max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-6">About LineaDAT</h1>

        <div className="prose-style space-y-6 text-base text-muted-foreground leading-relaxed">
          <p>
            LineaDAT is a deflationary digital asset treasury on Linea L2, modeled on TokenWorks'
            ERC20Strategy v3 (also known as WBTCSTR on mainnet). The strategy holds $LINEA in its treasury,
            issues bags through a P2P auction mechanism, and burns its own LINEADAT token forever
            via a TWAP buy-and-burn loop.
          </p>

          <h2 className="text-xl font-display font-semibold text-foreground pt-4">The mechanism</h2>
          <p>
            <strong className="text-foreground">Step 1.</strong> Anyone can call{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">buyTokens()</code> to deposit
            150 000 LINEA and receive <code className="bg-muted px-1.5 py-0.5 rounded text-sm">availableFunds()</code> ETH
            from accumulated swap fees.
          </p>
          <p>
            <strong className="text-foreground">Step 2.</strong> The strategy lists that bag at <code>paid × 1.2</code>.
            Anyone can buy it back by sending exactly the listed price in ETH.
          </p>
          <p>
            <strong className="text-foreground">Step 3.</strong> Sold-bag ETH lands in{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">ethToTwap</code>, which gradually
            buys LINEADAT off the open market and burns it. Total supply only ever decreases.
          </p>

          <h2 className="text-xl font-display font-semibold text-foreground pt-4">Slow-rug protection</h2>
          <p>
            The function{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm">getMaxPriceForBuy()</code> returns
            an ascending ramp: <code>(blocks-since-last-buy) × buyIncrement</code>. This bounds the maximum
            payout from a single buyTokens call. No single bot can drain more than the natural fee
            accumulation, even with infinite gas. Frontrunning is economically pointless: every bot pays
            the same <code>availableFunds()</code> regardless of timing.
          </p>

          <h2 className="text-xl font-display font-semibold text-foreground pt-4">Open source</h2>
          <p>
            LineaDAT is forked from TokenWorks ERC20Strategy v3 (MIT licensed). All code is on{" "}
            <a
              href="https://github.com/patronny/LineaDAT"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              GitHub
            </a>
            , with 134+ Foundry tests and a 1000-cycle Anvil fork stress test.
          </p>

          <h2 className="text-xl font-display font-semibold text-foreground pt-4">Roadmap</h2>
          <ul className="list-none space-y-2 pl-0">
            <li>
              <span className="text-success font-semibold">Phase 1.</span> Foundry contracts + tests (DONE)
            </li>
            <li>
              <span className="text-success font-semibold">Phase 2.</span> Anvil fork stress test (DONE)
            </li>
            <li>
              <span className="text-warning font-semibold">Phase 3.</span> Base Sepolia testnet + bot + frontend (LIVE)
            </li>
            <li>
              <span className="text-muted-foreground font-semibold">Phase 4.</span> Linea mainnet production deploy
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
