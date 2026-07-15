import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  // absolute: the title already carries the brand, so skip the root "%s - LDAT" template.
  title: { absolute: "How LDAT Works - Digital Asset Treasury on Linea" },
  description:
    "How the LDAT treasury accumulates $LINEA, resells it P2P at a markup, and burns $LDAT with the proceeds. Slow-rug protection and the path to immutable contracts.",
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)] max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-6 heading-accent">About LDAT</h1>

        <div className="prose-style space-y-6 text-base text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">LDAT is a digital asset treasury (DAT) on Linea L2.</strong>{" "}
            The protocol accumulates the network&apos;s base asset, $LINEA, resells it on a P2P market at a
            markup, and routes the resulting $ETH into buying and burning its own $LDAT token.
          </p>
          <p>
            In one sentence: the more trading and volatility there is in $LINEA, the more $LDAT
            goes into the fire, and the less of it stays in circulation.
          </p>

          <h2 className="text-xl font-display font-semibold text-secondary pt-4">Why we built it</h2>

          <p>
            <strong className="text-foreground">1. $LINEA exposure without borrowing.</strong>
          </p>
          <p>
            The protocol takes on no debt, so it has no position anyone can liquidate and no interest to
            service. What it does instead:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>the treasury holds $LINEA and $ETH;</li>
            <li>the dollar value of that treasury tracks the price of what it holds;</li>
            <li>in parallel, the treasury buys $LDAT from the market and burns it, shrinking supply.</li>
          </ul>
          <p>
            Those are the two mechanisms. How the market prices $LDAT against them is the market&apos;s
            business, and it can move in either direction, including to zero.
          </p>

          <p>
            <strong className="text-foreground">2. Move $LINEA volume from CEX to DEX inside Linea L2.</strong>
          </p>
          <p>
            Today almost all $LINEA volume routes through centralized exchanges. We want a slice of that
            activity to flow into Linea itself, onto its on-chain DEXs. Every swap there is a network
            fee, and every network fee fuels $LINEA&apos;s deflationary mechanics.
          </p>

          <p>
            <strong className="text-foreground">3. Indirectly accelerate $LINEA burns.</strong>
          </p>
          <p>
            $LINEA has a built-in value-return mechanism: a share of network fees funds buybacks and
            burns of $LINEA. The more activity on Linea, the less $LINEA stays in circulation. LDAT
            is one of the protocols that generates this activity by design.
          </p>

          <h2 className="text-xl font-display font-semibold text-secondary pt-4">
            What the design does not depend on
          </h2>

          <p>
            <strong className="text-foreground">1. No external dependencies.</strong>
          </p>
          <p>
            LDAT does not borrow, does not stake, does not hand the treasury to other protocols. The
            buy and sell of $LINEA happens through a transparent P2P mechanism:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              while anyone trades $LDAT on Uniswap, $ETH builds up in the treasury (8% of every swap; the
              other 2% of the 10% tax funds the project);
            </li>
            <li>
              once the dollar value of the accumulated $ETH exceeds the market price of 150,000 $LINEA
              on any Linea DEX, an arbitrage opens up;
            </li>
            <li>
              any address can hand the protocol 150,000 $LINEA and receive the $ETH released so far.
            </li>
          </ul>
          <p>
            No centralized market maker, no off-chain deals. The protocol picks no counterparty: it
            states a standing price and waits for someone to take it.
          </p>

          <p>
            <strong className="text-foreground">2. Slow-rug protection.</strong>
          </p>
          <p>
            A cap that stops the treasury from being drained in a single click. If $ETH stacks up faster
            than the protocol is ready to release it, the surplus simply waits. The cap grows linearly
            with every block, so arbitrageurs eventually capture it, but smoothly. The goal: keep the
            DAT running steadily through the launch and through any spike in activity, instead of
            burning out in the first few hours.
          </p>

          <p>
            <strong className="text-foreground">3. Linea L2 as the foundation.</strong>
          </p>
          <p>
            Linea is a zkEVM L2 with full EVM equivalence. It is built by ConsenSys, the company of
            Ethereum co-founder Joe Lubin, who is known for his focus on decentralization. LDAT&apos;s
            smart contracts execute exactly the same way as on Ethereum itself, with the same
            cryptographic guarantees, only cheaper and faster.
          </p>

          <p>
            <strong className="text-foreground">4. The $ETH/$LDAT liquidity is unkillable.</strong>
          </p>
          <p>The entire pool sits on Uniswap V4 and the LP position has been burned. That means:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>nobody, including the team, can pull liquidity;</li>
            <li>even if the Uniswap frontend is taken offline, the pool keeps working directly on-chain;</li>
            <li>the pool stays reachable for as long as Linea keeps producing blocks.</li>
          </ul>

          <p>
            <strong className="text-foreground">5. The contracts are upgradeable for now.</strong>
          </p>
          <p>
            During the first months of mainnet, upgrade keys are held behind a 2-of-3 multisig, so we can
            fix a bug quickly if one shows up. That also means the logic described on this page can be
            replaced. We intend to revoke those keys once the stress-test cycle is finished, which would
            freeze the contracts for good, but we have committed to no date and you should treat the code
            as changeable until it actually happens.
          </p>

          <h2 className="text-xl font-display font-semibold text-secondary pt-4">
            What the design implies
          </h2>
          <p>
            The core idea of LDAT is a reflexive loop, driven by trading volume rather than by price
            direction. What follows is what the mechanism does, not a forecast of what it is worth.
          </p>

          <p>
            <strong className="text-foreground">1. A starting treasury from day one.</strong>
          </p>
          <p>
            After launch the treasury already holds initial $LINEA. From there, every trade adds $ETH.
            The protocol does not start from zero.
          </p>

          <p>
            <strong className="text-foreground">
              2. When market cap drops below treasury, everyone sees it.
            </strong>
          </p>
          <p>
            $LDAT&apos;s market cap is the combined value of all tokens in circulation. The treasury
            is how much $LINEA and $ETH sits inside the protocol. Both numbers are on-chain, and the
            site shows them side by side, so anyone can see when market cap sits below treasury. What
            the market does with that information is not something the protocol controls or predicts.
          </p>

          <p>
            <strong className="text-foreground">3. The treasury tracks $LINEA.</strong>
          </p>
          <p>
            When $LINEA rises, the dollar value of the treasury rises with it. Separately, part of the
            $LINEA position converts back into $ETH through the P2P mechanism, and that $ETH buys $LDAT
            for burning. Those are two distinct mechanisms; neither one sets a price.
          </p>

          <p>
            <strong className="text-foreground">4. The cycle does not need a direction.</strong>
          </p>
          <p>
            The tax is charged on every swap, buy or sell alike, so the treasury accrues on falling
            markets exactly as it does on rising ones. The mechanism responds to volume, not to
            direction. If trading stops, the cycle stops with it.
          </p>

          <p>
            <strong className="text-foreground">5. Volatility drives the loop.</strong>
          </p>
          <p>
            Any move, up or down, is volume, and volume is what feeds the fee, the bag purchases, and
            the buy-and-burn. A quiet market means a quiet protocol.
          </p>

          <h2 className="text-xl font-display font-semibold text-secondary pt-4">What comes next</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>$LDAT is the first and anchor DAT in the on-chainDAT ecosystem on Linea L2.</li>
            <li>The next planned launch is $REX33DAT.</li>
            <li>
              All DAT tokens launched after $LDAT will route 1% of their volume into buying and
              burning $LDAT. The bigger the ecosystem gets, the stronger the deflationary pressure
              on the anchor token.
            </li>
          </ul>

          <p className="pt-6">
            The detailed project documentation is{" "}
            <Link href="/docs" className="text-primary hover:underline">
              here
            </Link>
            , and the risks are listed{" "}
            <Link href="/#risks" className="text-primary hover:underline">
              on the front page
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
