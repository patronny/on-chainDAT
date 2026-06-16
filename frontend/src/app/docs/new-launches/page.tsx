import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Launches" };

export default function NewLaunchesDocPage() {
  return (
    <>
      <h1>New Launches</h1>

      <p>
        All <code>$XXXDAT</code> tokens are launched through a{" "}
        <strong>fair launch</strong> model.
      </p>

      <p>
        At launch, the full token supply is created -{" "}
        <strong>1,000,000,000 $XXXDAT</strong>. After that, the entire supply is
        sent into the liquidity pool, and the LP position is locked or burned so
        the liquidity cannot be withdrawn.
      </p>

      <p>
        To protect the launch from bots and snipers, the initial buy fee is{" "}
        <strong>99%</strong>. It then gradually decreases to the base fee of
        each specific DAT.
      </p>

      <p>
        For example, the base fee for <code>$LDAT</code> is{" "}
        <strong>10%</strong>.
      </p>

      <p>
        It is important to understand that these fees are{" "}
        <strong>not extracted from the ecosystem</strong>. They remain inside
        the mechanics of each specific DAT and are used to support its economy:
        treasury accumulation, buybacks, burns, or other actions defined by that
        token&rsquo;s model.
      </p>

      <p>
        That is why the high initial fee is not a punishment for users. It is a
        protection mechanism against snipers and a way to strengthen the
        token&rsquo;s health at launch.
      </p>

      <p>
        Additionally, regardless of the internal economy of each{" "}
        <code>$XXXDAT</code>, <strong>1% of trading volume</strong> from every
        token is always used to buy and burn the core protocol token on the
        network where that token was launched.
      </p>

      <p>
        If the token is launched on <strong>Linea L2</strong>, this 1% is used
        to buy and burn <code>$LDAT</code>. The more DAT tokens are launched
        in the Linea ecosystem, the stronger the constant deflationary pressure
        on <code>$LDAT</code> becomes.
      </p>
    </>
  );
}
