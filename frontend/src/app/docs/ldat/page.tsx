import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LDAT",
  description:
    "$LDAT is the core ecosystem token of on-chainDAT on Linea L2. The 10% trade fee splits 8% into the $LINEA treasury and 2% to the project, and every DAT launched here burns $LDAT.",
};

export default function LineadatDocPage() {
  return (
    <>
      <h1>LDAT</h1>

      <p>
        <strong>on-chaindat.com</strong> is a multichain protocol for launching
        DAT tokens.
      </p>

      <p>
        <code>$LDAT</code> launched on Linea L2 (chain 59144) on 2026-06-09.
        Its contract address is{" "}
        <code>0x02F289E429655d0C0D713A7dFD26850A81f7cFC5</code>. Linea was the
        first network to launch; each network supported in future will have its
        own core ecosystem token.
      </p>

      <p>
        <code>$LDAT</code> is the main ecosystem token of{" "}
        <strong>on-chaindat.com</strong> on Linea L2. It is built on top of the
        network&apos;s base asset - <code>$LINEA</code>.
      </p>

      <p>
        All DAT tokens launched through <strong>on-chaindat.com</strong> on
        Linea L2 will route 1% of their trading volume into buying and burning{" "}
        <code>$LDAT</code>. In other words, every new DAT inside the
        ecosystem will additionally feed <code>$LDAT</code> and strengthen
        its deflationary mechanics.
      </p>

      <p>
        Every <code>$LDAT</code> trade executed through the{" "}
        <a
          href="https://developers.uniswap.org/docs/protocols/v4/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          Uniswap v4 hook
        </a>{" "}
        is charged a 10% fee.
      </p>

      <p>This fee is distributed as follows:</p>

      <ul>
        <li>
          8% goes toward accumulating the base asset, <code>$LINEA</code>,
          inside the <code>$LDAT</code> treasury.
        </li>
        <li>
          2% goes toward supporting and developing the{" "}
          <strong>on-chaindat.com</strong> project.
        </li>
      </ul>

      <p>
        The <code>$LDAT</code> contract is currently upgradeable, and ownership
        sits behind a 2-of-3 multisig. Upgradeability will be permanently
        revoked once post-launch testing completes.
      </p>

      <p>
        Once locked, nobody, including the creator, will be able to change even
        a single symbol in the contract. This is important because{" "}
        <code>$LDAT</code> will become the base ecosystem token of{" "}
        <strong>on-chaindat.com</strong> on Linea L2. All future DAT tokens
        launched on this network will route part of their trading fees into
        buying and burning it.
      </p>

      <p>
        To protect <code>$LDAT</code> and other <code>$XXXDAT</code> tokens
        from secondary pools on Uniswap or other DEXs where they could be
        traded without the protocol fee, all tokens launched through{" "}
        <strong>on-chaindat.com</strong> are intentionally made
        non-transferable by default.
      </p>

      <p>
        This means that regular wallet-to-wallet token transfers are
        restricted. Since 2026-06-21 they are possible through an approved
        whitelisted intermediary contract, which burns a 1% fee. The interface
        for it is live at <a href="/transfer">on-chaindat.com/transfer</a>, and
        the mechanics are documented in <a href="/docs/transfer">Transfer</a>.
      </p>
    </>
  );
}
