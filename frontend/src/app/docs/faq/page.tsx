import type { Metadata } from "next";
import { FaqJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about $LDAT on Linea L2: what a DAT token is, the 10% fee split, the 99% launch fee, why transfers need the relay, the contract address, and the supply.",
};

/**
 * Edit an answer below and you must edit FAQ_ITEMS in src/components/json-ld.tsx
 * to match: it mirrors these 14 questions for the FAQPage markup.
 */
export default function FaqDocPage() {
  return (
    <>
      <FaqJsonLd />
      <h1>FAQ</h1>

      <p className="docs-lead">
        Short answers to the questions we get most. Each one links to the page
        with the full mechanics.
      </p>

      <h2>What is a DAT token?</h2>
      <p>
        DAT stands for Digital Asset Treasury. A DAT token is launched on top of
        an already existing token: if a token <code>$XXX</code> exists, a{" "}
        <code>$XXXDAT</code> can be launched on top of it. The DAT charges a tax
        on its own buys and sells, then routes those fees into a treasury that
        supports its strategy and the underlying asset. See the{" "}
        <a href="/docs">overview</a>.
      </p>

      <h2>Is a DAT token the same as a digital asset treasury company?</h2>
      <p>
        No, and the acronym collides. In equities, a DAT (or DATCO) is a public
        company that holds crypto on its balance sheet, and you buy shares in
        that company. A DAT token here is protocol-native: there is no company,
        no shares and no filings. The treasury is a smart contract, its holdings
        are readable on-chain at any block, and there is no board to vote on what
        it does next.
      </p>

      <h2>What is $LDAT?</h2>
      <p>
        <code>$LDAT</code> is the core ecosystem token of on-chainDAT on Linea
        L2, built on top of the network&apos;s base asset, <code>$LINEA</code>.
        It launched on 2026-06-09 on Linea (chain 59144). Every other DAT
        launched on this network routes 1% of its trading volume into buying and
        burning <code>$LDAT</code>. See <a href="/docs/ldat">LDAT</a>.
      </p>

      <h2>What is the $LDAT trading fee, and where does it go?</h2>
      <p>
        Every <code>$LDAT</code> buy or sell pays a 10% fee, charged inside the
        pool&apos;s own Uniswap v4 hook, so there are no exemptions and no
        whitelist. Of that fee, 8% accumulates <code>$LINEA</code> in the
        treasury and 2% funds the project. The fee is not extracted from the
        ecosystem: it stays inside the token&apos;s own mechanics. See{" "}
        <a href="/docs/ldat">LDAT</a>.
      </p>

      <h2>What is the maximum supply?</h2>
      <p>
        1,000,000,000 tokens for any token launched through on-chainDAT,
        including <code>$LDAT</code>. The supply is fixed at launch and never
        increases, while buybacks and transfer fees burn against it. See{" "}
        <a href="/docs/tokenomics">Tokenomics</a>.
      </p>

      <h2>Can the team pull the liquidity?</h2>
      <p>
        No. At launch the entire supply is sent into the Uniswap v4 pool against{" "}
        <code>$ETH</code> (1,000,000,000 <code>$XXXDAT</code> / 0{" "}
        <code>$ETH</code>) and the LP position is burned. The position cannot be
        recovered, so nobody, including the token creator, can withdraw liquidity
        from the pool. The token stays tradable for as long as the chain runs.
        See <a href="/docs/tokenomics">Tokenomics</a>.
      </p>

      <h2>Why was the launch fee 99%?</h2>
      <p>
        To protect the launch from bots and snipers. The initial buy fee starts
        at 99% and decays to the base fee of that DAT, which for{" "}
        <code>$LDAT</code> is 10%. The high initial fee is not extracted: like
        every other fee it stays inside the token&apos;s own economy. See{" "}
        <a href="/docs/new-launches">New Launches</a>.
      </p>

      <h2>Why can&apos;t I send $LDAT straight to another wallet?</h2>
      <p>
        Because ordinary wallet-to-wallet transfers are disabled by design. If
        tokens moved freely, they could be paired into a secondary pool on
        another DEX and traded there without the protocol fee, starving the
        treasury and the burn. Every token launched through on-chainDAT is
        therefore non-transferable by default. See <a href="/docs/ldat">LDAT</a>.
      </p>

      <h2>So how do I move my tokens to another wallet?</h2>
      <p>
        Through the official relay at{" "}
        <a href="/transfer">on-chaindat.com/transfer</a>. You connect your
        wallet, enter an amount and a recipient, approve the contract for exactly
        that amount, and send. The relay is the only sanctioned path, and the
        approach mirrors how <code>$veAERO</code> positions move on Aerodrome.
        See <a href="/docs/transfer">Transfer</a>.
      </p>

      <h2>What does a transfer cost?</h2>
      <p>
        1% of the amount, on top of gas. The fee is taken in the token itself and
        burned to the dead address, so the recipient receives 99%. That burn
        permanently reduces circulating supply and shows up in the
        protocol&apos;s burn total like any buy-and-burn. See{" "}
        <a href="/docs/transfer">Transfer</a>.
      </p>

      <h2>What is the $LDAT contract address?</h2>
      <p>
        <code>0x02F289E429655d0C0D713A7dFD26850A81f7cFC5</code> on Linea mainnet
        (chain 59144). Always verify the address on{" "}
        <a
          href="https://lineascan.build/token/0x02F289E429655d0C0D713A7dFD26850A81f7cFC5"
          target="_blank"
          rel="noopener noreferrer"
        >
          Lineascan
        </a>{" "}
        before trading, and reach the swap through this site rather than through a
        link someone sent you.
      </p>

      <h2>Is the $LDAT contract immutable?</h2>
      <p>
        No. The contract is currently upgradeable and its ownership sits behind
        a 2-of-3 multisig, so a bug can be fixed quickly during the first months
        of mainnet, and so the logic can be replaced. The intention is to revoke
        upgradeability once post-launch testing completes, after which nobody,
        including the creator, could change a single symbol in it. No date has
        been committed to, so treat the code as changeable until it happens. See{" "}
        <a href="/docs/ldat">LDAT</a>.
      </p>

      <h2>Has the protocol been audited?</h2>
      <p>
        No, there is no third-party audit. on-chainDAT is an experimental DeFi
        protocol: the contracts are open source and verified on Lineascan, and
        the treasury is readable on-chain, but nothing here has been reviewed by
        an external auditor. Trade only what you can afford to lose, and read the{" "}
        <a href="/terms">Terms of Service</a>.
      </p>

      <h2>Does the protocol need oracles or a market maker?</h2>
      <p>
        No. Every DAT launched through on-chainDAT operates autonomously
        on-chain, with no oracles, no centralized market makers and no manual
        trade management. Once launched, a DAT keeps operating for as long as the
        blockchain it sits on remains functional. See the{" "}
        <a href="/docs">overview</a>.
      </p>
    </>
  );
}
