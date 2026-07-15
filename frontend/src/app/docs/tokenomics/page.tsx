import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tokenomics",
  description:
    "$LDAT tokenomics: 1,000,000,000 max supply, the entire supply seeded into the Uniswap v4 pool at launch, and the LP position burned so it can never be recovered.",
};

export default function TokenomicsDocPage() {
  return (
    <>
      <h1>Tokenomics</h1>

      <p>
        The maximum supply of any token launched through{" "}
        <strong>on-chaindat.com</strong>, including <code>$LDAT</code>, is{" "}
        <strong>1 billion tokens</strong>.
      </p>

      <p>
        At launch, the entire supply is sent to a Uniswap V4 pool against{" "}
        <code>$ETH</code> in the following format:
      </p>

      <pre>
        <code>1,000,000,000 $XXXDAT / 0 $ETH</code>
      </pre>

      <p>
        This means the initial liquidity is created only from the{" "}
        <code>$XXXDAT</code> side. After the pool is created, the LP position is
        burned.
      </p>

      <p>Simply put:</p>

      <ul>
        <li>the entire supply goes directly into the market</li>
        <li>the LP position cannot be recovered</li>
        <li>
          nobody, including the token creator, can remove liquidity from the
          pool
        </li>
        <li>
          the token remains tradable for as long as the blockchain continues to
          operate
        </li>
      </ul>

      <p>
        <strong>The economics of each DAT token may differ.</strong>
      </p>

      <p>
        Different tokens may have different fees, different treasury mechanics,
        and different rules for buybacks, burns, or revenue distribution.
      </p>

      <p>
        That is why for every new launch, we will create a separate section in
        the documentation where its economics and mechanics will be described in
        detail.
      </p>

      <p>
        A short summary for each token will also be available directly on its
        token page:
      </p>

      <p>
        <code>https://www.on-chaindat.com/dats/&lt;contract&gt;</code>
      </p>

      <p>
        where <code>contract</code> is the token contract address in the
        blockchain network where it was launched.
      </p>
    </>
  );
}
