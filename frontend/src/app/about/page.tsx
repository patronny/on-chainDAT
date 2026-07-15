import type { Metadata } from "next";
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
            <strong className="text-foreground">1. Amplified $LINEA exposure with no liquidation risk.</strong>
          </p>
          <p>
            $LDAT acts like leverage on $LINEA, but without margin calls and without interest on the
            leverage. The logic is simple:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>the treasury holds $LINEA and $ETH;</li>
            <li>when $LINEA appreciates, the dollar value of the treasury grows with it;</li>
            <li>in parallel, the treasury buys $LDAT from the market and burns it, shrinking supply;</li>
            <li>
              these two effects compound, and $LDAT&apos;s price typically moves harder than $LINEA
              itself.
            </li>
          </ul>
          <p>
            The downside is symmetrical. But nobody force-closes you, nobody confiscates your token, you
            pay no interest.
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
            Why it will work as long as Ethereum works
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
              any user can hand the protocol 150,000 $LINEA and walk away with all of the accumulated $ETH.
            </li>
          </ul>
          <p>
            No centralized market maker, no off-chain deals. The market itself brings $LINEA to the
            protocol at a favorable price exactly when that becomes profitable.
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
            <li>$LDAT will be tradeable for as long as Ethereum lives.</li>
          </ul>

          <p>
            <strong className="text-foreground">5. The contracts will become Immutable over time.</strong>
          </p>
          <p>
            For now, during the first months of mainnet, upgrade keys are held behind a 2-of-3 multisig, so we
            can fix a bug quickly if one shows up. Once the full stress-test cycle is finished, we will
            revoke those keys. From that moment the contracts are frozen: nobody, including us, can
            change them. The trust question is closed for good.
          </p>

          <h2 className="text-xl font-display font-semibold text-secondary pt-4">
            Why this is interesting for a holder
          </h2>
          <p>
            The core idea of LDAT is a reflexive loop. It spins in both directions and never
            switches off.
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
            is how much $LINEA and $ETH sits inside the protocol. When market cap falls below the
            treasury, $LDAT effectively trades at a discount to its net assets, the signal is read
            quickly, and the gap closes. When the situation reverses, holders take profit. The cycle
            repeats, and every loop generates volume, fees, and treasury growth.
          </p>

          <p>
            <strong className="text-foreground">3. $LINEA up → $LDAT usually up harder.</strong>
          </p>
          <p>
            The dollar value of the treasury rises, and part of the $LINEA position gradually converts
            back into $ETH through the P2P mechanism, and that $ETH buys $LDAT for burning. Two
            flows pull the price up at the same time.
          </p>

          <p>
            <strong className="text-foreground">4. $LINEA down → also good for the protocol.</strong>
          </p>
          <p>
            When the base asset gets cheaper, holders get nervous and trade more. $LDAT volume
            rises, fees in the treasury rise, the buy-and-burn cycle never stops. The protocol feeds on
            movement, not on direction.
          </p>

          <p>
            <strong className="text-foreground">5. Volatility is our ally.</strong>
          </p>
          <p>
            Most protocols fear sharp markets. LDAT loves them. Any move, up or down, equals volume,
            equals fees, equals buy-and-burn of $LDAT.
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
            You can also read the detailed project documentation{" "}
            <a
              href="https://docs.on-chaindat.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              here
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
